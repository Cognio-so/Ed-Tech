"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Helper function to serialize MongoDB objects
function serializeMongoData(data) {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => serializeMongoData(item));
  }
  
  if (typeof data === 'object') {
    if (data._id && data._id.toString) {
      data._id = data._id.toString();
    }
    
    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.constructor === Date) {
        serialized[key] = value.toISOString();
      } else if (value && typeof value === 'object' && value.toString && value.toString().includes('ObjectId')) {
        serialized[key] = value.toString();
      } else {
        serialized[key] = serializeMongoData(value);
      }
    }
    return serialized;
  }
  
  return data;
}

// Get comprehensive dashboard statistics
export async function getDashboardStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();

    // Get user counts by role
    const userStats = await db.collection('user').aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Get total conversations
    const studentConversations = await db.collection('student_conversations').countDocuments();
    const teacherConversations = await db.collection('teacherConversations').countDocuments();

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentStudentConversations = await db.collection('student_conversations').countDocuments({
      'metadata.createdAt': { $gte: thirtyDaysAgo }
    });

    const recentTeacherConversations = await db.collection('teacherConversations').countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStudentConversations = await db.collection('student_conversations').countDocuments({
      'metadata.createdAt': { $gte: today, $lt: tomorrow }
    });

    const todayTeacherConversations = await db.collection('teacherConversations').countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Get new users in last 30 days
    const newUsers = await db.collection('user').countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get new users today
    const newUsersToday = await db.collection('user').countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Format user stats
    const formattedUserStats = {
      admin: 0,
      teacher: 0,
      student: 0,
      total: 0
    };

    userStats.forEach(stat => {
      formattedUserStats[stat._id] = stat.count;
      formattedUserStats.total += stat.count;
    });

    // Get message statistics
    const studentMessages = await db.collection('student_conversations').aggregate([
      {
        $project: {
          messageCount: { $size: { $ifNull: ['$messages', []] } }
        }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: '$messageCount' }
        }
      }
    ]).toArray();

    const teacherMessages = await db.collection('teacherConversations').aggregate([
      {
        $project: {
          messageCount: { $size: { $ifNull: ['$messages', []] } }
        }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: '$messageCount' }
        }
      }
    ]).toArray();

    const stats = {
      users: formattedUserStats,
      conversations: {
        total: studentConversations + teacherConversations,
        student: studentConversations,
        teacher: teacherConversations
      },
      messages: {
        total: (studentMessages[0]?.totalMessages || 0) + (teacherMessages[0]?.totalMessages || 0),
        student: studentMessages[0]?.totalMessages || 0,
        teacher: teacherMessages[0]?.totalMessages || 0
      },
      activity: {
        today: {
          conversations: todayStudentConversations + todayTeacherConversations,
          studentConversations: todayStudentConversations,
          teacherConversations: todayTeacherConversations,
          newUsers: newUsersToday
        },
        last30Days: {
          conversations: recentStudentConversations + recentTeacherConversations,
          studentConversations: recentStudentConversations,
          teacherConversations: recentTeacherConversations,
          newUsers: newUsers
        }
      }
    };

    return {
      success: true,
      data: serializeMongoData(stats)
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return { success: false, error: "Failed to fetch dashboard statistics" };
  }
}

// Get recent conversations
export async function getRecentConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();

    // Get recent student conversations
    const recentStudentConversations = await db.collection('student_conversations')
      .find({})
      .sort({ 'metadata.lastMessageAt': -1 })
      .limit(5)
      .toArray();

    // Get recent teacher conversations
    const recentTeacherConversations = await db.collection('teacherConversations')
      .find({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(5)
      .toArray();

    // Transform and combine
    const transformedStudentConversations = recentStudentConversations.map(conv => ({
      _id: conv._id.toString(),
      type: 'student',
      userId: conv.studentId?.toString(),
      title: conv.title,
      sessionType: conv.sessionType || 'text',
      messageCount: conv.messages?.length || 0,
      lastMessageAt: conv.metadata?.lastMessageAt || conv.metadata?.createdAt,
      createdAt: conv.metadata?.createdAt
    }));

    const transformedTeacherConversations = recentTeacherConversations.map(conv => ({
      _id: conv._id.toString(),
      type: 'teacher',
      userId: conv.teacherId?.toString(),
      title: conv.title || `Conversation ${conv.sessionId.split('_').pop()}`,
      sessionType: conv.sessionType || 'text',
      messageCount: conv.messages?.length || 0,
      lastMessageAt: conv.updatedAt || conv.createdAt,
      createdAt: conv.createdAt
    }));

    // Combine and sort by last message time
    const allConversations = [...transformedStudentConversations, ...transformedTeacherConversations]
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      .slice(0, 10);

    return {
      success: true,
      data: serializeMongoData(allConversations)
    };
  } catch (error) {
    console.error('Error fetching recent conversations:', error);
    return { success: false, error: "Failed to fetch recent conversations" };
  }
}

// Get user activity chart data (last 7 days)
export async function getUserActivityData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();

    // Get data for last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [newUsers, studentConvs, teacherConvs] = await Promise.all([
        db.collection('user').countDocuments({
          createdAt: { $gte: date, $lt: nextDate }
        }),
        db.collection('student_conversations').countDocuments({
          'metadata.createdAt': { $gte: date, $lt: nextDate }
        }),
        db.collection('teacherConversations').countDocuments({
          createdAt: { $gte: date, $lt: nextDate }
        })
      ]);

      last7Days.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        newUsers,
        studentConversations: studentConvs,
        teacherConversations: teacherConvs,
        totalConversations: studentConvs + teacherConvs
      });
    }

    return {
      success: true,
      data: serializeMongoData(last7Days)
    };
  } catch (error) {
    console.error('Error fetching user activity data:', error);
    return { success: false, error: "Failed to fetch user activity data" };
  }
}

// Get system health metrics
export async function getSystemHealth() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();

    // Test database connection
    const dbStart = Date.now();
    await db.admin().ping();
    const dbLatency = Date.now() - dbStart;

    // Get collection sizes
    const collections = await db.listCollections().toArray();
    const collectionStats = await Promise.all(
      collections.map(async (collection) => {
        const count = await db.collection(collection.name).countDocuments();
        return {
          name: collection.name,
          count
        };
      })
    );

    const health = {
      database: {
        status: 'healthy',
        latency: dbLatency,
        collections: collectionStats
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    return {
      success: true,
      data: serializeMongoData(health)
    };
  } catch (error) {
    console.error('Error fetching system health:', error);
    return { 
      success: true, 
      data: {
        database: { status: 'error', latency: null, collections: [] },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        error: error.message
      }
    };
  }
}