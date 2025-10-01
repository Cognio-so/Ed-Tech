'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

function normalizeGrades(userGrades) {
  const normalizedGrades = [];
  
  userGrades.forEach(grade => {
    normalizedGrades.push(grade);
    
    if (grade.startsWith('Grade ')) {
      const withoutGrade = grade.replace('Grade ', '');
      if (/^\d+$/.test(withoutGrade)) {
        normalizedGrades.push(withoutGrade);
      }
    } else if (/^\d+$/.test(grade)) {
      const withGrade = `Grade ${grade}`;
      normalizedGrades.push(withGrade);
    }
  });
  
  return [...new Set(normalizedGrades)];
}

export async function getAllStudentContent() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const lessonsCollection = db.collection('lessons');
    const progressCollection = db.collection('progress');

    const user = await usersCollection.findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { grades: 1 } }
    );
    
    if (!user || !user.grades || user.grades.length === 0) {
      return {
        success: false,
        error: 'No grade assigned. Please contact administration to add your grade.',
        lessons: []
      };
    }

    const normalizedGrades = normalizeGrades(user.grades);

    // FIXED: Fetch ALL content from lessons collection only (not from individual collections)
    const lessons = await lessonsCollection
      .find({ 
        grade: { $in: normalizedGrades },
        status: 'published'
      })
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    const allContentIds = lessons.map(lesson => lesson._id);

    const progressRecords = await progressCollection
      .find({ 
        studentId: new ObjectId(session.user.id),
        contentId: { $in: allContentIds }
      })
      .toArray();

    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    // FIXED: Transform ALL lessons (including comics, images, videos, etc.) into a unified format
    const transformedLessons = lessons.map(lesson => {
      const progress = progressMap[lesson._id.toString()];
      
      // Determine resource type based on contentType or content fields
      let resourceType = 'content';
      if (lesson.assessmentId || lesson.assessmentContent) {
        resourceType = 'assessment';
      } else if (lesson.contentType) {
        resourceType = lesson.contentType; // This will be 'comic', 'image', 'video', 'slides', etc.
      } else if (lesson.imageUrls && lesson.imageUrls.length > 0) {
        resourceType = 'comic';
      } else if (lesson.imageUrl) {
        resourceType = 'image';
      } else if (lesson.videoUrl) {
        resourceType = 'video';
      } else if (lesson.presentationUrl) {
        resourceType = 'slides';
      }

      return {
        _id: lesson._id.toString(),
        resourceId: lesson._id.toString(),
        teacherId: lesson.teacherId?.toString() || lesson.userId?.toString(),
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
        topic: lesson.topic,
        description: lesson.lessonDescription || lesson.description,
        content: lesson.generatedContent || lesson.contentData || lesson.assessmentContent || lesson.content || '',
        resourceType: resourceType,
        difficulty: lesson.difficulty,
        language: lesson.language,
        estimatedTimeMinutes: lesson.duration || 30,
        rating: 4.5,
        views: lesson.metadata?.viewCount || 0,
        likes: 0,
        metadata: {
          ...lesson.metadata,
          createdAt: lesson.metadata?.createdAt?.toISOString?.() || lesson.metadata?.createdAt,
          updatedAt: lesson.metadata?.updatedAt?.toISOString?.() || lesson.metadata?.updatedAt
        },
        status: lesson.status,
        progress: progress ? {
          currentStep: progress.progress?.currentStep || 0,
          totalSteps: progress.progress?.totalSteps || 1,
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: progress.progress?.lastAccessedAt?.toISOString?.() || progress.progress?.lastAccessedAt,
          status: progress.status,
          completedAt: progress.completionData?.completedAt?.toISOString?.() || progress.completionData?.completedAt,
          score: progress.completionData?.score,
          attempts: progress.metadata?.attempts || 0,
          bookmarked: progress.metadata?.bookmarked || false
        } : null,
        
        // Comic fields
        panels: lesson.panels,
        imageUrls: lesson.imageUrls,
        images: lesson.images,
        cloudinaryPublicIds: lesson.cloudinaryPublicIds,
        numPanels: lesson.numPanels,
        comicType: lesson.comicType,
        instruction: lesson.instruction,
        
        // Image fields
        imageUrl: lesson.imageUrl,
        imageBase64: lesson.imageBase64,
        visualType: lesson.visualType,
        instructions: lesson.instructions,
        difficultyFlag: lesson.difficultyFlag,
        cloudinaryPublicId: lesson.cloudinaryPublicId,
        
        // Slides/Presentation fields
        presentationUrl: lesson.presentationUrl,
        slideImages: lesson.slideImages,
        slidesCount: lesson.slidesCount || lesson.slideCount,
        slideCount: lesson.slideCount,
        template: lesson.template,
        verbosity: lesson.verbosity,
        includeImages: lesson.includeImages,
        downloadUrl: lesson.downloadUrl,
        taskId: lesson.taskId,
        taskStatus: lesson.taskStatus,
        
        // Video fields
        videoUrl: lesson.videoUrl,
        thumbnailUrl: lesson.thumbnailUrl,
        voiceName: lesson.voiceName,
        talkingPhotoName: lesson.talkingPhotoName,
        videoId: lesson.videoId,
        voiceId: lesson.voiceId,
        talkingPhotoId: lesson.talkingPhotoId,
        
        // Assessment fields
        assessmentContent: lesson.assessmentContent,
        assessmentId: lesson.assessmentId,
        
        // Web search fields
        searchResults: lesson.searchResults,
        searchQuery: lesson.searchQuery
      };
    });

    // FIXED: Return only transformed lessons (no separate comics array)
    const allContent = transformedLessons.sort((a, b) => {
      const dateA = new Date(a.metadata?.createdAt || 0);
      const dateB = new Date(b.metadata?.createdAt || 0);
      return dateB - dateA;
    });

    return {
      success: true,
      lessons: allContent
    };
  } catch (error) {
    console.error('Error fetching content:', error);
    throw new Error(error.message || 'Failed to fetch content');
  }
}

export async function getLessonById(lessonId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    
    const comicsCollection = db.collection('comics');
    let content = await comicsCollection.findOne({ _id: new ObjectId(lessonId) });
    
    if (content) {
      return {
        success: true,
        content: {
          ...content,
          resourceType: 'comic'
        }
      };
    }
    
    const lessonsCollection = db.collection('lessons');
    content = await lessonsCollection.findOne({ _id: new ObjectId(lessonId) });
    
    if (content) {
      return {
        success: true,
        content: content
      };
    }
    
    throw new Error('Content not found');
    
  } catch (error) {
    console.error('Error fetching lesson by ID:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function updateStudentProgress(contentId, completionData = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const progressCollection = db.collection('progress');
    const usersCollection = db.collection('user');

    const studentId = new ObjectId(session.user.id);
    const contentObjectId = new ObjectId(contentId);

    const progressData = {
      studentId,
      contentId: contentObjectId,
      contentType: completionData.contentType || 'content',
      contentTitle: completionData.contentTitle || 'Untitled',
      subject: completionData.subject || 'General',
      grade: completionData.grade || 'All',
      status: 'completed',
      progress: {
        currentStep: 1,
        totalSteps: 1,
        percentage: 100,
        timeSpent: completionData.timeSpent || 0,
        lastAccessedAt: new Date()
      },
      completionData: {
        completedAt: new Date(),
        score: completionData.score || null,
        answers: completionData.answers || [],
        correctAnswers: completionData.correctAnswers || 0,
        totalQuestions: completionData.totalQuestions || 0,
        timeToComplete: completionData.timeToComplete || 0,
        feedback: completionData.feedback || null
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: completionData.attempts || 1,
        bookmarked: false
      }
    };

    await progressCollection.updateOne(
      { 
        studentId, 
        contentId: contentObjectId 
      },
      { $set: progressData },
      { upsert: true }
    );

    await usersCollection.updateOne(
      { _id: studentId },
      { 
        $inc: { 
          'stats.completedLessons': 1,
          'stats.totalTimeSpent': completionData.timeSpent || 0
        },
        $set: { 
          'stats.lastActivity': new Date()
        }
      }
    );

    revalidatePath('/student/learning-library');

    return { success: true };
  } catch (error) {
    console.error('Error updating student progress:', error);
    throw new Error(error.message || 'Failed to update progress');
  }
}

export async function getLessonStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const progressCollection = db.collection('progress');

    const user = await usersCollection.findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { grades: 1 } }
    );
    
    if (!user || !user.grades || user.grades.length === 0) {
    return {
        success: false,
        error: 'No grade assigned.',
        stats: {
          totalLessons: 0,
          completedLessons: 0,
          totalTimeSpent: 0,
          totalSubjects: 0
        }
      };
    }

    const normalizedGrades = normalizeGrades(user.grades);

    const [totalLessons, completedCount, timeSpentResult, subjects] = await Promise.all([
      db.collection('lessons').countDocuments({
        grade: { $in: normalizedGrades },
        status: 'published'
      }),
      progressCollection.countDocuments({
        studentId: new ObjectId(session.user.id),
        status: 'completed'
      }),
      progressCollection.aggregate([
        { $match: { studentId: new ObjectId(session.user.id) } },
        { $group: { _id: null, totalTime: { $sum: '$progress.timeSpent' } } }
      ]).toArray(),
      db.collection('lessons').distinct('subject', {
        grade: { $in: normalizedGrades },
        status: 'published'
      })
    ]);

    const totalTimeSpent = timeSpentResult.length > 0 ? timeSpentResult[0].totalTime : 0;

    return {
      success: true,
      stats: {
        totalLessons,
        completedLessons: completedCount,
        totalTimeSpent,
        totalSubjects: subjects.length
      }
    };
  } catch (error) {
    console.error('Error fetching lesson stats:', error);
    throw new Error(error.message || 'Failed to fetch lesson statistics');
  }
}
