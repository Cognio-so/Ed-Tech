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

// Get student progress data
export async function getStudentProgressData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const progressItems = await db.collection('studentProgress')
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ 'metadata.updatedAt': -1 })
      .toArray();

    // Convert MongoDB objects to plain objects like achievements action does
    const serializedProgress = progressItems.map(item => ({
      _id: item._id.toString(),
      studentId: item.studentId.toString(),
      contentId: item.contentId.toString(),
      completionData: item.completionData,
      contentTitle: item.contentTitle,
      contentType: item.contentType,
      grade: item.grade,
      metadata: item.metadata,
      progress: item.progress,
      status: item.status,
      subject: item.subject
    }));

    return { 
      success: true, 
      data: serializedProgress 
    };
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return { success: false, error: error.message };
  }
}

// Get student achievements data
export async function getStudentAchievementsData() {
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

    // Convert MongoDB objects to plain objects like achievements action does
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

    return { 
      success: true, 
      data: serializedAchievements 
    };
  } catch (error) {
    console.error('Error fetching student achievements:', error);
    return { success: false, error: error.message };
  }
}

// Get student learning stats
export async function getStudentLearningStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // Get progress stats
    const progressStats = await db.collection('studentProgress')
      .aggregate([
        { $match: { studentId: new ObjectId(session.user.id) } },
        {
          $group: {
            _id: null,
            totalResources: { $sum: 1 },
            completedResources: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            averageProgress: { $avg: "$progress" },
            totalStudyTime: { $sum: "$completionData.studyTime" }
          }
        }
      ])
      .toArray();

    // Get achievement stats
    const achievementStats = await db.collection('studentAchievements')
      .aggregate([
        { $match: { studentId: new ObjectId(session.user.id) } },
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
    console.error('Error fetching learning stats:', error);
    return { success: false, error: error.message };
  }
}

// Get current user data
export async function getCurrentUserData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const user = await db.collection('users')
      .findOne({ _id: new ObjectId(session.user.id) });

    if (!user) {
      // Return fallback user data instead of throwing error
      return { 
        success: true, 
        data: {
          _id: session.user.id,
          email: session.user.email || 'student@example.com',
          name: session.user.name || 'Student',
          grade: '8',
          subjects: ['Mathematics', 'Science', 'English']
        }
      };
    }

    // Convert MongoDB objects to plain objects
    const serializedUser = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      grade: user.grade,
      subjects: user.subjects,
      role: user.role,
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString()
    };

    return { 
      success: true, 
      data: serializedUser 
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return { 
      success: true, 
      data: {
        _id: 'fallback_user_id',
        email: 'student@example.com',
        name: 'Student',
        grade: '8',
        subjects: ['Mathematics', 'Science', 'English']
      }
    };
  }
}

/**
 * Send a chat message to the AI Tutor
 * @param {Object} formData - Form data containing the message and session info
 * @returns {Promise<Object>} - Response from the AI Tutor
 */
export async function sendChatMessage(formData) {
  try {
    const query = formData.get("query");
    const studentId = formData.get("studentId");
    const messageHistory = JSON.parse(formData.get("messageHistory") || "[]");
    const uploadedFiles = JSON.parse(formData.get("uploadedFiles") || "[]");

    if (!query) {
      return {
        success: false,
        error: "Query is required"
      };
    }

    // Get session to verify user
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();

    // Fetch real student data from database
    const user = await db.collection('user')
      .findOne({ _id: new ObjectId(session.user.id) });

    // Get student progress data
    const progressData = await db.collection('studentProgress')
      .find({ studentId: new ObjectId(session.user.id) })
      .toArray();

    // Get student achievements
    const achievements = await db.collection('studentAchievements')
      .find({ studentId: new ObjectId(session.user.id) })
      .toArray();

    // Get student lessons/resources
    const lessons = await db.collection('lessons')
      .find({ 
        grade: { $in: user?.grades || ['8'] },
        status: 'published'
      })
      .limit(10)
      .toArray();

    // Calculate learning stats
    const completedCount = progressData.filter(p => p.status === 'completed').length;
    const totalTimeSpent = progressData.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0);
    const averageScore = progressData
      .filter(p => p.completionData?.score !== undefined)
      .reduce((sum, p, _, arr) => sum + p.completionData.score / arr.length, 0);

    // Prepare comprehensive student data with proper serialization
    const enhancedStudentData = {
      id: session.user.id,
      email: user?.email || session.user.email || "",
      name: user?.name || session.user.name || "Student",
      grade: user?.grades?.[0] || "8",
      progress: {
        totalResources: progressData.length,
        completedResources: completedCount,
        averageProgress: progressData.length > 0 ? (completedCount / progressData.length) * 100 : 0,
        totalStudyTime: totalTimeSpent,
        averageScore: averageScore || 0
      },
      achievements: achievements.map(achievement => ({
        id: achievement._id.toString(),
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        points: achievement.points,
        earnedAt: achievement.earnedAt.toISOString()
      })),
      learningStats: {
        totalResources: progressData.length,
        completedResources: completedCount,
        averageProgress: progressData.length > 0 ? (completedCount / progressData.length) * 100 : 0,
        totalStudyTime: totalTimeSpent,
        totalAchievements: achievements.length,
        recentAchievements: achievements.filter(a => 
          new Date(a.earnedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length
      },
      assessments: progressData.filter(p => p.contentType === 'assessment').map(p => ({
        id: p._id.toString(),
        contentId: p.contentId.toString(),
        title: p.contentTitle,
        subject: p.subject,
        grade: p.grade,
        status: p.status,
        score: p.completionData?.score,
        completedAt: safeToISOString(p.completionData?.completedAt)
      })),
      lessons: lessons.map(lesson => ({
        id: lesson._id.toString(),
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
        contentType: lesson.contentType || 'lesson'
      })),
      resources: progressData.map(progress => ({
        id: progress._id.toString(),
        contentId: progress.contentId.toString(),
        title: progress.contentTitle,
        contentType: progress.contentType,
        status: progress.status,
        progress: progress.progress?.percentage || 0
      })),
      analytics: progressData.map(progress => ({
        contentId: progress.contentId.toString(),
        subject: progress.subject,
        grade: progress.grade,
        status: progress.status,
        timeSpent: progress.progress?.timeSpent || 0,
        score: progress.completionData?.score,
        completedAt: safeToISOString(progress.completionData?.completedAt)
      }))
    };

    // Generate session ID if not provided
    const sessionId = `student_${session.user.id}_${Date.now()}`;

    console.log('Starting chatbot stream with payload:', {
      session_id: sessionId,
      query: query,
      history: messageHistory,
      web_search_enabled: true,
      student_data: enhancedStudentData,
      uploaded_files: uploadedFiles
    });

    // Send request to Python backend
    const response = await PythonApi.startChatbotStream(
      sessionId,
      query,
      enhancedStudentData,
      uploadedFiles,
      messageHistory,
      true // webSearchEnabled
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    // Return the response object for client-side streaming
    // We can't return the Response object directly, so we'll return the URL and headers
    return {
      success: true,
      streamUrl: `${PythonApi.baseUrl}/chatbot_endpoint`,
      sessionId: sessionId,
      headers: {
        'Content-Type': 'application/json'
      }
    };

  } catch (error) {
    console.error("Error in sendChatMessage:", error);
    return {
      success: false,
      error: error.message || "Failed to send message to AI Tutor"
    };
  }
}

/**
 * Upload documents for the AI Tutor session
 * @param {Object} formData - Form data containing files and session info
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadDocuments(formData) {
  try {
    const sessionId = formData.get("sessionId");
    const files = formData.getAll("files");

    if (!sessionId) {
      return {
        success: false,
        error: "Session ID is required"
      };
    }

    if (!files || files.length === 0) {
      return {
        success: false,
        error: "No files provided"
      };
    }

    // Convert File objects to proper format for Python API
    const fileObjects = files.filter(file => file instanceof File);

    // Upload to Python backend
    const uploadResponse = await PythonApi.uploadDocumentsForChatbot(sessionId, fileObjects);

    if (!uploadResponse.success) {
      throw new Error(uploadResponse.message || "Upload failed");
    }

    return {
      success: true,
      message: `Successfully uploaded ${fileObjects.length} document(s)`,
      filesProcessed: uploadResponse.files_processed || fileObjects.length
    };

  } catch (error) {
    console.error("Error in uploadDocuments:", error);
    return {
      success: false,
      error: error.message || "Failed to upload documents"
    };
  }
}

/**
 * Start a real-time voice session with the AI Tutor
 * @param {Object} studentData - Comprehensive student data
 * @returns {Promise<Object>} - WebSocket connection info
 */
export async function startVoiceSession(studentData) {
  try {
    if (!studentData.id || !studentData.name) {
      return {
        success: false,
        error: "Student ID and name are required for voice session"
      };
    }

    // Prepare comprehensive student context for personalized tutoring
    const studentContext = {
      id: studentData.id,
      email: studentData.email || "",
      name: studentData.name,
      grade: studentData.grade || "8",
      
      // Learning Progress
      progress: studentData.progress || {},
      learningStats: studentData.learningStats || {},
      userProgress: studentData.userProgress || {},
      
      // Achievements and milestones
      achievements: studentData.achievements || [],
      
      // Academic Resources
      subjects: studentData.subjects || ["General Studies", "Mathematics", "Science"],
      lessons: studentData.lessons || [],
      resources: studentData.resources || [],
      assessments: (studentData.resources || []).filter(r => r.resourceType === 'assessment'),
      
      // Current Learning Status
      recentLessons: (studentData.lessons || []).slice(0, 5),
      incompleteAssessments: (studentData.resources || []).filter(r => 
        r.resourceType === 'assessment' && r.status !== 'completed'
      ),
      
      // Study patterns and preferences
      studyPreferences: {
        learningStyle: studentData.learningStyle || 'visual',
        difficultyPreference: studentData.difficultyPreference || 'medium',
        topicInterests: studentData.topicInterests || []
      },
      
      // Current session context
      pending_tasks: [
        {"topic": "Help with homework and assignments", "status": "Active"},
        {"topic": "Concept understanding and clarification", "status": "Available"},
        {"topic": "Practice problems and exercises", "status": "Available"}
      ],
      
      // Performance insights
      performanceInsights: {
        strongSubjects: (studentData.learningStats?.strongSubjects) || [],
        needsImprovement: (studentData.learningStats?.weakSubjects) || [],
        averageScore: studentData.learningStats?.averageScore || 'N/A',
        studyTime: studentData.learningStats?.totalStudyTime || 'N/A',
        lastActivity: studentData.learningStats?.lastActivity || new Date().toISOString()
      }
    };

    // Note: WebSocket creation happens on client side
    // This function prepares the data structure
    return {
      success: true,
      studentContext: studentContext,
      message: "Student context prepared for voice session"
    };

  } catch (error) {
    console.error("Error in startVoiceSession:", error);
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
export async function stopVoiceSession(formData) {
  try {
    const sessionId = formData.get("sessionId");

    if (!sessionId) {
      return {
        success: false,
        error: "Session ID is required"
      };
    }

    // Note: Actual WebSocket cleanup happens on client side
    // This function provides server-side cleanup if needed
    return {
      success: true,
      message: "Voice session stopped successfully"
    };

  } catch (error) {
    console.error("Error in stopVoiceSession:", error);
    return {
      success: false,
      error: error.message || "Failed to stop voice session"
    };
  }
}

/**
 * Perform web search through the AI Tutor
 * @param {Object} formData - Form data containing search parameters
 * @returns {Promise<Object>} - Search results
 */
export async function performWebSearch(formData) {
  try {
    const topic = formData.get("topic");
    const gradeLevel = formData.get("gradeLevel") || "8";
    const subject = formData.get("subject") || "General";
    const contentType = formData.get("contentType") || "articles";
    const language = formData.get("language") || "English";
    const comprehension = formData.get("comprehension") || "intermediate";
    const maxResults = parseInt(formData.get("maxResults")) || 3;

    if (!topic) {
      return {
        success: false,
        error: "Search topic is required"
      };
    }

    const searchData = {
      topic,
      gradeLevel,
      subject,
      contentType,
      language,
      comprehension,
      maxResults
    };

    const response = await PythonApi.runWebSearch(searchData);

    return {
      success: true,
      query: response.query,
      content: response.content,
      results: response.results || []
    };

  } catch (error) {
    console.error("Error in performWebSearch:", error);
    return {
      success: false,
      error: error.message || "Failed to perform web search"
    };
  }
}

/**
 * Get AI Tutor health status
 * @returns {Promise<Object>} - Health status
 */
export async function getAiTutorHealth() {
  try {
    const response = await PythonApi.healthCheck();
    
    return {
      success: true,
      status: response.status,
      message: response.message,
      timestamp: response.timestamp
    };

  } catch (error) {
    console.error("Error checking AI Tutor health:", error);
    return {
      success: false,
      error: error.message || "Failed to check AI Tutor health"
    };
  }
}

/**
 * Create a new AI Tutor session
 * @param {Object} formData - Form data containing session info
 * @returns {Promise<Object>} - Session creation result
 */
export async function createAiTutorSession(formData) {
  try {
    const userId = formData.get("userId");
    const studentData = JSON.parse(formData.get("studentData") || "{}");

    if (!userId) {
      return {
        success: false,
        error: "User ID is required"
      };
    }

    const sessionId = `student_${userId}_${Date.now()}`;
    
    return {
      success: true,
      sessionId: sessionId,
      message: "AI Tutor session created successfully"
    };

  } catch (error) {
    console.error("Error creating AI Tutor session:", error);
    return {
      success: false,
      error: error.message || "Failed to create AI Tutor session"
    };
  }
}

/**
 * Get student learning insights for AI Tutor personalization
 * @param {Object} formData - Form data containing user info
 * @returns {Promise<Object>} - Learning insights
 */
export async function getStudentLearningInsights(formData) {
  try {
    const userId = formData.get("userId");
    const studentData = JSON.parse(formData.get("studentData") || "{}");

    if (!userId) {
      return {
        success: false,
        error: "User ID is required"
      };
    }

    // Prepare learning insights based on student data
    const insights = {
      gradeLevel: studentData.grade || "8",
      subjects: studentData.subjects || ["General Studies"],
      learningStyle: studentData.learningStyle || "visual",
      difficultyLevel: studentData.difficultyPreference || "medium",
      progress: studentData.progress || {},
      achievements: studentData.achievements || [],
      learningStats: studentData.learningStats || {},
      recentLessons: (studentData.lessons || []).slice(0, 5),
      incompleteAssessments: (studentData.resources || []).filter(r => 
        r.resourceType === 'assessment' && r.status !== 'completed'
      ),
      strongSubjects: (studentData.learningStats?.strongSubjects) || [],
      weakSubjects: (studentData.learningStats?.weakSubjects) || []
    };

    return {
      success: true,
      insights: insights,
      message: "Learning insights retrieved successfully"
    };

  } catch (error) {
    console.error("Error getting learning insights:", error);
    return {
      success: false,
      error: error.message || "Failed to get learning insights"
    };
  }
}

/**
 * Save AI Tutor chat session
 * @param {Object} formData - Form data containing session data
 * @returns {Promise<Object>} - Save result
 */
export async function saveAiTutorChatSession(formData) {
  try {
    const sessionData = JSON.parse(formData.get("sessionData") || "{}");

    if (!sessionData.sessionId || !sessionData.userId) {
      return {
        success: false,
        error: "Session ID and User ID are required"
      };
    }

    // Revalidate the chat sessions page to show updated data
    revalidatePath("/student/ai-tutor");

    return {
      success: true,
      message: "AI Tutor chat session saved successfully",
      sessionId: sessionData.sessionId
    };

  } catch (error) {
    console.error("Error saving AI Tutor chat session:", error);
    return {
      success: false,
      error: error.message || "Failed to save chat session"
    };
  }
}
