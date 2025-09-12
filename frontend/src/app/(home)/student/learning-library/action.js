'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Helper function to normalize grades for matching
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
      } else {
        console.log(`Grade "${grade}" -> Added "${grade}" only (not a simple number)`);
      }
    } else if (/^\d+$/.test(grade)) {
      // If it's just a number, add the "Grade X" version
      const withGrade = `Grade ${grade}`;
      normalizedGrades.push(withGrade);
    } else {
      console.log(`Grade "${grade}" -> Added "${grade}" only (not a simple number)`);
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

// Get all content for students based on their grade
export async function getStudentLessons() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const lessonsCollection = db.collection('lessons');
    const progressCollection = db.collection('progress');

    // Get student's grade
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.grades || user.grades.length === 0) {
      return {
        success: false,
        error: 'No grade assigned. Please contact administration to add your grade.',
        lessons: []
      };
    }

    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    // Get lessons for the student's grade
    const lessons = await lessonsCollection
      .find({ 
        grade: { $in: normalizedGrades },
        status: 'published'
      })
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    // Get student's progress for these lessons
    const progressRecords = await progressCollection
      .find({ 
        studentId: new ObjectId(session.user.id),
        contentId: { $in: lessons.map(lesson => lesson._id) }
      })
      .toArray();

    // Create a progress map for quick lookup
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    // Transform lessons to include progress and resource type
    const transformedLessons = lessons.map(lesson => {
      const progress = progressMap[lesson._id.toString()];
      
      // Determine resource type based on lesson content
      let resourceType = 'content';
      if (lesson.assessmentId || lesson.assessmentContent) {
        resourceType = 'assessment';
      } else if (lesson.contentType) {
        resourceType = lesson.contentType;
      }

      return {
        _id: lesson._id.toString(),
        resourceId: lesson._id.toString(),
        teacherId: lesson.teacherId.toString(),
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
        topic: lesson.topic,
        description: lesson.lessonDescription,
        content: lesson.contentData || lesson.assessmentContent,
        resourceType: resourceType,
        difficulty: lesson.difficulty,
        language: lesson.language,
        estimatedTimeMinutes: lesson.duration || 30,
        rating: 4.5, // Default rating
        views: lesson.metadata?.viewCount || 0,
        likes: 0, // Default likes
        metadata: {
          ...lesson.metadata,
          createdAt: safeToISOString(lesson.metadata.createdAt),
          updatedAt: safeToISOString(lesson.metadata.updatedAt)
        },
        status: lesson.status,
        progress: progress ? {
          currentStep: progress.progress?.currentStep || 0,
          totalSteps: progress.progress?.totalSteps || 1,
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: safeToISOString(progress.progress?.lastAccessedAt),
          status: progress.status,
          completedAt: safeToISOString(progress.completionData?.completedAt),
          score: progress.completionData?.score,
          attempts: progress.metadata?.attempts || 0,
          bookmarked: progress.metadata?.bookmarked || false
        } : null
      };
    });

    return {
      success: true,
      lessons: transformedLessons
    };
  } catch (error) {
    console.error('Error fetching student lessons:', error);
    throw new Error(error.message || 'Failed to fetch lessons');
  }
}

// Get all student content with proper grade matching
export async function getAllStudentContent() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }


    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');

    // Get student's grade
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.grades || user.grades.length === 0) {
      return {
        success: false,
        error: 'No grade assigned. Please contact administration to add your grade.',
        lessons: []
      };
    }


    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    // First, get lessons from the lessons collection (primary source)
    const lessons = await db.collection('lessons')
      .find({ 
        grade: { $in: normalizedGrades },
        status: 'published'
      })
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    // Get student's progress for these lessons
    const progressRecords = await db.collection('studentProgress')
      .find({ 
        studentId: new ObjectId(session.user.id),
        contentId: { $in: lessons.map(lesson => new ObjectId(lesson._id)) }
      })
      .toArray();


    // Create a progress map for quick lookup
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    // Transform lessons to include progress and proper resource type
    const transformedLessons = await Promise.all(lessons.map(async (lesson) => {
      const progress = progressMap[lesson._id.toString()];
      
      // Determine resource type based on lesson content
      let resourceType = 'content';
      if (lesson.assessmentId || lesson.assessmentContent) {
        resourceType = 'assessment';
      } else if (lesson.contentType) {
        resourceType = lesson.contentType;
      }

      // Base transformed lesson
      let transformedLesson = {
        _id: lesson._id.toString(),
        resourceId: lesson._id.toString(),
        teacherId: lesson.teacherId.toString(),
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
        topic: lesson.topic,
        description: lesson.lessonDescription,
        content: lesson.contentData || lesson.assessmentContent,
        resourceType: resourceType,
        difficulty: lesson.difficulty,
        language: lesson.language,
        estimatedTimeMinutes: lesson.duration || 30,
        rating: 4.5, // Default rating
        views: lesson.metadata?.viewCount || 0,
        likes: 0, // Default likes
        metadata: {
          ...lesson.metadata,
          createdAt: safeToISOString(lesson.metadata?.createdAt),
          updatedAt: safeToISOString(lesson.metadata?.updatedAt)
        },
        status: lesson.status,
        progress: progress ? {
          currentStep: progress.progress?.currentStep || 0,
          totalSteps: progress.progress?.totalSteps || 1,
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: safeToISOString(progress.progress?.lastAccessedAt),
          status: progress.status,
          completedAt: safeToISOString(progress.completionData?.completedAt),
          score: progress.completionData?.score,
          attempts: progress.metadata?.attempts || 0,
          bookmarked: progress.metadata?.bookmarked || false
        } : null
      };

      // If this lesson references content from another collection, fetch that content
      if (lesson.contentId && (lesson.contentType === 'image' || lesson.contentType === 'comic')) {
        
        try {
          let referencedContent = null;
          
          if (lesson.contentType === 'image') {
            referencedContent = await db.collection('images').findOne({ 
              _id: new ObjectId(lesson.contentId) 
            });
          } else if (lesson.contentType === 'comic') {
            referencedContent = await db.collection('comics').findOne({ 
              _id: new ObjectId(lesson.contentId) 
            });
          }
          
          if (referencedContent) {
            
            // Merge the referenced content data into the lesson
            if (lesson.contentType === 'image') {
              transformedLesson = {
                ...transformedLesson,
                imageUrl: referencedContent.imageUrl,
                imageBase64: referencedContent.imageBase64,
                visualType: referencedContent.visualType,
                instructions: referencedContent.instructions,
                difficultyFlag: referencedContent.difficultyFlag,
                cloudinaryPublicId: referencedContent.cloudinaryPublicId
              };
            } else if (lesson.contentType === 'comic') {
              transformedLesson = {
                ...transformedLesson,
                imageUrls: referencedContent.imageUrls,
                images: referencedContent.images,
                panels: referencedContent.panels,
                numPanels: referencedContent.numPanels,
                comicType: referencedContent.comicType,
                instruction: referencedContent.instruction,
                instructions: referencedContent.instructions,
                cloudinaryPublicIds: referencedContent.cloudinaryPublicIds
              };
            }
          } else {
            console.warn(`No ${lesson.contentType} content found for contentId:`, lesson.contentId);
          }
        } catch (error) {
          console.error(`Error fetching ${lesson.contentType} content:`, error);
        }
      }

      return transformedLesson;
    }));

    

    return {
      success: true,
      lessons: transformedLessons
    };
  } catch (error) {
    console.error('Error fetching all student content:', error);
    throw new Error(error.message || 'Failed to fetch content');
  }
}

// Get lessons by resource type
export async function getLessonsByType(resourceType) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');

    // Get student's grade
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user || !user.grades || user.grades.length === 0) {
      return {
        success: false,
        error: 'No grade assigned.',
        lessons: []
      };
    }

    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    let collectionName;
    let query = { 
      grade: { $in: normalizedGrades },
      status: 'published'
    };

    // Determine collection and query based on resource type
    switch (resourceType) {
      case 'all':
        return await getAllStudentContent();
      case 'slides':
        collectionName = 'presentations';
        break;
      case 'video':
        collectionName = 'videos';
        break;
      case 'comic':
        collectionName = 'comics';
        query = { 
          grade: { $in: normalizedGrades },
          status: 'completed'  // Comics use 'completed' status, not 'published'
        };
        break;
      case 'image':
        collectionName = 'images';
        query = { 
          grade: { $in: normalizedGrades },
          status: 'completed'  // Images use 'completed' status, not 'published'
        };
        break;
      case 'content':
        collectionName = 'contents';
        break;
      case 'assessment':
        collectionName = 'assessments';
        break;
      case 'external':
        collectionName = 'webSearches';
        break;
      case 'lesson':
        collectionName = 'lessons';
        break;
      default:
        return await getAllStudentContent();
    }

    const items = await db.collection(collectionName)
      .find(query)
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    // Get student's progress for these items
    const progressRecords = await db.collection('progress')
      .find({ 
        studentId: new ObjectId(session.user.id),
        contentId: { $in: items.map(item => item._id) }
      })
      .toArray();

    // Create a progress map for quick lookup
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    const transformedLessons = items.map(item => {
      const progress = progressMap[item._id.toString()];
      
      
      
      // Base transformation
      const transformedItem = {
        _id: item._id.toString(),
        resourceId: item._id.toString(),
        teacherId: item.userId?.toString() || item.teacherId?.toString(),
        title: item.title || item.instruction || item.topic || 'Untitled',
        subject: item.subject || 'General',
        grade: item.grade || item.gradeLevel || 'All',
        topic: item.topic || item.title || 'General Topic',
        description: item.description || item.lessonDescription || item.instruction || item.content || '',
        content: item.content || item.generatedContent || item.assessmentContent || item.contentData || item.instruction || '',
        resourceType: resourceType,
        difficulty: item.difficulty || 'Medium',
        language: item.language || 'English',
        estimatedTimeMinutes: item.duration || item.estimatedTimeMinutes || 30,
        rating: 4.5,
        views: item.metadata?.viewCount || item.views || 0,
        likes: item.likes || 0,
        metadata: {
          ...item.metadata,
          createdAt: safeToISOString(item.metadata?.createdAt) || safeToISOString(item.createdAt),
          updatedAt: safeToISOString(item.metadata?.updatedAt) || safeToISOString(item.updatedAt)
        },
        status: item.status || 'published',
        progress: progress ? {
          currentStep: progress.progress?.currentStep || 0,
          totalSteps: progress.progress?.totalSteps || 1,
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: safeToISOString(progress.progress?.lastAccessedAt),
          status: progress.status,
          completedAt: safeToISOString(progress.completionData?.completedAt),
          score: progress.completionData?.score,
          attempts: progress.metadata?.attempts || 0,
          bookmarked: progress.metadata?.bookmarked || false
        } : null
      };

      // Add image-specific fields if this is an image
      if (resourceType === 'image') {
        transformedItem.imageUrl = item.imageUrl;
        transformedItem.imageBase64 = item.imageBase64;
        transformedItem.visualType = item.visualType;
        transformedItem.instructions = item.instructions;
        transformedItem.difficultyFlag = item.difficultyFlag;
        transformedItem.cloudinaryPublicId = item.cloudinaryPublicId;
        
      
      }

      return transformedItem;
    });

    return {
      success: true,
      lessons: transformedLessons
    };
  } catch (error) {
    console.error('Error fetching lessons by type:', error);
    throw new Error(error.message || 'Failed to fetch lessons');
  }
}

// Get lessons by subject
export async function getLessonsBySubject(subject) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');

    // Get student's grade
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user || !user.grades || user.grades.length === 0) {
      return {
        success: false,
        error: 'No grade assigned.',
        lessons: []
      };
    }

    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    let query = { 
      grade: { $in: normalizedGrades },
      status: 'published'
    };

    if (subject !== 'All') {
      query.subject = subject;
    }

    // Fetch from all collections
    const collections = ['lessons', 'contents', 'presentations', 'comics', 'images', 'videos', 'assessments', 'webSearches'];
    const allItems = [];

    for (const collectionName of collections) {
      try {
        const items = await db.collection(collectionName)
          .find(query)
          .sort({ 'metadata.createdAt': -1 })
          .toArray();
        
        allItems.push(...items.map(item => ({
          ...item,
          _id: item._id.toString(),
          collection: collectionName
        })));
      } catch (error) {
        console.error(`Error fetching from ${collectionName}:`, error);
      }
    }

    // Get student's progress for these items
    const progressRecords = await db.collection('progress')
      .find({ 
        studentId: new ObjectId(session.user.id),
        contentId: { $in: allItems.map(item => new ObjectId(item._id)) }
      })
      .toArray();

    // Create a progress map for quick lookup
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    const transformedLessons = allItems.map(item => {
      const progress = progressMap[item._id];
      
      // Determine resource type based on collection
      let resourceType = 'content';
      switch (item.collection) {
        case 'lessons':
          resourceType = item.assessmentId ? 'assessment' : (item.contentType || 'lesson');
          break;
        case 'presentations':
          resourceType = 'slides';
          break;
        case 'comics':
          resourceType = 'comic';
          break;
        case 'images':
          resourceType = 'image';
          break;
        case 'videos':
          resourceType = 'video';
          break;
        case 'assessments':
          resourceType = 'assessment';
          break;
        case 'webSearches':
          resourceType = 'external';
          break;
        default:
          resourceType = 'content';
      }
      
      return {
        _id: item._id,
        resourceId: item._id,
        teacherId: item.userId || item.teacherId,
        title: item.title || item.instruction || item.topic || 'Untitled',
        subject: item.subject || 'General',
        grade: item.grade || item.gradeLevel || 'All',
        topic: item.topic || item.title || 'General Topic',
        description: item.description || item.lessonDescription || item.instruction || item.content || '',
        content: item.content || item.generatedContent || item.assessmentContent || item.contentData || item.instruction || '',
        resourceType: resourceType,
        difficulty: item.difficulty || 'Medium',
        language: item.language || 'English',
        estimatedTimeMinutes: item.duration || item.estimatedTimeMinutes || 30,
        rating: 4.5,
        views: item.metadata?.viewCount || item.views || 0,
        likes: item.likes || 0,
        metadata: {
          ...item.metadata,
          createdAt: safeToISOString(item.metadata?.createdAt) || safeToISOString(item.createdAt),
          updatedAt: safeToISOString(item.metadata?.updatedAt) || safeToISOString(item.updatedAt)
        },
        status: item.status || 'published',
        progress: progress ? {
          currentStep: progress.progress?.currentStep || 0,
          totalSteps: progress.progress?.totalSteps || 1,
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: safeToISOString(progress.progress?.lastAccessedAt),
          status: progress.status,
          completedAt: safeToISOString(progress.completionData?.completedAt),
          score: progress.completionData?.score,
          attempts: progress.metadata?.attempts || 0,
          bookmarked: progress.metadata?.bookmarked || false
        } : null
      };
    });

    return {
      success: true,
      lessons: transformedLessons
    };
  } catch (error) {
    console.error('Error fetching lessons by subject:', error);
    throw new Error(error.message || 'Failed to fetch lessons');
  }
}

// Search lessons
export async function searchLessons(searchTerm) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');

    // Get student's grade
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user || !user.grades || user.grades.length === 0) {
      return {
        success: false,
        error: 'No grade assigned.',
        lessons: []
      };
    }

    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    const baseQuery = {
      grade: { $in: normalizedGrades },
      status: 'published',
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { topic: { $regex: searchTerm, $options: 'i' } },
        { subject: { $regex: searchTerm, $options: 'i' } },
        { lessonDescription: { $regex: searchTerm, $options: 'i' } },
        { instruction: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    // Search in all collections
    const collections = ['lessons', 'contents', 'presentations', 'comics', 'images', 'videos', 'assessments', 'webSearches'];
    const allItems = [];

    for (const collectionName of collections) {
      try {
        const items = await db.collection(collectionName)
          .find(baseQuery)
          .sort({ 'metadata.createdAt': -1 })
          .toArray();
        
        allItems.push(...items.map(item => ({
          ...item,
          _id: item._id.toString(),
          collection: collectionName
        })));
      } catch (error) {
        console.error(`Error searching in ${collectionName}:`, error);
      }
    }

    // Get student's progress for these items
    const progressRecords = await db.collection('progress')
      .find({ 
        studentId: new ObjectId(session.user.id),
        contentId: { $in: allItems.map(item => new ObjectId(item._id)) }
      })
      .toArray();

    // Create a progress map for quick lookup
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    const transformedLessons = allItems.map(item => {
      const progress = progressMap[item._id];
      
      // Determine resource type based on collection
      let resourceType = 'content';
      switch (item.collection) {
        case 'lessons':
          resourceType = item.assessmentId ? 'assessment' : (item.contentType || 'lesson');
          break;
        case 'presentations':
          resourceType = 'slides';
          break;
        case 'comics':
          resourceType = 'comic';
          break;
        case 'images':
          resourceType = 'image';
          break;
        case 'videos':
          resourceType = 'video';
          break;
        case 'assessments':
          resourceType = 'assessment';
          break;
        case 'webSearches':
          resourceType = 'external';
          break;
        default:
          resourceType = 'content';
      }
      
      return {
        _id: item._id,
        resourceId: item._id,
        teacherId: item.userId || item.teacherId,
        title: item.title || item.instruction || item.topic || 'Untitled',
        subject: item.subject || 'General',
        grade: item.grade || item.gradeLevel || 'All',
        topic: item.topic || item.title || 'General Topic',
        description: item.description || item.lessonDescription || item.instruction || item.content || '',
        content: item.content || item.generatedContent || item.assessmentContent || item.contentData || item.instruction || '',
        resourceType: resourceType,
        difficulty: item.difficulty || 'Medium',
        language: item.language || 'English',
        estimatedTimeMinutes: item.duration || item.estimatedTimeMinutes || 30,
        rating: 4.5,
        views: item.metadata?.viewCount || item.views || 0,
        likes: item.likes || 0,
        metadata: {
          ...item.metadata,
          createdAt: safeToISOString(item.metadata?.createdAt) || safeToISOString(item.createdAt),
          updatedAt: safeToISOString(item.metadata?.updatedAt) || safeToISOString(item.updatedAt)
        },
        status: item.status || 'published',
        progress: progress ? {
          currentStep: progress.progress?.currentStep || 0,
          totalSteps: progress.progress?.totalSteps || 1,
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: safeToISOString(progress.progress?.lastAccessedAt),
          status: progress.status,
          completedAt: safeToISOString(progress.completionData?.completedAt),
          score: progress.completionData?.score,
          attempts: progress.metadata?.attempts || 0,
          bookmarked: progress.metadata?.bookmarked || false
        } : null
      };
    });

    return {
      success: true,
      lessons: transformedLessons
    };
  } catch (error) {
    console.error('Error searching lessons:', error);
    throw new Error(error.message || 'Failed to search lessons');
  }
}

// Get lesson by ID
export async function getLessonById(lessonId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const progressCollection = db.collection('progress');

    // Get student's grade
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user || !user.grades || user.grades.length === 0) {
      throw new Error('No grade assigned.');
    }

    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    // Search in all collections for the lesson
    const collections = ['lessons', 'contents', 'presentations', 'comics', 'images', 'videos', 'assessments', 'webSearches'];
    let lesson = null;
    let collectionName = '';

    for (const collection of collections) {
      try {
        const item = await db.collection(collection).findOne({
          _id: new ObjectId(lessonId),
          grade: { $in: normalizedGrades },
          status: 'published'
        });
        
        if (item) {
          lesson = item;
          collectionName = collection;
          break;
        }
      } catch (error) {
        console.error(`Error searching in ${collection}:`, error);
      }
    }

    if (!lesson) {
      throw new Error('Lesson not found or not accessible');
    }

    // Get student's progress for this lesson
    const progress = await progressCollection.findOne({
      studentId: new ObjectId(session.user.id),
      contentId: new ObjectId(lessonId)
    });

    // Determine resource type based on collection
    let resourceType = 'content';
    switch (collectionName) {
      case 'lessons':
        resourceType = lesson.assessmentId ? 'assessment' : (lesson.contentType || 'lesson');
        break;
      case 'presentations':
        resourceType = 'slides';
        break;
      case 'comics':
        resourceType = 'comic';
        break;
      case 'images':
        resourceType = 'image';
        break;
      case 'videos':
        resourceType = 'video';
        break;
      case 'assessments':
        resourceType = 'assessment';
        break;
      case 'webSearches':
        resourceType = 'external';
        break;
      default:
        resourceType = 'content';
    }

    const transformedLesson = {
      _id: lesson._id.toString(),
      resourceId: lesson._id.toString(),
      teacherId: lesson.userId?.toString() || lesson.teacherId?.toString(),
      title: lesson.title || lesson.instruction || lesson.topic || 'Untitled',
      subject: lesson.subject || 'General',
      grade: lesson.grade || lesson.gradeLevel || 'All',
      topic: lesson.topic || lesson.title || 'General Topic',
      description: lesson.description || lesson.lessonDescription || lesson.instruction || lesson.content || '',
      content: lesson.content || lesson.generatedContent || lesson.assessmentContent || lesson.contentData || lesson.instruction || '',
      resourceType: resourceType,
      difficulty: lesson.difficulty || 'Medium',
      language: lesson.language || 'English',
      estimatedTimeMinutes: lesson.duration || lesson.estimatedTimeMinutes || 30,
      rating: 4.5,
      views: lesson.metadata?.viewCount || lesson.views || 0,
      likes: lesson.likes || 0,
      metadata: {
        ...lesson.metadata,
        createdAt: safeToISOString(lesson.metadata?.createdAt) || safeToISOString(lesson.createdAt),
        updatedAt: safeToISOString(lesson.metadata?.updatedAt) || safeToISOString(lesson.updatedAt)
      },
      status: lesson.status || 'published',
      progress: progress ? {
        currentStep: progress.progress?.currentStep || 0,
        totalSteps: progress.progress?.totalSteps || 1,
        percentage: progress.progress?.percentage || 0,
        timeSpent: progress.progress?.timeSpent || 0,
        lastAccessedAt: safeToISOString(progress.progress?.lastAccessedAt),
        status: progress.status,
        completedAt: safeToISOString(progress.completionData?.completedAt),
        score: progress.completionData?.score,
        attempts: progress.metadata?.attempts || 0,
        bookmarked: progress.metadata?.bookmarked || false
      } : null
    };

    return {
      success: true,
      lesson: transformedLesson
    };
  } catch (error) {
    console.error('Error fetching lesson by ID:', error);
    throw new Error(error.message || 'Failed to fetch lesson');
  }
}

// Update lesson view count
export async function updateLessonViewCount(lessonId) {
  try {
    const { db } = await connectToDatabase();
    
    // Try to update view count in all collections
    const collections = ['lessons', 'contents', 'presentations', 'comics', 'images', 'videos', 'assessments', 'webSearches'];
    
    for (const collectionName of collections) {
      try {
        const result = await db.collection(collectionName).updateOne(
          { _id: new ObjectId(lessonId) },
          { 
            $inc: { 'metadata.viewCount': 1 },
            $set: { 'metadata.updatedAt': new Date() }
          }
        );
        
        if (result.matchedCount > 0) {
          break; // Found and updated, no need to check other collections
        }
      } catch (error) {
        console.error(`Error updating view count in ${collectionName}:`, error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating view count:', error);
    throw new Error('Failed to update view count');
  }
}

// Get lesson statistics
export async function getLessonStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const studentProgressCollection = db.collection('studentProgress');

    // Get student's grade
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
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

    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    // Get total content from all collections
    const collections = ['lessons', 'contents', 'presentations', 'comics', 'images', 'videos', 'assessments', 'webSearches'];
    let totalLessons = 0;
    const allSubjects = new Set();

    for (const collectionName of collections) {
      try {
        const count = await db.collection(collectionName).countDocuments({
          grade: { $in: normalizedGrades },
          status: 'published'
        });
        totalLessons += count;

        // Get unique subjects from this collection
        const subjects = await db.collection(collectionName).distinct('subject', {
          grade: { $in: normalizedGrades },
          status: 'published'
        });
        subjects.forEach(subject => allSubjects.add(subject));
      } catch (error) {
        console.error(`Error getting stats from ${collectionName}:`, error);
      }
    }

    // Get completed lessons from studentProgress collection
    const completedProgress = await studentProgressCollection.countDocuments({
      studentId: new ObjectId(session.user.id),
      status: 'completed'
    });

    // Get total time spent from studentProgress collection
    const timeSpentResult = await studentProgressCollection.aggregate([
      { $match: { studentId: new ObjectId(session.user.id) } },
      { $group: { _id: null, totalTime: { $sum: '$progress.timeSpent' } } }
    ]).toArray();

    const totalTimeSpent = timeSpentResult.length > 0 ? timeSpentResult[0].totalTime : 0;

   

    return {
      success: true,
      stats: {
        totalLessons,
        completedLessons: completedProgress,
        totalTimeSpent,
        totalSubjects: allSubjects.size
      }
    };
  } catch (error) {
    console.error('Error fetching lesson stats:', error);
    throw new Error(error.message || 'Failed to fetch lesson statistics');
  }
}
