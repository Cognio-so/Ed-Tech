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
      }
    } else if (/^\d+$/.test(grade)) {
      // If it's just a number, add the "Grade " version
      const withGrade = `Grade ${grade}`;
      normalizedGrades.push(withGrade);
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
    throw new Error(error.message || 'Failed to fetch lessons');
  }
}

// Optimized function to get all student content with faster queries
export async function getAllStudentContent() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');

    // Get student's grade with projection to fetch only needed fields
    const user = await usersCollection.findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { grades: 1 } }
    );
    
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

    // Fetch from both lessons and presentations collections
    const [lessonsResult, presentationsResult] = await Promise.all([
      // Get lessons from lessons collection
      db.collection('lessons')
        .find({ 
          grade: { $in: normalizedGrades },
          status: 'published'
        })
        .sort({ 'metadata.createdAt': -1 })
        .limit(50)
        .toArray(),
      
      // Get presentations directly from presentations collection
      db.collection('presentations')
        .find({ 
          grade: { $in: normalizedGrades },
          status: 'published'
        })
        .sort({ 'metadata.createdAt': -1 })
        .limit(50)
        .toArray()
    ]);

    // Process lessons
    const lessons = lessonsResult.map(lesson => ({
      ...lesson,
      _id: lesson._id.toString(),
      type: 'lesson',
      resourceType: lesson.contentType || 'content'
    }));

    // Process presentations as slides
    const presentations = presentationsResult.map(presentation => ({
      ...presentation,
      _id: presentation._id.toString(),
      type: 'slides',
      resourceType: 'slides',
      // Map presentation fields to lesson-like structure
      title: presentation.title,
      subject: presentation.subject || 'General',
      grade: presentation.grade,
      topic: presentation.topic,
      description: presentation.description || presentation.instructions || '',
      content: presentation.content || '',
      lessonDescription: presentation.description || presentation.instructions || '',
      difficulty: presentation.difficulty || 'Medium',
      language: presentation.language || 'English',
      duration: presentation.duration || 30,
      metadata: presentation.metadata,
      status: presentation.status,
      // Include all slide-specific fields
      presentationUrl: presentation.presentationUrl,
      slideImages: presentation.slideImages,
      slidesCount: presentation.slideCount || presentation.slidesCount,
      slideCount: presentation.slideCount,
      template: presentation.template,
      verbosity: presentation.verbosity,
      includeImages: presentation.includeImages,
      downloadUrl: presentation.downloadUrl,
      taskId: presentation.taskId,
      taskStatus: presentation.taskStatus
    }));

    // Combine lessons and presentations
    const allContent = [...lessons, ...presentations]
      .sort((a, b) => new Date(b.metadata?.createdAt || b.createdAt) - new Date(a.metadata?.createdAt || a.createdAt));

    // Get student's progress for all content
    const progressRecords = await db.collection('progress')
      .find({ 
        studentId: new ObjectId(session.user.id),
        contentId: { $in: allContent.map(item => new ObjectId(item._id)) }
      })
      .project({
        contentId: 1,
        progress: 1,
        status: 1,
        completionData: 1,
        metadata: 1
      })
      .toArray();

    // Create a progress map for quick lookup
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    // Fetch referenced content for comics, images, and slides
    const contentIds = lessons
      .filter(lesson => lesson.contentId && (
        lesson.contentType === 'image' || 
        lesson.contentType === 'comic' || 
        lesson.contentType === 'slides' ||
        lesson.contentType === 'presentation'
      ))
      .map(lesson => new ObjectId(lesson.contentId));

    let referencedContentMap = {};
    if (contentIds.length > 0) {
      // Fetch all referenced content including presentations
      const [images, comics, presentations] = await Promise.all([
        db.collection('images').find({ _id: { $in: contentIds } }).toArray(),
        db.collection('comics').find({ _id: { $in: contentIds } }).toArray(),
        db.collection('presentations').find({ _id: { $in: contentIds } }).toArray()
      ]);

      // Create lookup maps
      images.forEach(img => {
        referencedContentMap[img._id.toString()] = { type: 'image', data: img };
      });
      comics.forEach(comic => {
        referencedContentMap[comic._id.toString()] = { type: 'comic', data: comic };
      });
      presentations.forEach(presentation => {
        referencedContentMap[presentation._id.toString()] = { type: 'presentation', data: presentation };
      });
    }

    // Transform all content with progress data
    const transformedContent = allContent.map((item) => {
      const progress = progressMap[item._id];
      
      // Determine resource type
      let resourceType = item.resourceType;
      if (item.type === 'lesson') {
        if (item.assessmentId || item.assessmentContent) {
        resourceType = 'assessment';
        } else if (item.contentType) {
          resourceType = item.contentType;
        }
      }

      // Base transformed item
      let transformedItem = {
        _id: item._id,
        resourceId: item._id,
        teacherId: item.teacherId?.toString() || item.userId?.toString(),
        title: item.title,
        subject: item.subject || 'General',
        grade: item.grade,
        topic: item.topic,
        description: item.description || item.lessonDescription || '',
        content: item.content || item.contentData || '',
        resourceType: resourceType,
        difficulty: item.difficulty || 'Medium',
        language: item.language || 'English',
        estimatedTimeMinutes: item.duration || 30,
        rating: 4.5,
        views: item.metadata?.viewCount || 0,
        likes: 0,
        metadata: {
          ...item.metadata,
          createdAt: safeToISOString(item.metadata?.createdAt) || safeToISOString(item.createdAt),
          updatedAt: safeToISOString(item.metadata?.updatedAt) || safeToISOString(item.updatedAt)
        },
        status: item.status,
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
        } : null,
        
        // Include slide-specific fields
        presentationUrl: item.presentationUrl,
        slideImages: item.slideImages,
        slidesCount: item.slidesCount || item.slideCount,
        slideCount: item.slideCount,
        template: item.template,
        verbosity: item.verbosity,
        includeImages: item.includeImages,
        downloadUrl: item.downloadUrl,
        taskId: item.taskId,
        taskStatus: item.taskStatus,
        
        // Include other content fields
        imageUrl: item.imageUrl,
        imageBase64: item.imageBase64,
        visualType: item.visualType,
        instructions: item.instructions,
        difficultyFlag: item.difficultyFlag,
        cloudinaryPublicId: item.cloudinaryPublicId,
        imageUrls: item.imageUrls,
        images: item.images,
        panels: item.panels,
        numPanels: item.numPanels,
        comicType: item.comicType,
        instruction: item.instruction,
        cloudinaryPublicIds: item.cloudinaryPublicIds
      };

      // If this lesson references content from another collection, merge that data
      if (item.contentId && referencedContentMap[item.contentId]) {
        const referencedContent = referencedContentMap[item.contentId];
        
        if (referencedContent.type === 'image') {
          const imgData = referencedContent.data;
          transformedItem = {
            ...transformedItem,
            imageUrl: imgData.imageUrl || transformedItem.imageUrl,
            imageBase64: imgData.imageBase64 || transformedItem.imageBase64,
            visualType: imgData.visualType || transformedItem.visualType,
            instructions: imgData.instructions || transformedItem.instructions,
            difficultyFlag: imgData.difficultyFlag || transformedItem.difficultyFlag,
            cloudinaryPublicId: imgData.cloudinaryPublicId || transformedItem.cloudinaryPublicId
          };
        } else if (referencedContent.type === 'comic') {
          const comicData = referencedContent.data;
          transformedItem = {
            ...transformedItem,
            imageUrls: comicData.imageUrls || transformedItem.imageUrls,
            images: comicData.images || transformedItem.images,
            panels: comicData.panels || transformedItem.panels,
            numPanels: comicData.numPanels || transformedItem.numPanels,
            comicType: comicData.comicType || transformedItem.comicType,
            instruction: comicData.instruction || transformedItem.instruction,
            instructions: comicData.instructions || transformedItem.instructions,
            cloudinaryPublicIds: comicData.cloudinaryPublicIds || transformedItem.cloudinaryPublicIds
          };
        } else if (referencedContent.type === 'presentation') {
          // Handle presentation/slide data
          const presentationData = referencedContent.data;
          transformedItem = {
            ...transformedItem,
            presentationUrl: presentationData.presentationUrl || transformedItem.presentationUrl,
            slideImages: presentationData.slideImages || transformedItem.slideImages,
            slidesCount: presentationData.slideCount || presentationData.slidesCount || transformedItem.slidesCount,
            slideCount: presentationData.slideCount || transformedItem.slideCount,
            template: presentationData.template || transformedItem.template,
            verbosity: presentationData.verbosity || transformedItem.verbosity,
            includeImages: presentationData.includeImages || transformedItem.includeImages,
            downloadUrl: presentationData.downloadUrl || transformedItem.downloadUrl,
            taskId: presentationData.taskId || transformedItem.taskId,
            taskStatus: presentationData.taskStatus || transformedItem.taskStatus
          };
        }
      }

      return transformedItem;
    });

    return {
      success: true,
      lessons: transformedContent
    };
  } catch (error) {
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

// Optimized function to get lesson stats
export async function getLessonStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const progressCollection = db.collection('progress');

    // Get student's grade with projection
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

    // Normalize grades for matching
    const normalizedGrades = normalizeGrades(user.grades);

    // Use aggregation for faster counting
    const totalLessonsPromise = db.collection('lessons').countDocuments({
      grade: { $in: normalizedGrades },
      status: 'published'
    });

    // Get completed lessons and total time spent in parallel
    const [completedResult, timeSpentResult] = await Promise.all([
      progressCollection.countDocuments({
        studentId: new ObjectId(session.user.id),
        status: 'completed'
      }),
      progressCollection.aggregate([
        { $match: { studentId: new ObjectId(session.user.id) } },
        { $group: { _id: null, totalTime: { $sum: '$progress.timeSpent' } } }
      ]).toArray()
    ]);

    const totalLessons = await totalLessonsPromise;
    const totalTimeSpent = timeSpentResult.length > 0 ? timeSpentResult[0].totalTime : 0;

    // Get unique subjects count
    const subjects = await db.collection('lessons').distinct('subject', {
      grade: { $in: normalizedGrades },
      status: 'published'
    });

    return {
      success: true,
      stats: {
        totalLessons,
        completedLessons: completedResult,
        totalTimeSpent,
        totalSubjects: subjects.length
      }
    };
  } catch (error) {
    console.error('Error fetching lesson stats:', error);
    throw new Error(error.message || 'Failed to fetch lesson statistics');
  }
}

// Update student progress when content is completed
export async function updateStudentProgress(contentId, completionData = {}) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const progressCollection = db.collection('progress');
    const achievementsCollection = db.collection('achievements');
    const usersCollection = db.collection('user');

    const studentId = new ObjectId(session.user.id);
    const contentObjectId = new ObjectId(contentId);

    // Update or create progress record
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

    // Use upsert to update existing or create new progress record
    await progressCollection.updateOne(
      { 
        studentId, 
        contentId: contentObjectId 
      },
      { $set: progressData },
      { upsert: true }
    );

    // Update user's total completed lessons count
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

    // Check for achievements
    await checkAndAwardAchievements(studentId, contentId, completionData);

    // Revalidate the learning library page
    revalidatePath('/student/learning-library');

    return { success: true };
  } catch (error) {
    console.error('Error updating student progress:', error);
    throw new Error(error.message || 'Failed to update progress');
  }
}

// Check and award achievements based on completion
async function checkAndAwardAchievements(studentId, contentId, completionData) {
  try {
    const { db } = await connectToDatabase();
    const achievementsCollection = db.collection('achievements');
    const progressCollection = db.collection('progress');

    // Get student's current progress stats
    const completedCount = await progressCollection.countDocuments({
      studentId,
      status: 'completed'
    });

    const totalTimeSpent = await progressCollection.aggregate([
      { $match: { studentId, status: 'completed' } },
      { $group: { _id: null, totalTime: { $sum: '$progress.timeSpent' } } }
    ]).toArray();

    const timeSpent = totalTimeSpent.length > 0 ? totalTimeSpent[0].totalTime : 0;

    // Define achievement criteria
    const achievements = [
      {
        id: 'first_lesson',
        title: 'First Steps',
        description: 'Complete your first lesson',
        icon: '🎉',
        criteria: { completedLessons: 1 },
        current: { completedLessons: completedCount }
      },
      {
        id: 'five_lessons',
        title: 'Getting Started',
        description: 'Complete 5 lessons',
        icon: '🎉',
        criteria: { completedLessons: 5 },
        current: { completedLessons: completedCount }
      },
      {
        id: 'ten_lessons',
        title: 'Dedicated Learner',
        description: 'Complete 10 lessons',
        icon: '🏆',
        criteria: { completedLessons: 10 },
        current: { completedLessons: completedCount }
      },
      {
        id: 'twenty_lessons',
        title: 'Knowledge Seeker',
        description: 'Complete 20 lessons',
        icon: '🌟',
        criteria: { completedLessons: 20 },
        current: { completedLessons: completedCount }
      },
      {
        id: 'one_hour',
        title: 'Time Invested',
        description: 'Spend 1 hour learning',
        icon: '⏰',
        criteria: { timeSpent: 3600 }, // 1 hour in seconds
        current: { timeSpent }
      },
      {
        id: 'five_hours',
        title: 'Learning Champion',
        description: 'Spend 5 hours learning',
        icon: '💎',
        criteria: { timeSpent: 18000 }, // 5 hours in seconds
        current: { timeSpent }
      }
    ];

    // Check each achievement
    for (const achievement of achievements) {
      const isEarned = checkAchievementCriteria(achievement.criteria, achievement.current);
      
      if (isEarned) {
        // Check if student already has this achievement
        const existingAchievement = await achievementsCollection.findOne({
          studentId,
          achievementId: achievement.id
        });

        if (!existingAchievement) {
          // Award the achievement
          await achievementsCollection.insertOne({
            studentId,
            achievementId: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon: achievement.icon,
            earnedAt: new Date(),
            contentId: new ObjectId(contentId)
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
    // Don't throw error here as it shouldn't break the main flow
  }
}

// Helper function to check if achievement criteria is met
function checkAchievementCriteria(criteria, current) {
  for (const [key, value] of Object.entries(criteria)) {
    if (current[key] < value) {
      return false;
    }
  }
  return true;
}

// Get student achievements
export async function getStudentAchievements() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const achievementsCollection = db.collection('achievements');

    const achievements = await achievementsCollection
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ earnedAt: -1 })
      .toArray();

    return {
      success: true,
      achievements: achievements.map(achievement => ({
        id: achievement.achievementId,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        earnedAt: achievement.earnedAt,
        contentId: achievement.contentId?.toString()
      }))
    };
  } catch (error) {
    console.error('Error fetching student achievements:', error);
    throw new Error(error.message || 'Failed to fetch achievements');
  }
}

// Get student progress summary
export async function getStudentProgressSummary() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const progressCollection = db.collection('progress');
    const achievementsCollection = db.collection('achievements');

    const studentId = new ObjectId(session.user.id);

    // Get progress stats
    const [completedCount, totalTimeResult, achievementsCount] = await Promise.all([
      progressCollection.countDocuments({ studentId, status: 'completed' }),
      progressCollection.aggregate([
        { $match: { studentId, status: 'completed' } },
        { $group: { _id: null, totalTime: { $sum: '$progress.timeSpent' } } }
      ]).toArray(),
      achievementsCollection.countDocuments({ studentId })
    ]);

    const totalTimeSpent = totalTimeResult.length > 0 ? totalTimeResult[0].totalTime : 0;

    return {
      success: true,
      summary: {
        completedLessons: completedCount,
        totalTimeSpent,
        achievementsEarned: achievementsCount,
        averageTimePerLesson: completedCount > 0 ? Math.round(totalTimeSpent / completedCount) : 0
      }
    };
  } catch (error) {
    console.error('Error fetching progress summary:', error);
    throw new Error(error.message || 'Failed to fetch progress summary');
  }
}

// Mark content as bookmarked
export async function toggleBookmark(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const progressCollection = db.collection('progress');

    const studentId = new ObjectId(session.user.id);
    const contentObjectId = new ObjectId(contentId);

    // Check if progress record exists
    const existingProgress = await progressCollection.findOne({
      studentId,
      contentId: contentObjectId
    });

    if (existingProgress) {
      // Toggle bookmark status
      await progressCollection.updateOne(
        { studentId, contentId: contentObjectId },
        { 
          $set: { 
            'metadata.bookmarked': !existingProgress.metadata?.bookmarked,
            'metadata.updatedAt': new Date()
          }
        }
      );
    } else {
      // Create new progress record with bookmark
      await progressCollection.insertOne({
        studentId,
        contentId: contentObjectId,
        contentType: 'content',
        contentTitle: 'Untitled',
        subject: 'General',
        grade: 'All',
        status: 'not_started',
        progress: {
          currentStep: 0,
          totalSteps: 1,
          percentage: 0,
          timeSpent: 0,
          lastAccessedAt: new Date()
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          attempts: 0,
          bookmarked: true
        }
      });
    }

    revalidatePath('/student/learning-library');
    return { success: true };
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    throw new Error(error.message || 'Failed to toggle bookmark');
  }
}
