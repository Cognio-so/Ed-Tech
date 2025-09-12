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
    
    const achievements = await db.collection('studentAchievements')
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ earnedAt: -1 })
      .toArray();

    // Convert MongoDB objects to plain objects
    const serializedAchievements = achievements.map(achievement => ({
      _id: achievement._id.toString(),
      studentId: achievement.studentId.toString(),
      achievementId: achievement.achievementId,
      name: achievement.name,
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
    
    const stats = await db.collection('studentAchievements').aggregate([
      { $match: { studentId: new ObjectId(session.user.id) } },
      {
        $group: {
          _id: null,
          totalAchievements: { $sum: 1 },
          totalPoints: { $sum: '$points' },
          categories: {
            $push: '$category'
          }
        }
      }
    ]).toArray();

    const categoryStats = await db.collection('studentAchievements').aggregate([
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
        total: stats[0] || { totalAchievements: 0, totalPoints: 0, categories: [] },
        byCategory: categoryStats
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

    console.log('🔍 Checking achievements for student:', session.user.id);

    // Get student progress data
    const progressData = await db.collection('studentProgress')
      .find({ studentId })
      .toArray();

    console.log('📊 Found progress records:', progressData.length);

    // Calculate statistics
    const stats = {
      totalContent: progressData.length,
      completedContent: progressData.filter(p => p.status === 'completed').length,
      totalTimeSpent: progressData.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0),
      averageScore: 0,
      perfectScores: 0,
      goodScores: 0,
      feedbackCount: 0,
      bookmarkedContent: 0,
      subjectStats: {},
      streak: 0
    };

    console.log('📈 Calculated stats:', stats);

    // Calculate scores and subject stats
    const completedWithScores = progressData.filter(p => 
      p.status === 'completed' && p.completionData?.score !== undefined
    );

    if (completedWithScores.length > 0) {
      stats.averageScore = completedWithScores.reduce((sum, p) => 
        sum + p.completionData.score, 0) / completedWithScores.length;
      stats.perfectScores = completedWithScores.filter(p => p.completionData.score === 100).length;
      stats.goodScores = completedWithScores.filter(p => p.completionData.score >= 80).length;
    }

    // Count feedback and bookmarks
    stats.feedbackCount = progressData.filter(p => p.completionData?.feedback).length;
    stats.bookmarkedContent = progressData.filter(p => p.metadata?.bookmarked).length;

    // Calculate subject-specific stats
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

    // Calculate average scores per subject
    Object.keys(stats.subjectStats).forEach(subject => {
      const subjectStat = stats.subjectStats[subject];
      if (subjectStat.count > 0) {
        subjectStat.averageScore = subjectStat.totalScore / subjectStat.count;
      }
    });

    console.log('🎯 Final stats with subject breakdown:', stats);

    // Get existing achievements
    const existingAchievements = await db.collection('studentAchievements')
      .find({ studentId })
      .toArray();

    const existingAchievementIds = new Set(existingAchievements.map(a => a.achievementId));
    console.log('🏆 Existing achievements:', Array.from(existingAchievementIds));

    // Check each achievement type
    const newAchievements = [];
    
    for (const [key, achievement] of Object.entries(ACHIEVEMENT_TYPES)) {
      if (existingAchievementIds.has(achievement.id)) continue;

      let shouldAward = false;
      console.log(`🔍 Checking achievement: ${achievement.name} (${achievement.category})`);

      switch (achievement.category) {
        case 'progress':
          if (achievement.criteria.completedContent && 
              stats.completedContent >= achievement.criteria.completedContent) {
            shouldAward = true;
            console.log(`✅ Progress achievement earned: ${achievement.name} - ${stats.completedContent} >= ${achievement.criteria.completedContent}`);
          }
          break;

        case 'time':
          if (achievement.criteria.totalTimeSpent && 
              stats.totalTimeSpent >= achievement.criteria.totalTimeSpent) {
            shouldAward = true;
            console.log(`✅ Time achievement earned: ${achievement.name} - ${stats.totalTimeSpent} >= ${achievement.criteria.totalTimeSpent}`);
          }
          break;

        case 'performance':
          if (achievement.criteria.perfectScore && 
              stats.perfectScores >= achievement.criteria.perfectScore) {
            shouldAward = true;
            console.log(`✅ Performance achievement earned: ${achievement.name} - ${stats.perfectScores} >= ${achievement.criteria.perfectScore}`);
          } else if (achievement.criteria.averageScore && 
                     stats.averageScore >= achievement.criteria.averageScore) {
            shouldAward = true;
            console.log(`✅ Performance achievement earned: ${achievement.name} - ${stats.averageScore} >= ${achievement.criteria.averageScore}`);
          } else if (achievement.criteria.goodScores && 
                     stats.goodScores >= achievement.criteria.goodScores) {
            shouldAward = true;
            console.log(`✅ Performance achievement earned: ${achievement.name} - ${stats.goodScores} >= ${achievement.criteria.goodScores}`);
          }
          break;

        case 'subject':
          const subjectStat = stats.subjectStats[achievement.criteria.subject];
          if (subjectStat && 
              subjectStat.completed >= achievement.criteria.completedContent &&
              subjectStat.averageScore >= achievement.criteria.averageScore) {
            shouldAward = true;
            console.log(`✅ Subject achievement earned: ${achievement.name} - ${subjectStat.completed} >= ${achievement.criteria.completedContent} and ${subjectStat.averageScore} >= ${achievement.criteria.averageScore}`);
          }
          break;

        case 'special':
          if (achievement.criteria.feedbackCount && 
              stats.feedbackCount >= achievement.criteria.feedbackCount) {
            shouldAward = true;
            console.log(`✅ Special achievement earned: ${achievement.name} - ${stats.feedbackCount} >= ${achievement.criteria.feedbackCount}`);
          } else if (achievement.criteria.bookmarkedContent && 
                     stats.bookmarkedContent >= achievement.criteria.bookmarkedContent) {
            shouldAward = true;
            console.log(`✅ Special achievement earned: ${achievement.name} - ${stats.bookmarkedContent} >= ${achievement.criteria.bookmarkedContent}`);
          }
          break;
      }

      if (shouldAward) {
        const newAchievement = {
          studentId,
          achievementId: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          color: achievement.color,
          category: achievement.category,
          points: achievement.points,
          earnedAt: new Date(),
          metadata: {
            statsAtEarned: stats
          }
        };

        newAchievements.push(newAchievement);
        console.log(`🎉 New achievement to be awarded: ${achievement.name}`);
      }
    }

    // Save new achievements
    if (newAchievements.length > 0) {
      console.log(`💾 Saving ${newAchievements.length} new achievements`);
      await db.collection('studentAchievements').insertMany(newAchievements);
    } else {
      console.log('❌ No new achievements to award');
    }

    return { 
      success: true, 
      data: { 
        newAchievements: newAchievements.map(achievement => ({
          ...achievement,
          studentId: achievement.studentId.toString(),
          earnedAt: achievement.earnedAt.toISOString()
        })),
        totalNew: newAchievements.length,
        stats 
      } 
    };
  } catch (error) {
    console.error('❌ Error checking achievements:', error);
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
    const earnedAchievements = await db.collection('studentAchievements')
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
    const progressData = await db.collection('studentProgress')
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

// Simple test function to verify server actions are working
export async function testServerAction() {
  console.log('🧪 Server: Test function called successfully!');
  return { success: true, message: 'Server action is working!' };
}
