"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import PythonApi from "@/lib/PythonApi";
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
    if (data._id && typeof data._id.toString === 'function') {
      // Handle ObjectId
      return {
        ...data,
        _id: data._id.toString()
      };
    }
    
    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeMongoData(value);
    }
    return serialized;
  }
  
  return data;
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

// Get teacher progress data
export async function getTeacherProgressData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const progressData = await db.collection('progress')
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const serializedData = progressData.map(item => ({
      ...item,
      _id: item._id.toString(),
      studentId: item.studentId.toString(),
      contentId: item.contentId.toString(),
      createdAt: safeToISOString(item.createdAt),
      updatedAt: safeToISOString(item.updatedAt),
      progress: {
        ...item.progress,
        lastAccessedAt: safeToISOString(item.progress?.lastAccessedAt)
      },
      completionData: item.completionData ? {
        ...item.completionData,
        completedAt: safeToISOString(item.completionData.completedAt)
      } : null,
      metadata: {
        ...item.metadata,
        createdAt: safeToISOString(item.metadata?.createdAt),
        updatedAt: safeToISOString(item.metadata?.updatedAt)
      }
    }));

    return { 
      success: true, 
      data: serializedData 
    };
  } catch (error) {
    console.error('Error fetching teacher progress data:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Get teacher achievements data
export async function getTeacherAchievementsData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const achievementsData = await db.collection('achievements')
      .find({})
      .sort({ earnedAt: -1 })
      .limit(50)
      .toArray();

    const serializedData = achievementsData.map(item => ({
      ...item,
      _id: item._id.toString(),
      studentId: item.studentId.toString(),
      earnedAt: safeToISOString(item.earnedAt),
      createdAt: safeToISOString(item.createdAt)
    }));

    return { 
      success: true, 
      data: serializedData 
    };
  } catch (error) {
    console.error('Error fetching teacher achievements data:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Get teacher learning stats
export async function getTeacherLearningStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Get progress stats
    const progressStats = await db.collection('progress')
      .aggregate([
        {
          $group: {
            _id: null,
            totalResources: { $sum: 1 },
            completedResources: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            averageProgress: { $avg: "$progress.percentage" },
            totalStudyTime: { $sum: "$progress.timeSpent" }
          }
        }
      ])
      .toArray();

    // Get achievement stats
    const achievementStats = await db.collection('achievements')
      .aggregate([
        {
          $group: {
            _id: null,
            totalAchievements: { $sum: 1 },
            recentAchievements: { $sum: { $cond: [{ $gte: ["$earnedAt", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] }, 1, 0] } }
          }
        }
      ])
      .toArray();

    const stats = {
      totalResources: progressStats[0]?.totalResources || 0,
      completedResources: progressStats[0]?.completedResources || 0,
      averageProgress: progressStats[0]?.averageProgress || 0,
      totalStudyTime: progressStats[0]?.totalStudyTime || 0,
      totalAchievements: achievementStats[0]?.totalAchievements || 0,
      recentAchievements: achievementStats[0]?.recentAchievements || 0
    };

    return { 
      success: true, 
      data: stats 
    };
  } catch (error) {
    console.error('Error fetching teacher learning stats:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Get current teacher data
export async function getCurrentTeacherData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const user = await db.collection('user')
      .findOne({ _id: new ObjectId(session.user.id) });

    if (!user) {
      // Return fallback user data instead of throwing error
      return { 
        success: true, 
        data: {
          _id: session.user.id,
          email: session.user.email || 'teacher@example.com',
          name: session.user.name || 'Teacher',
          grades: ['Grade 8', 'Grade 9', 'Grade 10'],
          subjects: ['Mathematics', 'Science', 'English']
        }
      };
    }

    // Convert MongoDB objects to plain objects
    const serializedUser = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      grades: user.grades || [],
      subjects: user.subjects || [],
      role: user.role,
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString()
    };

    return { 
      success: true, 
      data: serializedUser 
    };
  } catch (error) {
    console.error('Error fetching teacher data:', error);
    return { 
      success: true, 
      data: {
        _id: 'fallback_teacher_id',
        email: 'teacher@example.com',
        name: 'Teacher',
        grades: ['Grade 8', 'Grade 9', 'Grade 10'],
        subjects: ['Mathematics', 'Science', 'English']
      }
    };
  }
}

/**
 * Send a chat message to the Voice Coach
 * @param {Object} formData - Form data containing the message and session info
 * @returns {Promise<Object>} - Response from the Voice Coach
 */
export async function sendVoiceCoachMessage(formData) {
  try {
    const message = formData.get("message");
    const sessionId = formData.get("sessionId");
    const teacherData = JSON.parse(formData.get("studentData") || "{}");

    if (!message || !sessionId) {
      return {
        success: false,
        error: "Message and session ID are required"
      };
    }

    console.log('Sending message to Voice Coach:', { message, sessionId });

    const response = await PythonApi.startTeacherVoiceChat(teacherData, sessionId, message);

    if (response.ok) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = ''; // Buffer for incomplete JSON
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        buffer += chunk;
        
        // Split by lines and process each complete line
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              
              // Check if this is an image response (same as AI Tutor)
              if (jsonStr.includes('__IMAGE_RESPONSE__')) {
                // Handle image response differently
                const imageContent = jsonStr.replace('__IMAGE_RESPONSE__', '');
                
                // Try to parse the JSON properly
                try {
                  const data = JSON.parse(imageContent);
                  if (data.content) {
                    fullResponse = data.content;
                  } else {
                    fullResponse = imageContent;
                  }
                } catch (parseError) {
                  // If JSON parsing fails, use the raw content
                  fullResponse = imageContent;
                }
                continue;
              }
              
              // Handle regular text chunks
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'text_chunk') {
                fullResponse += data.content;
              } else if (data.type === 'done') {
                break;
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
              console.error('Problematic line:', line);
              // Continue processing other lines
            }
          }
        }
      }

      return {
        success: true,
        response: fullResponse,
        sessionId: sessionId
      };
    } else {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
  } catch (error) {
    console.error("Error in sendVoiceCoachMessage:", error);
    return {
      success: false,
      error: error.message || "Failed to send message to Voice Coach"
    };
  }
}

/**
 * Upload documents for Voice Coach analysis
 * @param {Object} formData - Form data containing files and session info
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadDocumentsToVoiceCoach(formData) {
  try {
    const files = formData.getAll("files");
    const sessionId = formData.get("sessionId");
    const studentData = JSON.parse(formData.get("studentData") || "{}");

    if (!files || files.length === 0) {
      return {
        success: false,
        error: "No files provided"
      };
    }

    if (!sessionId) {
      return {
        success: false,
        error: "Session ID is required"
      };
    }

    console.log('Uploading documents to Voice Coach:', { fileCount: files.length, sessionId });

    // CORRECTED: Call the dedicated method for the teacher chatbot
    const response = await PythonApi.uploadDocumentsForTeacherChatbot(sessionId, files);

    if (response.success) {
      return {
        success: true,
        message: response.message || "Documents uploaded successfully",
        uploadedFiles: response.files_processed || []
      };
    } else {
      return {
        success: false,
        error: response.message || "Failed to upload documents"
      };
    }
  } catch (error) {
    console.error("Error in uploadDocumentsToVoiceCoach:", error);
    return {
      success: false,
      error: error.message || "Failed to upload documents"
    };
  }
}

/**
 * Start a real-time voice session with the Voice Coach
 * @param {Object} teacherData - Comprehensive teacher data
 * @returns {Promise<Object>} - WebSocket connection info
 */
export async function startVoiceCoachSession(teacherData) {
  try {
    if (!teacherData.id || !teacherData.name) {
      return {
        success: false,
        error: "Teacher ID and name are required for voice session"
      };
    }

    // Prepare comprehensive teacher context for personalized coaching
    const teacherContext = {
      id: teacherData.id,
      name: teacherData.name,
      email: teacherData.email,
      grades: teacherData.grades || [],
      subjects: teacherData.subjects || [],
      role: "teacher",
      sessionType: "voice_coach",
      preferences: {
        teachingStyle: "interactive",
        focusAreas: teacherData.subjects || [],
        difficultyLevel: "adaptive"
      },
      context: {
        currentTopic: "general_teaching",
        learningGoals: ["improve_teaching_methods", "student_engagement", "classroom_management"],
        recentActivities: teacherData.recentActivities || [],
        teachingExperience: teacherData.teachingExperience || "intermediate"
      },
      analytics: {
        totalSessions: 0,
        averageSessionDuration: 0,
        preferredTopics: teacherData.subjects || [],
        teachingStrengths: [],
        improvementAreas: []
      },
      topicInterests: teacherData.subjects || []
    };

    console.log('Prepared teacher context for voice session:', teacherContext);

    // Note: WebSocket creation happens on client side
    // This function prepares the data structure
    return {
      success: true,
      teacherContext: teacherContext,
      message: "Teacher context prepared for voice session"
    };

  } catch (error) {
    console.error("Error in startVoiceCoachSession:", error);
    return {
      success: false,
      error: error.message || "Failed to prepare voice session"
    };
  }
}

/**
 * Stop the current voice session
 * @param {Object} formData - Form data containing session info
 * @returns {Promise<Object>} - Stop result
 */
export async function stopVoiceCoachSession(formData) {
  try {
    const sessionId = formData.get("sessionId");

    if (!sessionId) {
      return {
        success: false,
        error: "Session ID is required"
      };
    }

    console.log('Stopping voice coach session:', sessionId);

    return {
      success: true,
      message: "Voice session stopped successfully"
    };

  } catch (error) {
    console.error("Error in stopVoiceCoachSession:", error);
    return {
      success: false,
      error: error.message || "Failed to stop voice session"
    };
  }
}

/**
 * Perform web search for Voice Coach
 * @param {Object} formData - Form data containing search query and session info
 * @returns {Promise<Object>} - Search results
 */
export async function performVoiceCoachWebSearch(formData) {
  try {
    const query = formData.get("query");
    const sessionId = formData.get("sessionId");
    const studentData = JSON.parse(formData.get("studentData") || "{}");

    if (!query || !sessionId) {
      return {
        success: false,
        error: "Query and session ID are required"
      };
    }

    // Prepare the request payload
    const requestData = {
      query: query,
      session_id: sessionId,
      student_data: studentData
    };

    console.log('Performing web search for Voice Coach:', { query, sessionId });

    // Call the Python API
    const response = await PythonApi.performWebSearch(requestData);

    if (response.success) {
      return {
        success: true,
        results: response.results || [],
        query: query
      };
    } else {
      return {
        success: false,
        error: response.error || "Failed to perform web search"
      };
    }
  } catch (error) {
    console.error("Error in performVoiceCoachWebSearch:", error);
    return {
      success: false,
      error: error.message || "Failed to perform web search"
    };
  }
}

/**
 * Get Voice Coach health status
 * @returns {Promise<Object>} - Health status
 */
export async function getVoiceCoachHealth() {
  try {
    const response = await PythonApi.getHealth();

    return {
      success: true,
      status: response.status || "healthy",
      message: response.message || "Voice Coach is running"
    };
  } catch (error) {
    console.error("Error in getVoiceCoachHealth:", error);
    return {
      success: false,
      error: error.message || "Failed to get Voice Coach health status"
    };
  }
}

/**
 * Create a new Voice Coach session
 * @param {Object} formData - Form data containing session info
 * @returns {Promise<Object>} - Session creation result
 */
export async function createVoiceCoachSession(formData) {
  try {
    const userId = formData.get("userId");
    const teacherData = JSON.parse(formData.get("teacherData") || "{}");

    if (!userId) {
      return {
        success: false,
        error: "User ID is required"
      };
    }

    // Generate a unique session ID
    const sessionId = `voice_coach_${userId}_${Date.now()}`;

    console.log('Creating Voice Coach session:', { sessionId, userId });

    return {
      success: true,
      sessionId: sessionId,
      message: "Voice Coach session created successfully"
    };
  } catch (error) {
    console.error("Error in createVoiceCoachSession:", error);
    return {
      success: false,
      error: error.message || "Failed to create Voice Coach session"
    };
  }
}

/**
 * Get teacher learning insights
 * @returns {Promise<Object>} - Learning insights
 */
export async function getTeacherLearningInsights() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Get insights from student progress data
    const insights = await db.collection('progress')
      .aggregate([
        {
          $group: {
            _id: "$subject",
            totalStudents: { $addToSet: "$studentId" },
            averageScore: { $avg: "$completionData.score" },
            completionRate: { $avg: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
          }
        },
        {
          $project: {
            subject: "$_id",
            totalStudents: { $size: "$totalStudents" },
            averageScore: { $round: ["$averageScore", 2] },
            completionRate: { $round: [{ $multiply: ["$completionRate", 100] }, 2] }
          }
        }
      ])
      .toArray();

    return {
      success: true,
      insights: insights
    };
  } catch (error) {
    console.error("Error in getTeacherLearningInsights:", error);
    return {
      success: false,
      error: error.message || "Failed to get learning insights"
    };
  }
}

/**
 * Save Voice Coach chat session
 * @param {Object} formData - Form data containing session data
 * @returns {Promise<Object>} - Save result
 */
export async function saveVoiceCoachChatSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const sessionId = formData.get("sessionId");
    const messages = JSON.parse(formData.get("messages") || "[]");
    const sessionType = formData.get("sessionType") || "text";

    if (!sessionId || !messages.length) {
      return {
        success: false,
        error: "Session ID and messages are required"
      };
    }

    const { db } = await connectToDatabase();
    
    // FIXED: Add teacherId and proper conversation structure
    const sessionData = {
      teacherId: new ObjectId(session.user.id), // FIXED: Add teacherId
      sessionId: sessionId,
      title: `Voice Coach Session ${new Date().toLocaleDateString()}`, // FIXED: Add title
      sessionType: sessionType,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.type === 'user' ? 'user' : 'assistant', // FIXED: Map type to role
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        isImageResponse: false,
        metadata: {
          messageType: 'text',
          fileAttachments: [],
          processingTime: 0
        }
      })),
      uploadedFiles: [],
      teacherData: {
        grades: [],
        subjects: [],
        teachingExperience: "intermediate",
        preferences: {},
        analytics: {}
      },
      studentContext: {
        students: [],
        classPerformance: {},
        learningInsights: {}
      },
      conversationStats: {
        totalMessages: messages.length,
        userMessages: messages.filter(m => m.type === 'user').length,
        aiMessages: messages.filter(m => m.type === 'ai').length,
        totalDuration: 0,
        topicsDiscussed: [],
        difficultyLevel: "medium",
        teachingOutcomes: []
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: false,
        tags: []
      }
    };

    await db.collection('teacherConversations').insertOne(sessionData);

    // FIXED: Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Voice Coach session saved successfully"
    };
  } catch (error) {
    console.error("Error in saveVoiceCoachChatSession:", error);
    return {
      success: false,
      error: error.message || "Failed to save Voice Coach session"
    };
  }
}

/**
 * Save Voice Coach conversation to history
 * @param {Object} formData - Form data containing conversation data
 * @returns {Promise<Object>} - Save result
 */
export async function saveVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const sessionId = formData.get("sessionId");
    const messages = JSON.parse(formData.get("messages") || "[]");
    const sessionType = formData.get("sessionType") || "text";
    const title = formData.get("title") || `Voice Coach Session ${new Date().toLocaleDateString()}`;
    const uploadedFiles = JSON.parse(formData.get("uploadedFiles") || "[]");
    const teacherData = JSON.parse(formData.get("teacherData") || "{}");
    const studentContext = JSON.parse(formData.get("studentContext") || "{}");

    if (!sessionId || !messages.length) {
      return {
        success: false,
        error: "Session ID and messages are required"
      };
    }

    const { db } = await connectToDatabase();
    
    // Calculate conversation stats
    const userMessages = messages.filter(m => m.role === 'user').length;
    const aiMessages = messages.filter(m => m.role === 'assistant').length;
    const totalDuration = messages.length > 0 ? 
      (new Date(messages[messages.length - 1].timestamp) - new Date(messages[0].timestamp)) / 60000 : 0;

    const conversationData = {
      teacherId: new ObjectId(session.user.id),
      sessionId: sessionId,
      title: title,
      sessionType: sessionType,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        isImageResponse: msg.isImageResponse || false,
        metadata: {
          messageType: msg.metadata?.messageType || 'text',
          fileAttachments: msg.metadata?.fileAttachments || [],
          processingTime: msg.metadata?.processingTime || 0
        }
      })),
      uploadedFiles: uploadedFiles.map(file => ({
        filename: file.filename,
        originalName: file.originalName,
        fileType: file.fileType,
        uploadTime: new Date(file.uploadTime)
      })),
      teacherData: {
        grades: teacherData.grades || [],
        subjects: teacherData.subjects || [],
        teachingExperience: teacherData.teachingExperience || "intermediate",
        preferences: teacherData.preferences || {},
        analytics: teacherData.analytics || {}
      },
      studentContext: {
        students: studentContext.students || [],
        classPerformance: studentContext.classPerformance || {},
        learningInsights: studentContext.learningInsights || {}
      },
      conversationStats: {
        totalMessages: messages.length,
        userMessages: userMessages,
        aiMessages: aiMessages,
        totalDuration: Math.round(totalDuration),
        topicsDiscussed: [], // Could be extracted from conversation content
        difficultyLevel: "medium",
        teachingOutcomes: [] // Could be extracted from conversation content
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: false,
        tags: []
      }
    };

    await db.collection('teacherConversations').insertOne(conversationData);

    // Revalidate the history page to show updated data
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Voice Coach conversation saved successfully",
      conversationId: conversationData._id
    };
  } catch (error) {
    console.error("Error in saveVoiceCoachConversation:", error);
    return {
      success: false,
      error: error.message || "Failed to save conversation"
    };
  }
}

/**
 * Get Voice Coach conversation history
 * @param {Object} formData - Form data containing pagination info
 * @returns {Promise<Object>} - Conversation history
 */
export async function getVoiceCoachConversationHistory(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const page = parseInt(formData.get("page")) || 1;
    const limit = parseInt(formData.get("limit")) || 10;
    const sessionType = formData.get("sessionType") || "all";

    const { db } = await connectToDatabase();
    
    // Build query
    const query = { teacherId: new ObjectId(session.user.id) };
    if (sessionType !== "all") {
      query.sessionType = sessionType;
    }

    // Get conversations with pagination
    const conversations = await db.collection('teacherConversations')
      .find(query)
      .sort({ 'metadata.lastMessageAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('teacherConversations')
      .countDocuments(query);

    // Serialize the data
    const serializedConversations = conversations.map(conv => ({
      _id: conv._id.toString(),
      teacherId: conv.teacherId.toString(),
      sessionId: conv.sessionId,
      title: conv.title,
      sessionType: conv.sessionType,
      messageCount: conv.messages.length,
      lastMessage: conv.messages[conv.messages.length - 1]?.content || "",
      lastMessageAt: conv.metadata.lastMessageAt.toISOString(),
      createdAt: conv.metadata.createdAt.toISOString(),
      conversationStats: conv.conversationStats,
      tags: conv.metadata.tags
    }));

    return {
      success: true,
      data: {
        conversations: serializedConversations,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    };
  } catch (error) {
    console.error("Error in getVoiceCoachConversationHistory:", error);
    return {
      success: false,
      error: error.message || "Failed to get conversation history"
    };
  }
}

/**
 * Get a specific Voice Coach conversation
 * @param {Object} formData - Form data containing conversation ID
 * @returns {Promise<Object>} - Conversation details
 */
export async function getVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");

    if (!conversationId) {
      return {
        success: false,
        error: "Conversation ID is required"
      };
    }

    const { db } = await connectToDatabase();
    
    const conversation = await db.collection('teacherConversations')
      .findOne({ 
        _id: new ObjectId(conversationId),
        teacherId: new ObjectId(session.user.id)
      });

    if (!conversation) {
      return {
        success: false,
        error: "Conversation not found"
      };
    }

    // Serialize the conversation data
    const serializedConversation = {
      _id: conversation._id.toString(),
      teacherId: conversation.teacherId.toString(),
      sessionId: conversation.sessionId,
      title: conversation.title,
      sessionType: conversation.sessionType,
      messages: conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        isImageResponse: msg.isImageResponse,
        metadata: msg.metadata
      })),
      uploadedFiles: conversation.uploadedFiles.map(file => ({
        filename: file.filename,
        originalName: file.originalName,
        fileType: file.fileType,
        uploadTime: file.uploadTime.toISOString()
      })),
      teacherData: conversation.teacherData,
      studentContext: conversation.studentContext,
      conversationStats: conversation.conversationStats,
      metadata: {
        ...conversation.metadata,
        createdAt: conversation.metadata.createdAt.toISOString(),
        updatedAt: conversation.metadata.updatedAt.toISOString(),
        lastMessageAt: conversation.metadata.lastMessageAt.toISOString()
      }
    };

    return {
      success: true,
      data: serializedConversation
    };
  } catch (error) {
    console.error("Error in getVoiceCoachConversation:", error);
    return {
      success: false,
      error: error.message || "Failed to get conversation"
    };
  }
}

/**
 * Delete a Voice Coach conversation
 * @param {Object} formData - Form data containing conversation ID
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");

    if (!conversationId) {
      return {
        success: false,
        error: "Conversation ID is required"
      };
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('teacherConversations')
      .deleteOne({ 
        _id: new ObjectId(conversationId),
        teacherId: new ObjectId(session.user.id)
      });

    if (result.deletedCount === 0) {
      return {
        success: false,
        error: "Conversation not found or already deleted"
      };
    }

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Conversation deleted successfully"
    };
  } catch (error) {
    console.error("Error in deleteVoiceCoachConversation:", error);
    return {
      success: false,
      error: error.message || "Failed to delete conversation"
    };
  }
}

/**
 * Update conversation title
 * @param {Object} formData - Form data containing conversation ID and new title
 * @returns {Promise<Object>} - Update result
 */
export async function updateVoiceCoachConversationTitle(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");
    const newTitle = formData.get("title");

    if (!conversationId || !newTitle) {
      return {
        success: false,
        error: "Conversation ID and title are required"
      };
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('teacherConversations')
      .updateOne(
        { 
          _id: new ObjectId(conversationId),
          teacherId: new ObjectId(session.user.id)
        },
        { 
          $set: { 
            title: newTitle,
            'metadata.updatedAt': new Date()
          }
        }
      );

    if (result.matchedCount === 0) {
      return {
        success: false,
        error: "Conversation not found"
      };
    }

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Conversation title updated successfully"
    };
  } catch (error) {
    console.error("Error in updateVoiceCoachConversationTitle:", error);
    return {
      success: false,
      error: error.message || "Failed to update conversation title"
    };
  }
}

/**
 * Debug function to check all conversations in database
 * @returns {Promise<Object>} - Debug info
 */
export async function debugConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();
    
    // Get all conversations for this teacher
    const allConversations = await db.collection('teacherConversations')
      .find({ teacherId: new ObjectId(session.user.id) })
      .toArray();

    // Get all conversations in the database (for debugging)
    const allConversationsInDb = await db.collection('teacherConversations')
      .find({})
      .toArray();

    console.log('Debug - All conversations for teacher:', allConversations.length);
    console.log('Debug - All conversations in DB:', allConversationsInDb.length);
    console.log('Debug - Teacher ID:', session.user.id);

    return {
      success: true,
      data: {
        teacherConversations: allConversations.length,
        totalConversations: allConversationsInDb.length,
        teacherId: session.user.id,
        conversations: allConversations.map(conv => ({
          _id: conv._id.toString(),
          teacherId: conv.teacherId?.toString(),
          sessionId: conv.sessionId,
          title: conv.title,
          sessionType: conv.sessionType,
          messageCount: conv.messages?.length || 0
        }))
      }
    };
  } catch (error) {
    console.error("Error in debugConversations:", error);
    return {
      success: false,
      error: error.message || "Failed to debug conversations"
    };
  }
}

/**
 * Migrate existing conversations to add teacherId field
 * @returns {Promise<Object>} - Migration result
 */
export async function migrateConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();
    
    // Find conversations without teacherId
    const conversationsWithoutTeacherId = await db.collection('teacherConversations')
      .find({ teacherId: { $exists: false } })
      .toArray();

    console.log(`Found ${conversationsWithoutTeacherId.length} conversations without teacherId`);

    if (conversationsWithoutTeacherId.length === 0) {
      return {
        success: true,
        message: "No conversations need migration",
        migrated: 0
      };
    }

    // Update all conversations without teacherId to belong to current teacher
    const result = await db.collection('teacherConversations')
      .updateMany(
        { teacherId: { $exists: false } },
        { 
          $set: { 
            teacherId: new ObjectId(session.user.id),
            'metadata.updatedAt': new Date()
          }
        }
      );

    console.log(`Migrated ${result.modifiedCount} conversations`);

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: `Successfully migrated ${result.modifiedCount} conversations`,
      migrated: result.modifiedCount
    };
  } catch (error) {
    console.error("Error in migrateConversations:", error);
    return {
      success: false,
      error: error.message || "Failed to migrate conversations"
    };
  }
}

// Get real student data for teachers
export async function getStudentsForTeacher() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Get all students from the database
    const students = await db.collection('user')
      .find({ role: 'student' })
      .toArray();

    // Get student progress data
    const progressData = await db.collection('progress')
      .find({})
      .toArray();

    // Get student achievements
    const achievementsData = await db.collection('achievements')
      .find({})
      .toArray();

    // FIXED: Properly serialize all MongoDB data
    const serializedProgressData = progressData.map(item => ({
      ...item,
      _id: item._id.toString(),
      studentId: item.studentId.toString(),
      contentId: item.contentId.toString(),
      createdAt: safeToISOString(item.createdAt),
      updatedAt: safeToISOString(item.updatedAt),
      progress: {
        ...item.progress,
        lastAccessedAt: safeToISOString(item.progress?.lastAccessedAt)
      },
      completionData: item.completionData ? {
        ...item.completionData,
        completedAt: safeToISOString(item.completionData.completedAt)
      } : null,
      metadata: {
        ...item.metadata,
        createdAt: safeToISOString(item.metadata?.createdAt),
        updatedAt: safeToISOString(item.metadata?.updatedAt)
      }
    }));

    const serializedAchievementsData = achievementsData.map(item => ({
      ...item,
      _id: item._id.toString(),
      studentId: item.studentId.toString(),
      earnedAt: safeToISOString(item.earnedAt),
      createdAt: safeToISOString(item.createdAt)
    }));

    // Combine the data with properly serialized progress and achievements
    const studentsWithData = students.map(student => {
      const studentProgress = serializedProgressData.filter(p => p.studentId === student._id.toString());
      const studentAchievements = serializedAchievementsData.filter(a => a.studentId === student._id.toString());
      
      return {
        _id: student._id.toString(),
        name: student.name,
        email: student.email,
        grades: student.grades || [],
        subjects: student.subjects || [],
        role: student.role,
        progress: studentProgress,
        achievements: studentAchievements,
        createdAt: student.createdAt?.toISOString(),
        updatedAt: student.updatedAt?.toISOString()
      };
    });

    return { 
      success: true, 
      data: studentsWithData 
    };
  } catch (error) {
    console.error('Error fetching students for teacher:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}
