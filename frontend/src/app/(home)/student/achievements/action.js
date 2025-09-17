"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { ACHIEVEMENT_TYPES } from "./constants";

// Get all achievements for a student
export async function getStudentAchievements() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const achievements = await db.collection('achievements')
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ earnedAt: -1 })
      .toArray();

    // Convert MongoDB objects to plain objects
    const serializedAchievements = achievements.map(achievement => ({
      _id: achievement._id.toString(),
      studentId: achievement.studentId.toString(),
      achievementId: achievement.achievementId,
      name: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      color: achievement.color,
      category: achievement.category,
      points: achievement.points,
      earnedAt: achievement.earnedAt.toISOString(),
      metadata: achievement.metadata
    }));

    return { success: true, data: serializedAchievements };
  } catch (error) {
    console.error('Error fetching student achievements:', error);
    return { success: false, error: error.message };
  }
}

// Get achievement statistics
export async function getAchievementStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const stats = await db.collection('achievements').aggregate([
      { $match: { studentId: new ObjectId(session.user.id) } },
      {
        $group: {
          _id: null,
          totalAchievements: { $sum: 1 },
          totalPoints: { $sum: '$points' },
          categories: { $addToSet: '$category' }
        }
      }
    ]).toArray();

    const categoryStats = await db.collection('achievements').aggregate([
      { $match: { studentId: new ObjectId(session.user.id) } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          points: { $sum: '$points' }
        }
      }
    ]).toArray();

    return {
      success: true,
      data: {
        totalAchievements: stats[0]?.totalAchievements || 0,
        totalPoints: stats[0]?.totalPoints || 0,
        categories: stats[0]?.categories || [],
        categoryStats: categoryStats
      }
    };
  } catch (error) {
    console.error('Error fetching achievement stats:', error);
    return { success: false, error: error.message };
  }
}

// Check and award achievements based on progress
export async function checkAndAwardAchievements() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    const studentId = new ObjectId(session.user.id);

    // Get student's current progress
    const progressStats = await db.collection('progress').aggregate([
      { $match: { studentId } },
      {
        $group: {
          _id: null,
          totalContent: { $sum: 1 },
          completedContent: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalTimeSpent: { $sum: '$progress.timeSpent' },
          totalAttempts: { $sum: '$metadata.attempts' }
        }
      }
    ]).toArray();

    const stats = progressStats[0] || {
      totalContent: 0,
      completedContent: 0,
      totalTimeSpent: 0,
      totalAttempts: 0
    };

    // Get existing achievements to avoid duplicates
    const existingAchievements = await db.collection('achievements')
      .find({ studentId })
      .toArray();

    const existingAchievementIds = new Set(existingAchievements.map(a => a.achievementId));

    // Check each achievement type
    const newAchievements = [];
    
    for (const achievementType of Object.values(ACHIEVEMENT_TYPES)) {
      if (existingAchievementIds.has(achievementType.id)) {
        continue; // Skip if already earned
      }

      let shouldAward = false;
      
      switch (achievementType.id) {
        // Progress-based achievements
        case 'first_lesson':
          shouldAward = stats.completedContent >= 1;
          break;
        case 'dedicated_learner':
          shouldAward = stats.completedContent >= 5;
          break;
        case 'knowledge_seeker':
          shouldAward = stats.completedContent >= 10;
          break;
        case 'learning_champion':
          shouldAward = stats.completedContent >= 25;
          break;
        case 'learning_master':
          shouldAward = stats.completedContent >= 50;
          break;
        
        // Time-based achievements
        case 'time_investor':
          shouldAward = stats.totalTimeSpent >= 300; // 5 hours in minutes
          break;
        case 'time_master':
          shouldAward = stats.totalTimeSpent >= 1500; // 25 hours in minutes
          break;
        case 'time_legend':
          shouldAward = stats.totalTimeSpent >= 6000; // 100 hours in minutes
          break;
        
        // Performance-based achievements
        case 'perfectionist':
          // This would need score checking - simplified for now
          shouldAward = stats.completedContent >= 5;
          break;
        case 'high_achiever':
          // This would need average score checking - simplified for now
          shouldAward = stats.completedContent >= 10;
          break;
        case 'consistent_performer':
          // This would need good scores checking - simplified for now
          shouldAward = stats.completedContent >= 10;
          break;
        
        // Subject-specific achievements
        case 'math_whiz':
          // This would need subject-specific checking - simplified for now
          shouldAward = stats.completedContent >= 5;
          break;
        case 'science_explorer':
          // This would need subject-specific checking - simplified for now
          shouldAward = stats.completedContent >= 5;
          break;
        case 'language_artist':
          // This would need subject-specific checking - simplified for now
          shouldAward = stats.completedContent >= 5;
          break;
        
        // Streak achievements
        case 'daily_learner':
          // This would need consecutive day checking - simplified for now
          shouldAward = stats.completedContent >= 7;
          break;
        case 'weekly_warrior':
          // This would need consecutive day checking - simplified for now
          shouldAward = stats.completedContent >= 30;
          break;
        
        // Special achievements
        case 'feedback_giver':
          // This would need feedback count checking - simplified for now
          shouldAward = stats.completedContent >= 5;
          break;
        case 'bookmark_collector':
          // This would need bookmark count checking - simplified for now
          shouldAward = stats.completedContent >= 10;
          break;
        case 'early_bird':
          // This would need quick completion checking - simplified for now
          shouldAward = stats.completedContent >= 1;
          break;
        
        default:
          shouldAward = false;
      }

      if (shouldAward) {
        newAchievements.push({
          studentId,
          achievementId: achievementType.id,
          title: achievementType.name,
          description: achievementType.description,
          icon: achievementType.icon,
          color: achievementType.color,
          category: achievementType.category,
          points: achievementType.points,
          earnedAt: new Date(),
          metadata: {
            awardedFor: achievementType.id,
            awardedAt: new Date()
          }
        });
      }
    }

    if (newAchievements.length > 0) {
      await db.collection('achievements').insertMany(newAchievements);
    }

    return { success: true, data: { totalNew: newAchievements.length, newAchievements } };
  } catch (error) {
    console.error('Error checking and awarding achievements:', error);
    return { success: false, error: error.message };
  }
}

// Get all available achievements (for display)
export async function getAllAvailableAchievements() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    const studentId = new ObjectId(session.user.id);

    // Get earned achievements
    const earnedAchievements = await db.collection('achievements')
      .find({ studentId })
      .toArray();

    const earnedIds = new Set(earnedAchievements.map(a => a.achievementId));

    // Create list of all achievements with earned status
    const allAchievements = Object.values(ACHIEVEMENT_TYPES).map(achievement => {
      const earnedAchievement = earnedAchievements.find(e => e.achievementId === achievement.id);
      return {
        ...achievement,
        earned: earnedIds.has(achievement.id),
        earnedAt: earnedAchievement ? earnedAchievement.earnedAt.toISOString() : null
      };
    });

    return { success: true, data: allAchievements };
  } catch (error) {
    console.error('Error fetching all achievements:', error);
    return { success: false, error: error.message };
  }
}

// Update achievement progress (for display purposes)
export async function getAchievementProgress() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    const studentId = new ObjectId(session.user.id);

    // Get student progress data
    const progressData = await db.collection('progress')
      .find({ studentId })
      .toArray();

    // Calculate current stats
    const stats = {
      totalContent: progressData.length,
      completedContent: progressData.filter(p => p.status === 'completed').length,
      totalTimeSpent: progressData.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0),
      averageScore: 0,
      perfectScores: 0,
      goodScores: 0,
      feedbackCount: 0,
      bookmarkedContent: 0,
      subjectStats: {}
    };

    const completedWithScores = progressData.filter(p => 
      p.status === 'completed' && p.completionData?.score !== undefined
    );

    if (completedWithScores.length > 0) {
      stats.averageScore = completedWithScores.reduce((sum, p) => 
        sum + p.completionData.score, 0) / completedWithScores.length;
      stats.perfectScores = completedWithScores.filter(p => p.completionData.score === 100).length;
      stats.goodScores = completedWithScores.filter(p => p.completionData.score >= 80).length;
    }

    stats.feedbackCount = progressData.filter(p => p.completionData?.feedback).length;
    stats.bookmarkedContent = progressData.filter(p => p.metadata?.bookmarked).length;

    // Calculate subject stats
    progressData.forEach(p => {
      if (p.status === 'completed') {
        if (!stats.subjectStats[p.subject]) {
          stats.subjectStats[p.subject] = { completed: 0, totalScore: 0, count: 0 };
        }
        stats.subjectStats[p.subject].completed++;
        if (p.completionData?.score !== undefined) {
          stats.subjectStats[p.subject].totalScore += p.completionData.score;
          stats.subjectStats[p.subject].count++;
        }
      }
    });

    Object.keys(stats.subjectStats).forEach(subject => {
      const subjectStat = stats.subjectStats[subject];
      if (subjectStat.count > 0) {
        subjectStat.averageScore = subjectStat.totalScore / subjectStat.count;
      }
    });

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching achievement progress:', error);
    return { success: false, error: error.message };
  }
}

// Get recent achievements
export async function getRecentAchievements(limit = 5) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const earnedAchievements = await db.collection('achievements')
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ earnedAt: -1 })
      .limit(limit)
      .toArray();

    const serializedAchievements = earnedAchievements.map(achievement => ({
      _id: achievement._id.toString(),
      studentId: achievement.studentId.toString(),
      achievementId: achievement.achievementId,
      name: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      color: achievement.color,
      category: achievement.category,
      points: achievement.points,
      earnedAt: achievement.earnedAt.toISOString(),
      metadata: achievement.metadata
    }));

    return { success: true, data: serializedAchievements };
  } catch (error) {
    console.error('Error fetching recent achievements:', error);
    return { success: false, error: error.message };
  }
}

// Simple test function to verify server actions are working
export async function testServerAction() {
  console.log('🧪 Server: Test function called successfully!');
  return { success: true, message: 'Server action is working!' };
}
