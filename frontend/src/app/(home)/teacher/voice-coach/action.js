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

    // FIX: Read and parse the uploaded file names from the formData.
    const uploadedFilesStr = formData.get('uploadedFiles');
    const uploadedFiles = uploadedFilesStr ? JSON.parse(uploadedFilesStr) : [];

    // Use PythonApiClient to send message
    const response = await PythonApiClient.startTeacherVoiceChat(
      studentData,
      sessionId,
      message,
      [], // history is passed empty, manage in state if needed for long-term context
      uploadedFiles, // Pass the array of filenames here
      true
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
