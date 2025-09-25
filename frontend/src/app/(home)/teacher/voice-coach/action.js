"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import PythonApiClient from "@/lib/PythonApi";
import { ObjectId } from "mongodb";

// Get current teacher data
export async function getCurrentTeacherData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    const user = await db.collection('user').findOne({ _id: userId });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      data: {
        _id: user._id.toString(), // Convert ObjectId to string
        email: user.email,
        name: user.name || user.email,
        grades: user.grades || ['Grade 8', 'Grade 9', 'Grade 10'],
        subjects: user.subjects || ['Mathematics', 'Science', 'English']
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get students for teacher
export async function getStudentsForTeacher() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    
    // Get all students (not filtered by teacherId since that field might not exist)
    const students = await db.collection('user')
      .find({ role: 'student' })
      .toArray();

    // If no students found, return empty array
    if (students.length === 0) {
      return {
        success: true,
        data: []
      };
    }

    // Get progress data for all students to calculate performance
    const studentIds = students.map(s => new ObjectId(s._id));
    const progressData = await db.collection('progress')
      .find({ studentId: { $in: studentIds } })
      .toArray();

    // Group progress data by student
    const progressByStudent = {};
    progressData.forEach(progress => {
      const studentId = progress.studentId.toString();
      if (!progressByStudent[studentId]) {
        progressByStudent[studentId] = [];
      }
      progressByStudent[studentId].push(progress);
    });

    // Calculate performance for each student
    const calculateStudentPerformance = (studentProgress) => {
      if (!studentProgress || studentProgress.length === 0) {
        return {
          overall: 75,
          assignments: 80,
          quizzes: 70,
          participation: 85
        };
      }

      const totalScore = studentProgress.reduce((sum, progress) => {
        return sum + (progress.score || 0);
      }, 0);
      
      const averageScore = totalScore / studentProgress.length;
      const assignmentScore = studentProgress.filter(p => p.type === 'assignment').length > 0 
        ? studentProgress.filter(p => p.type === 'assignment').reduce((sum, p) => sum + (p.score || 0), 0) / studentProgress.filter(p => p.type === 'assignment').length
        : 80;
      const quizScore = studentProgress.filter(p => p.type === 'quiz').length > 0
        ? studentProgress.filter(p => p.type === 'quiz').reduce((sum, p) => sum + (p.score || 0), 0) / studentProgress.filter(p => p.type === 'quiz').length
        : 70;
      const participationScore = studentProgress.filter(p => p.type === 'participation').length > 0
        ? studentProgress.filter(p => p.type === 'participation').reduce((sum, p) => sum + (p.score || 0), 0) / studentProgress.filter(p => p.type === 'participation').length
        : 85;

      return {
        overall: Math.round(averageScore || 75),
        assignments: Math.round(assignmentScore),
        quizzes: Math.round(quizScore),
        participation: Math.round(participationScore)
      };
    };

    const processedStudents = students.map(student => {
      const studentProgress = progressByStudent[student._id.toString()] || [];
      const performance = calculateStudentPerformance(studentProgress);

      return {
        _id: student._id.toString(), // Convert ObjectId to string
        name: student.name || student.email,
        email: student.email,
        grades: student.grades || [],
        subjects: student.subjects || [],
        performance: performance,
        lastActive: student.lastLogin || student.createdAt || new Date().toISOString(),
        group: student.group || 'Default',
        notes: student.notes || ''
      };
    });

    return {
      success: true,
      data: processedStudents
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get teacher progress data (content created)
export async function getTeacherProgressData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    const [lessons, assessments, presentations, comics, images, videos, webSearches] = await Promise.all([
      db.collection('contents').find({ userId: userId.toString() }).toArray(),
      db.collection('assessments').find({ 
        $or: [
          { userId: userId.toString() },
          { userId: userId },
          { teacherId: userId.toString() },
          { teacherId: userId }
        ]
      }).toArray(),
      db.collection('presentations').find({ userId: userId.toString() }).toArray(),
      db.collection('comics').find({ userId: userId }).toArray(),
      db.collection('images').find({ userId: userId.toString() }).toArray(),
      db.collection('videos').find({ userId: userId.toString() }).toArray(),
      db.collection('websearches').find({ userId: userId.toString() }).toArray()
    ]);

    const serializeObjectIds = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (obj instanceof ObjectId) return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeObjectIds);
      if (typeof obj === 'object') {
        const serialized = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = serializeObjectIds(value);
        }
        return serialized;
      }
      return obj;
    };

    const allContent = [
      ...lessons.map(item => serializeObjectIds({ ...item, contentType: 'lesson' })),
      ...assessments.map(item => serializeObjectIds({ ...item, contentType: 'assessment' })),
      ...presentations.map(item => serializeObjectIds({ ...item, contentType: 'presentation' })),
      ...comics.map(item => serializeObjectIds({ ...item, contentType: 'comic' })),
      ...images.map(item => serializeObjectIds({ ...item, contentType: 'image' })),
      ...videos.map(item => serializeObjectIds({ ...item, contentType: 'video' })),
      ...webSearches.map(item => serializeObjectIds({ ...item, contentType: 'webSearch' }))
    ];

    return {
      success: true,
      data: allContent
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get teacher achievements data
export async function getTeacherAchievementsData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get achievements from various collections
    const achievements = await db.collection('achievements')
      .find({ userId: userId.toString() })
      .toArray();

    // Helper function to serialize ObjectIds
    const serializeObjectIds = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (obj instanceof ObjectId) return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeObjectIds);
      if (typeof obj === 'object') {
        const serialized = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = serializeObjectIds(value);
        }
        return serialized;
      }
      return obj;
    };

    return {
      success: true,
      data: achievements.map(achievement => serializeObjectIds(achievement))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get teacher learning stats
export async function getTeacherLearningStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    const [lessons, assessments, presentations, comics, images, videos, webSearches] = await Promise.all([
      db.collection('contents').countDocuments({ userId: userId.toString() }),
      db.collection('assessments').countDocuments({ 
        $or: [
          { userId: userId.toString() },
          { userId: userId },
          { teacherId: userId.toString() },
          { teacherId: userId }
        ]
      }),
      db.collection('presentations').countDocuments({ userId: userId.toString() }),
      db.collection('comics').countDocuments({ userId: userId }),
      db.collection('images').countDocuments({ userId: userId.toString() }),
      db.collection('videos').countDocuments({ userId: userId.toString() }),
      db.collection('websearches').countDocuments({ userId: userId.toString() })
    ]);

    const stats = {
      totalLessons: lessons,
      totalAssessments: assessments,
      totalPresentations: presentations,
      totalComics: comics,
      totalImages: images,
      totalVideos: videos,
      totalWebSearches: webSearches,
      totalContent: lessons + assessments + presentations + comics + images + videos + webSearches
    };

    return {
      success: true,
      data: stats
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create voice coach session
export async function createVoiceCoachSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = formData.get('userId');
    const teacherData = JSON.parse(formData.get('teacherData'));

    const sessionId = `voice_coach_${userId}_${Date.now()}`;

    return {
      success: true,
      sessionId: sessionId,
      message: "Session created successfully"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send a chat message to the Voice Coach - OPTIMIZED FOR MINIMAL DATA
 * @param {Object} formData - Form data containing the message and session info
 * @returns {Promise<Object>} - Response from the Voice Coach
 */
// Send voice coach message
export async function sendVoiceCoachMessage(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const message = formData.get('message');
    const sessionId = formData.get('sessionId');
    const studentData = JSON.parse(formData.get('studentData'));

    // FIXED: Create teacher data that matches backend schema exactly
    const minimalTeacherData = {
      // Basic teacher info
      teacher_name: teacherDataResult.data.name,
      teacher_id: teacherDataResult.data._id,
      email: teacherDataResult.data.email,
      grades: teacherDataResult.data.grades || [],
      subjects: teacherDataResult.data.subjects || [],
      
      // Student data - exactly as backend expects
      student_details_with_reports: (studentData.students || []).slice(0, 10).map(student => ({
        student_name: student.name,
        student_id: student._id,
        email: student.email,
        grades: student.grades || [],
        subjects: student.subjects || [],
        performance: {
          overall: student.performance?.overall || 75
        }
      })),
      
      student_performance: {
        total_students: (studentData.students || []).length,
        average_performance: studentData.studentOverview?.averageProgress || 75
      },
      
      student_overview: {
        total_students: (studentData.students || []).length,
        average_progress: studentData.studentOverview?.averageProgress || 75
      },
      
      top_performers: (studentData.students || [])
        .sort((a, b) => (b.performance?.overall || 75) - (a.performance?.overall || 75))
        .slice(0, 3)
        .map(student => ({
          name: student.name,
          performance: student.performance?.overall || 75
        })),
      
      subject_performance: (studentData.students || []).reduce((acc, student) => {
        student.subjects?.forEach(subject => {
          if (!acc[subject]) {
            acc[subject] = { total: 0, count: 0 };
          }
          acc[subject].total += student.performance?.overall || 75;
          acc[subject].count += 1;
        });
        return acc;
      }, {}),
      
      behavior_analysis: {},
      attendance_data: {},
      
      // Content data
      generated_content_details: [{
        title: "Sample Content",
        total_content: studentData.media_counts?.totalContent || 0,
        content_types: {
          comics: studentData.media_counts?.comics || 0,
          images: studentData.media_counts?.images || 0,
          slides: studentData.media_counts?.slides || 0,
          videos: studentData.media_counts?.videos || 0
        }
      }],
      
      assessment_details: [],
      
      // Media data
      media_toolkit: {
        comics: studentData.media_counts?.comics || 0,
        images: studentData.media_counts?.images || 0,
        slides: studentData.media_counts?.slides || 0,
        videos: studentData.media_counts?.videos || 0,
        webSearch: studentData.media_counts?.webSearch || 0
      },
      
      media_counts: {
        comics: studentData.media_counts?.comics || 0,
        images: studentData.media_counts?.images || 0,
        slides: studentData.media_counts?.slides || 0,
        videos: studentData.media_counts?.videos || 0,
        webSearch: studentData.media_counts?.webSearch || 0
      },
      
      progress_data: {},
      feedback_data: [],
      learning_analytics: {
        total_lessons: studentData.learning_analytics?.totalLessons || 0,
        total_assessments: studentData.learning_analytics?.totalAssessments || 0
      }
    };

    console.log('Sending message to Voice Coach with schema-matched data:', { 
      message, 
      sessionId, 
      teacherData: {
        teacherName: minimalTeacherData.teacher_name,
        studentCount: minimalTeacherData.student_details_with_reports.length,
        dataSize: JSON.stringify(minimalTeacherData).length,
        schemaFields: Object.keys(minimalTeacherData)
      }
    });

    // FIXED: Pass history and uploadedFiles to the API call
    const response = await PythonApi.startTeacherChat(
      minimalTeacherData, 
      sessionId, 
      message, 
      history, 
      uploadedFiles
    );

    if (response.ok) {
      const reader = response.body.getReader();
      let result = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text_chunk') {
                result += data.content;
              } else if (data.type === 'done') {
                break;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }

      return {
        success: true,
        response: result
      };
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Save voice coach chat session
export async function saveVoiceCoachChatSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const sessionId = formData.get('sessionId');
    const messages = JSON.parse(formData.get('messages'));
    const sessionType = formData.get('sessionType');

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    await db.collection('teacherConversations').insertOne({
      sessionId: sessionId,
      teacherId: userId.toString(),
      messages: messages,
      sessionType: sessionType,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    await db.collection('teacherConversations').insertOne(sessionId);

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
 * Debug function to check database collections and counts
 * @returns {Promise<Object>} - Debug info about database collections
 */
export async function debugDatabaseCollections() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();
    
    // Get counts for different collections
    const [userCount, contentCount, progressCount, achievementCount] = await Promise.all([
      db.collection('user').countDocuments(),
      db.collection('contents').countDocuments(),
      db.collection('progress').countDocuments(),
      db.collection('achievements').countDocuments()
    ]);

    // Get user role counts
    const [studentCount, teacherCount] = await Promise.all([
      db.collection('user').countDocuments({ role: 'student' }),
      db.collection('user').countDocuments({ role: 'teacher' })
    ]);

    return {
      success: true,
      data: {
        userCounts: {
          total: userCount,
          students: studentCount,
          teachers: teacherCount
        },
        teacherContentCounts: {
          contents: contentCount,
          progress: progressCount,
          achievements: achievementCount
        }
      }
    };
  } catch (error) {
    console.error("Error in debugDatabaseCollections:", error);
    return {
      success: false,
      error: error.message || "Failed to get database collections info"
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
      message: "Session saved successfully"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Upload documents to voice coach
export async function uploadDocumentsToVoiceCoach(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const sessionId = formData.get('sessionId');
    const files = formData.getAll('files');

    const response = await PythonApiClient.uploadDocumentsForTeacherChatbot(sessionId, files);

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Start voice coach session
export async function startVoiceCoachSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const teacherData = JSON.parse(formData.get('teacherData'));

    const response = await PythonApiClient.startTeacherVoiceSession(teacherData);

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Stop voice coach session
export async function stopVoiceCoachSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    return {
      success: true,
      message: "Session stopped successfully"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Perform voice coach web search
export async function performVoiceCoachWebSearch(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const searchData = JSON.parse(formData.get('searchData'));

    const response = await PythonApiClient.performWebSearch(searchData);

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get voice coach health
export async function getVoiceCoachHealth() {
  try {
    const response = await PythonApiClient.getHealth();

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get teacher learning insights
export async function getTeacherLearningInsights() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get insights from various collections
    const insights = await db.collection('insights')
      .find({ userId: userId.toString() })
      .toArray();

    return {
      success: true,
      data: insights
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Debug function to check database collections and data
export async function debugDatabaseCollections() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get all collections
    const collections = await db.listCollections().toArray();

    // Check user collection
    const totalUsers = await db.collection('user').countDocuments();
    const totalStudents = await db.collection('user').countDocuments({ role: 'student' });
    const totalTeachers = await db.collection('user').countDocuments({ role: 'teacher' });

    // Check content collections
    const contentCounts = await Promise.all([
      db.collection('contents').countDocuments(),
      db.collection('assessments').countDocuments(),
      db.collection('presentations').countDocuments(),
      db.collection('comics').countDocuments(),
      db.collection('images').countDocuments(),
      db.collection('videos').countDocuments(),
      db.collection('websearches').countDocuments(),
      db.collection('progress').countDocuments()
    ]);

    // Check teacher's content specifically
    const teacherContentCounts = await Promise.all([
      db.collection('contents').countDocuments({ userId: userId.toString() }),
      db.collection('assessments').countDocuments({ userId: userId.toString() }),
      db.collection('presentations').countDocuments({ userId: userId.toString() }),
      db.collection('comics').countDocuments({ userId: userId }),
      db.collection('images').countDocuments({ userId: userId.toString() }),
      db.collection('videos').countDocuments({ userId: userId.toString() }),
      db.collection('websearches').countDocuments({ userId: userId.toString() })
    ]);

    // Helper function to serialize ObjectIds
    const serializeObjectIds = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (obj instanceof ObjectId) return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeObjectIds);
      if (typeof obj === 'object') {
        const serialized = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = serializeObjectIds(value);
        }
        return serialized;
      }
      return obj;
    };

    // Get sample data and serialize ObjectIds
    const sampleStudents = await db.collection('user').find({ role: 'student' }).limit(3).toArray();
    const sampleContents = await db.collection('contents').find({ userId: userId.toString() }).limit(3).toArray();

    const serializedStudents = sampleStudents.map(s => serializeObjectIds({
      _id: s._id,
      name: s.name,
      email: s.email,
      role: s.role
    }));

    const serializedContents = sampleContents.map(c => serializeObjectIds({
      _id: c._id,
      title: c.title,
      userId: c.userId
    }));

    return {
      success: true,
      data: {
        collections: collections.map(c => c.name),
        userCounts: { total: totalUsers, students: totalStudents, teachers: totalTeachers },
        contentCounts: {
          contents: contentCounts[0],
          assessments: contentCounts[1],
          presentations: contentCounts[2],
          comics: contentCounts[3],
          images: contentCounts[4],
          videos: contentCounts[5],
          webSearches: contentCounts[6],
          progress: contentCounts[7]
        },
        teacherContentCounts: {
          contents: teacherContentCounts[0],
          assessments: teacherContentCounts[1],
          presentations: teacherContentCounts[2],
          comics: teacherContentCounts[3],
          images: teacherContentCounts[4],
          videos: teacherContentCounts[5],
          webSearches: teacherContentCounts[6]
        }
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
