"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Helper function to safely convert dates to ISO strings
function safeToISOString(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue;
  if (dateValue.toISOString && typeof dateValue.toISOString === 'function') {
    return dateValue.toISOString();
  }
  return dateValue;
}

// Helper function to generate better titles
function generateBetterTitle(item, type) {
  if (item.title && item.title.trim() !== '') {
    return item.title;
  }

  switch (type) {
    case 'comic':
      if (item.instruction && item.instruction.trim() !== '') {
        return item.instruction.length > 50 
          ? item.instruction.substring(0, 50) + '...' 
          : item.instruction;
      }
      return `${item.subject || 'General'} Comic - Grade ${item.grade || 'All'}`;
    
    case 'image':
      if (item.prompt && item.prompt.trim() !== '') {
        return item.prompt.length > 50 
          ? item.prompt.substring(0, 50) + '...' 
          : item.prompt;
      }
      return `${item.subject || 'General'} Image - Grade ${item.grade || 'All'}`;
    
    case 'video':
      if (item.topic && item.topic.trim() !== '') {
        return item.topic.length > 50 
          ? item.topic.substring(0, 50) + '...' 
          : item.topic;
      }
      return `${item.subject || 'General'} Video - Grade ${item.grade || 'All'}`;
    
    case 'presentation':
      if (item.topic && item.topic.trim() !== '') {
        return item.topic.length > 50 
          ? item.topic.substring(0, 50) + '...' 
          : item.topic;
      }
      return `${item.subject || 'General'} Presentation - Grade ${item.grade || 'All'}`;
    
    case 'websearch':
      if (item.query && item.query.trim() !== '') {
        return item.query.length > 50 
          ? item.query.substring(0, 50) + '...' 
          : item.query;
      }
      return `${item.subject || 'General'} Web Search - Grade ${item.grade || 'All'}`;
    
    case 'content':
      if (item.topic && item.topic.trim() !== '') {
        return item.topic.length > 50 
          ? item.topic.substring(0, 50) + '...' 
          : item.topic;
      }
      return `${item.subject || 'General'} ${item.contentType || 'Content'} - Grade ${item.grade || 'All'}`;
    
    default:
      return `${item.subject || 'General'} ${type} - Grade ${item.grade || 'All'}`;
  }
}

// Get teacher dashboard data
export async function getTeacherDashboardData() {
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

    // Get teacher-specific data using correct collection names
    const [conversations, contents, presentations, comics, images, videos, assessments, webSearches] = await Promise.all([
      // Get teacher conversations
      db.collection('teacherConversations')
        .find({ 
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ]
        })
        .sort({ "metadata.updatedAt": -1 })
        .limit(10)
        .toArray(),
      
      // Get generated content from contents collection
      db.collection('contents')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      // Get presentations
      db.collection('presentations')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      // Get comics
      db.collection('comics')
        .find({ userId: userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      // Get images
      db.collection('images')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      // Get videos
      db.collection('videos')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      // Get assessments
      db.collection('assessments')
        .find({ userId: userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      // Get web searches
      db.collection('websearches')
        .find({ userId: userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray()
    ]);

    // Calculate statistics using correct collection names
    const [
      totalConversations,
      totalContents,
      totalPresentations,
      totalComics,
      totalImages,
      totalVideos,
      totalAssessments,
      totalWebSearches
    ] = await Promise.all([
      db.collection('teacherConversations')
        .countDocuments({ 
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ]
        }),
      db.collection('contents')
        .countDocuments({ userId: userId.toString() }),
      db.collection('presentations')
        .countDocuments({ userId: userId.toString() }),
      db.collection('comics')
        .countDocuments({ userId: userId }),
      db.collection('images')
        .countDocuments({ userId: userId.toString() }),
      db.collection('videos')
        .countDocuments({ userId: userId.toString() }),
      db.collection('assessments')
        .countDocuments({ userId: userId }),
      db.collection('websearches')
        .countDocuments({ userId: userId })
    ]);

    // Calculate total content generated (all types combined)
    const totalContentGenerated = totalContents + totalPresentations + totalComics + totalImages + totalVideos + totalWebSearches;

    // Get recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentActivity = await db.collection('teacherConversations')
      .countDocuments({
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [userId, userId.toString()] } }
        ],
        "metadata.updatedAt": { $gte: weekAgo }
      });

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayActivity = await db.collection('teacherConversations')
      .countDocuments({
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [userId, userId.toString()] } }
        ],
        "metadata.updatedAt": {
          $gte: today,
          $lt: tomorrow
        }
      });

    // Transform recent conversations
    const recentConversations = conversations.map(conversation => ({
      _id: conversation._id.toString(),
      teacherId: conversation.teacherId?.toString() || userId.toString(),
      sessionId: conversation.sessionId,
      title: conversation.title || `Conversation ${conversation.sessionId?.split('_').pop() || 'Unknown'}`,
      sessionType: conversation.sessionType || "text",
      messageCount: conversation.messages?.length || 0,
      lastMessage: conversation.messages && conversation.messages.length > 0 
        ? conversation.messages[conversation.messages.length - 1].content 
        : "No messages",
      lastMessageAt: safeToISOString(conversation.metadata?.lastMessageAt || conversation.metadata?.updatedAt || conversation.metadata?.createdAt),
      createdAt: safeToISOString(conversation.metadata?.createdAt),
      conversationStats: conversation.conversationStats || {
        totalMessages: conversation.messages?.length || 0,
        userMessages: conversation.messages?.filter(m => m.role === 'user').length || 0,
        aiMessages: conversation.messages?.filter(m => m.role === 'assistant').length || 0,
        totalDuration: 0
      },
      tags: conversation.metadata?.tags || []
    }));

    // Transform all content types into a unified format with better titles
    const allContent = [
      ...contents.map(content => ({
        _id: content._id.toString(),
        title: generateBetterTitle(content, 'content'),
        type: content.contentType || 'lesson',
        subject: content.subject || 'General',
        grade: content.grade || 'All',
        status: content.status || 'draft',
        createdAt: safeToISOString(content.metadata?.createdAt),
        updatedAt: safeToISOString(content.metadata?.updatedAt),
        contentType: 'content'
      })),
      ...presentations.map(presentation => ({
        _id: presentation._id.toString(),
        title: generateBetterTitle(presentation, 'presentation'),
        type: 'presentation',
        subject: presentation.subject || 'General',
        grade: presentation.grade || 'All',
        status: presentation.status || 'draft',
        createdAt: safeToISOString(presentation.metadata?.createdAt),
        updatedAt: safeToISOString(presentation.metadata?.updatedAt),
        contentType: 'presentation'
      })),
      ...comics.map(comic => ({
        _id: comic._id.toString(),
        title: generateBetterTitle(comic, 'comic'),
        type: 'comic',
        subject: comic.subject || 'General',
        grade: comic.grade || 'All',
        status: comic.status || 'draft',
        createdAt: safeToISOString(comic.metadata?.createdAt),
        updatedAt: safeToISOString(comic.metadata?.updatedAt),
        contentType: 'comic'
      })),
      ...images.map(image => ({
        _id: image._id.toString(),
        title: generateBetterTitle(image, 'image'),
        type: 'image',
        subject: image.subject || 'General',
        grade: image.grade || 'All',
        status: image.status || 'draft',
        createdAt: safeToISOString(image.metadata?.createdAt),
        updatedAt: safeToISOString(image.metadata?.updatedAt),
        contentType: 'image'
      })),
      ...videos.map(video => ({
        _id: video._id.toString(),
        title: generateBetterTitle(video, 'video'),
        type: 'video',
        subject: video.subject || 'General',
        grade: video.grade || 'All',
        status: video.status || 'draft',
        createdAt: safeToISOString(video.metadata?.createdAt),
        updatedAt: safeToISOString(video.metadata?.updatedAt),
        contentType: 'video'
      })),
      ...webSearches.map(search => ({
        _id: search._id.toString(),
        title: generateBetterTitle(search, 'websearch'),
        type: 'websearch',
        subject: search.subject || 'General',
        grade: search.grade || 'All',
        status: search.status || 'completed',
        createdAt: safeToISOString(search.metadata?.createdAt),
        updatedAt: safeToISOString(search.metadata?.updatedAt),
        contentType: 'websearch'
      }))
    ].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    // Get recent content (top 10)
    const recentContent = allContent.slice(0, 10);

    // Transform assessments
    const recentAssessments = assessments.map(assessment => ({
      _id: assessment._id.toString(),
      title: assessment.title || `${assessment.subject || 'General'} Assessment - Grade ${assessment.grade || 'All'}`,
      type: assessment.questionTypes ? 
        (assessment.questionTypes.mcq ? 'quiz' : 
         assessment.questionTypes.true_false ? 'true-false' : 
         assessment.questionTypes.short_answer ? 'short-answer' : 'mixed') : 'quiz',
      subject: assessment.subject || 'General',
      grade: assessment.grade || 'All',
      questionCount: assessment.numQuestions || 0,
      status: assessment.status || 'draft',
      createdAt: safeToISOString(assessment.metadata?.createdAt),
      updatedAt: safeToISOString(assessment.metadata?.updatedAt)
    }));

    // Calculate productivity metrics with more realistic scoring
    const productivityScore = Math.min(100, Math.round(
      (totalConversations * 5) + 
      (totalContentGenerated * 8) + 
      (totalAssessments * 12) + 
      (recentActivity * 2)
    ));

    // Get weekly activity for chart
    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayActivity = await db.collection('teacherConversations')
        .countDocuments({
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ],
          "metadata.updatedAt": {
            $gte: date,
            $lt: nextDate
          }
        });

      weeklyActivity.push({
        date: date.toISOString().split('T')[0],
        activity: dayActivity
      });
    }

    // Properly serialize all data
    const dashboardData = {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        createdAt: safeToISOString(user.createdAt)
      },
      stats: {
        totalConversations,
        totalContentGenerated,
        totalAssessments,
        totalMediaUploads: totalImages + totalVideos, // Combined media count
        recentActivity,
        todayActivity,
        productivityScore,
        // Additional breakdown stats
        totalContents,
        totalPresentations,
        totalComics,
        totalImages,
        totalVideos,
        totalWebSearches
      },
      recentConversations,
      recentContent,
      recentAssessments,
      weeklyActivity
    };

    return { success: true, data: dashboardData };
  } catch (error) {
    console.error('Error fetching teacher dashboard data:', error);
    return { success: false, error: "Failed to fetch dashboard data" };
  }
}

// Get quick stats for dashboard widgets
export async function getTeacherQuickStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get counts using correct collection names
    const [
      conversationsCount,
      contentsCount,
      presentationsCount,
      comicsCount,
      imagesCount,
      videosCount,
      assessmentsCount,
      webSearchesCount
    ] = await Promise.all([
      db.collection('teacherConversations')
        .countDocuments({ 
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ]
        }),
      db.collection('contents')
        .countDocuments({ userId: userId.toString() }),
      db.collection('presentations')
        .countDocuments({ userId: userId.toString() }),
      db.collection('comics')
        .countDocuments({ userId: userId }),
      db.collection('images')
        .countDocuments({ userId: userId.toString() }),
      db.collection('videos')
        .countDocuments({ userId: userId.toString() }),
      db.collection('assessments')
        .countDocuments({ userId: userId }),
      db.collection('websearches')
        .countDocuments({ userId: userId })
    ]);

    const totalContent = contentsCount + presentationsCount + comicsCount + imagesCount + videosCount + webSearchesCount;

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayActivity = await db.collection('teacherConversations')
      .countDocuments({
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [userId, userId.toString()] } }
        ],
        "metadata.updatedAt": {
          $gte: today,
          $lt: tomorrow
        }
      });

    return {
      success: true,
      data: {
        totalConversations: conversationsCount,
        totalContent,
        totalAssessments: assessmentsCount,
        totalMedia: imagesCount + videosCount,
        todayActivity,
        // Additional breakdown
        totalContents: contentsCount,
        totalPresentations: presentationsCount,
        totalComics: comicsCount,
        totalImages: imagesCount,
        totalVideos: videosCount,
        totalWebSearches: webSearchesCount
      }
    };
  } catch (error) {
    console.error('Error fetching teacher quick stats:', error);
    return { success: false, error: "Failed to fetch quick stats" };
  }
}