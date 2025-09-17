"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Helper function to normalize grades for matching (same as learning-library)
function normalizeGrades(userGrades) {
  const normalizedGrades = [];
  
  userGrades.forEach(grade => {
    // Add the original grade as-is
    normalizedGrades.push(grade);
    
    // Only add the alternative format if it makes sense
    if (grade.startsWith('Grade ')) {
      const withoutGrade = grade.replace('Grade ', '');
      // Only add the numeric version if it's a valid grade number
      if (/^\d+$/.test(withoutGrade)) {
        normalizedGrades.push(withoutGrade);
      }
    } else if (/^\d+$/.test(grade)) {
      // If it's just a number, add the "Grade X" version
      const withGrade = `Grade ${grade}`;
      normalizedGrades.push(withGrade);
    }
  });
  
  // Remove duplicates
  const result = [...new Set(normalizedGrades)];
  return result;
}

// Helper function to safely convert dates to ISO strings
function safeToISOString(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue;
  if (dateValue.toISOString && typeof dateValue.toISOString === 'function') {
    return dateValue.toISOString();
  }
  return dateValue;
}

// Get student dashboard data
export async function getStudentDashboardData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get user data
    const user = await db.collection('user').findOne({ _id: userId });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Normalize grades for matching
    const normalizedGrades = user.grades ? normalizeGrades(user.grades) : ['8'];

    // Get progress data from the correct collection (progress, not studentProgress)
    const progressData = await db.collection('progress')
      .find({ studentId: userId })
      .sort({ 'metadata.updatedAt': -1 })
      .toArray();

    // Get achievements data from the correct collection (achievements, not studentAchievements)
    const achievementsData = await db.collection('achievements')
      .find({ studentId: userId })
      .sort({ earnedAt: -1 })
      .toArray();

    // Get recent conversations
    const recentConversations = await db.collection('student_conversations')
      .find({ studentId: userId })
      .sort({ 'metadata.lastMessageAt': -1 })
      .limit(5)
      .toArray();

    // Get lessons data for recent progress (following learning-library pattern)
    const lessons = await db.collection('lessons')
      .find({ 
        grade: { $in: normalizedGrades },
        status: 'published'
      })
      .sort({ 'metadata.createdAt': -1 })
      .limit(10)
      .toArray();

    // Calculate statistics
    const totalResources = progressData.length;
    const completedResources = progressData.filter(p => p.status === 'completed').length;
    const inProgressResources = progressData.filter(p => p.status === 'in_progress').length;
    const averageProgress = totalResources > 0 ? 
      progressData.reduce((sum, p) => sum + (p.progress?.percentage || 0), 0) / totalResources : 0;
    
    const totalStudyTime = progressData.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0);
    const totalAchievements = achievementsData.length;
    const recentAchievements = achievementsData.filter(a => {
      const earnedDate = new Date(a.earnedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return earnedDate >= weekAgo;
    }).length;

    // Get subject-wise progress
    const subjectProgress = {};
    progressData.forEach(p => {
      const subject = p.subject || 'Unknown';
      if (!subjectProgress[subject]) {
        subjectProgress[subject] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          averagePercentage: 0
        };
      }
      subjectProgress[subject].total++;
      if (p.status === 'completed') subjectProgress[subject].completed++;
      if (p.status === 'in_progress') subjectProgress[subject].inProgress++;
      subjectProgress[subject].averagePercentage += p.progress?.percentage || 0;
    });

    // Calculate average percentages for each subject
    Object.keys(subjectProgress).forEach(subject => {
      if (subjectProgress[subject].total > 0) {
        subjectProgress[subject].averagePercentage = 
          subjectProgress[subject].averagePercentage / subjectProgress[subject].total;
      }
    });

    // Get recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentActivity = progressData.filter(p => {
      const updatedAt = new Date(p.metadata?.updatedAt || p.metadata?.createdAt);
      return updatedAt >= weekAgo;
    }).length;

    // Get learning streak (consecutive days with activity)
    const today = new Date();
    const dates = [...new Set(progressData.map(p => {
      const date = new Date(p.metadata?.updatedAt || p.metadata?.createdAt);
      return date.toDateString();
    }))].sort((a, b) => new Date(b) - new Date(a));

    let streak = 0;
    let currentDate = new Date(today);
    for (let i = 0; i < dates.length; i++) {
      const activityDate = new Date(dates[i]);
      const diffTime = currentDate - activityDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0 || diffDays === 1) {
        streak++;
        currentDate = activityDate;
      } else {
        break;
      }
    }

    // Transform recent progress data (following learning-library pattern)
    const recentProgress = progressData.slice(0, 5).map(progress => {
      // Find the corresponding lesson
      const lesson = lessons.find(l => l._id.toString() === progress.contentId.toString());
      
      return {
        _id: progress._id.toString(),
        contentId: progress.contentId.toString(),
        contentTitle: progress.contentTitle || lesson?.title || 'Untitled',
        subject: progress.subject || lesson?.subject || 'General',
        grade: progress.grade || lesson?.grade || 'All',
        status: progress.status,
        progress: {
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: safeToISOString(progress.progress?.lastAccessedAt)
        },
        completionData: {
          completedAt: safeToISOString(progress.completionData?.completedAt),
          score: progress.completionData?.score
        },
        metadata: {
          createdAt: safeToISOString(progress.metadata?.createdAt),
          updatedAt: safeToISOString(progress.metadata?.updatedAt)
        }
      };
    });

    // Transform recent achievements data
    const recentAchievementsData = achievementsData.slice(0, 3).map(achievement => ({
      _id: achievement._id.toString(),
      studentId: achievement.studentId.toString(),
      achievementId: achievement.achievementId,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      color: achievement.color,
      category: achievement.category,
      points: achievement.points,
      earnedAt: safeToISOString(achievement.earnedAt),
      metadata: achievement.metadata
    }));

    // Transform recent conversations data
    const recentConversationsData = recentConversations.map(conversation => ({
      _id: conversation._id.toString(),
      studentId: conversation.studentId.toString(),
      sessionId: conversation.sessionId,
      title: conversation.title,
      sessionType: conversation.sessionType,
      messages: conversation.messages || [],
      uploadedFiles: conversation.uploadedFiles || [],
      studentData: conversation.studentData || {},
      conversationStats: {
        totalMessages: conversation.conversationStats?.totalMessages || 0,
        userMessages: conversation.conversationStats?.userMessages || 0,
        aiMessages: conversation.conversationStats?.aiMessages || 0,
        totalDuration: conversation.conversationStats?.totalDuration || 0,
        topicsDiscussed: conversation.conversationStats?.topicsDiscussed || [],
        difficultyLevel: conversation.conversationStats?.difficultyLevel || 'medium',
        learningOutcomes: conversation.conversationStats?.learningOutcomes || []
      },
      metadata: {
        createdAt: safeToISOString(conversation.metadata?.createdAt),
        updatedAt: safeToISOString(conversation.metadata?.updatedAt),
        lastMessageAt: safeToISOString(conversation.metadata?.lastMessageAt),
        isActive: conversation.metadata?.isActive,
        tags: conversation.metadata?.tags || []
      }
    }));

    // Properly serialize all data
    const dashboardData = {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        grades: user.grades || [],
        profilePicture: user.profilePicture,
        createdAt: safeToISOString(user.createdAt)
      },
      stats: {
        totalResources,
        completedResources,
        inProgressResources,
        averageProgress: Math.round(averageProgress),
        totalStudyTime,
        totalAchievements,
        recentAchievements,
        recentActivity,
        learningStreak: streak
      },
      subjectProgress: subjectProgress,
      recentProgress: recentProgress,
      recentAchievements: recentAchievementsData,
      recentConversations: recentConversationsData
    };

    return { success: true, data: dashboardData };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return { success: false, error: "Failed to fetch dashboard data" };
  }
}

// Get quick stats for dashboard widgets
export async function getQuickStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get user data for grade normalization
    const user = await db.collection('user').findOne({ _id: userId });
    const normalizedGrades = user?.grades ? normalizeGrades(user.grades) : ['8'];

    // Get counts - UPDATED: Use correct collection names (progress and achievements)
    const [progressCount, achievementsCount, conversationsCount] = await Promise.all([
      db.collection('progress').countDocuments({ studentId: userId }),
      db.collection('achievements').countDocuments({ studentId: userId }),
      db.collection('student_conversations').countDocuments({ studentId: userId })
    ]);

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayActivity = await db.collection('progress')
      .countDocuments({
        studentId: userId,
        'metadata.updatedAt': {
          $gte: today,
          $lt: tomorrow
        }
      });

    return {
      success: true,
      data: {
        totalProgress: progressCount,
        totalAchievements: achievementsCount,
        totalConversations: conversationsCount,
        todayActivity
      }
    };
  } catch (error) {
    console.error('Error fetching quick stats:', error);
    return { success: false, error: "Failed to fetch quick stats" };
  }
}
