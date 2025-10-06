"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Fetch all content types for the library
export async function getAllLibraryContent() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const userId = session.user.id;

    // Fetch all content types in parallel for better performance
    const [
      contentsResult,
      presentationsResult,
      comicsResult,
      imagesResult,
      videosResult,
      assessmentsResult,
      webSearchesResult
    ] = await Promise.allSettled([
      // Content (lessons, presentations, worksheets)
      db.collection("contents")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Presentations/Slides
      db.collection("presentations")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Comics - Fixed: Now filtering by userId
      db.collection("comics")
        .find({ userId: new ObjectId(userId) })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Images
      db.collection("images")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Videos
      db.collection("videos")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Assessments
      db.collection("assessments")
        .find({ userId: new ObjectId(userId) })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Web Searches - Fixed: Use correct collection name
      db.collection("websearches")
        .find({ userId: new ObjectId(userId) })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray()
    ]);

    // Process results and handle errors gracefully
    const processResult = (result, type) => {
      if (result.status === 'fulfilled') {
        return result.value.map(item => ({
          ...item,
          _id: item._id.toString(),
          userId: item.userId.toString(),
          type,
          // Fix: Properly handle date serialization with fallbacks
          createdAt: item.metadata?.createdAt?.toISOString() || 
                    item.createdAt?.toISOString() || 
                    new Date().toISOString(),
          updatedAt: item.metadata?.updatedAt?.toISOString() || 
                    item.updatedAt?.toISOString() || 
                    new Date().toISOString()
        }));
      } else {
        console.error(`Error fetching ${type}:`, result.reason);
        return [];
      }
    };

    const contents = processResult(contentsResult, 'content');
    const presentations = processResult(presentationsResult, 'slides');
    const comics = processResult(comicsResult, 'comic');
    const images = processResult(imagesResult, 'image');
    const videos = processResult(videosResult, 'video');
    const assessments = processResult(assessmentsResult, 'assessment');
    const webSearches = processResult(webSearchesResult, 'websearch');

    // Combine all content and sort by creation date
    const allContent = [
      ...contents,
      ...presentations,
      ...comics,
      ...images,
      ...videos,
      ...assessments,
      ...webSearches
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get counts for each type
    const counts = {
      all: allContent.length,
      content: contents.length,
      slides: presentations.length,
      comic: comics.length,
      image: images.length,
      video: videos.length,
      assessment: assessments.length,
      websearch: webSearches.length
    };

    return {
      success: true,
      content: allContent,
      counts,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error("Error fetching library content:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch library content",
      content: [],
      counts: {
        all: 0,
        content: 0,
        slides: 0,
        comic: 0,
        image: 0,
        video: 0,
        assessment: 0,
        websearch: 0
      }
    };
  }
}

// NEW: Get curriculum data for grade-subject pairs
export async function getCurriculumData() {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    // Fetch all curriculum documents
    const curriculumDocs = await curriculumCollection.find({}).toArray();
    
    // Create grade-subject pairs from curriculum
    const gradeSubjectPairs = [];
    const gradesSet = new Set();
    const subjectsSet = new Set();
    
    curriculumDocs.forEach(doc => {
      if (doc.subject && doc.subject.trim() && doc.grade && doc.grade.trim()) {
        const grade = doc.grade.trim();
        const subject = doc.subject.trim();
        
        gradesSet.add(grade);
        subjectsSet.add(subject);
        
        // Create grade-subject pair
        const pairId = `${grade}_${subject}`;
        if (!gradeSubjectPairs.find(pair => pair.id === pairId)) {
          gradeSubjectPairs.push({
            id: pairId,
            grade: grade,
            subject: subject,
            displayName: `${grade} (${subject})`,
            createdAt: new Date('2024-01-01')
          });
        }
      }
    });
    
    // Convert sets to arrays for backward compatibility
    const subjects = Array.from(subjectsSet).map((subject, index) => ({
      id: `subject_${index}`,
      name: subject,
      createdAt: new Date('2024-01-01')
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    const grades = Array.from(gradesSet).map((grade, index) => ({
      id: `grade_${index}`,
      name: grade,
      createdAt: new Date('2024-01-01')
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      success: true,
      subjects,
      grades,
      gradeSubjectPairs: gradeSubjectPairs.sort((a, b) => {
        // Sort by grade first, then by subject
        const gradeCompare = a.grade.localeCompare(b.grade);
        if (gradeCompare !== 0) return gradeCompare;
        return a.subject.localeCompare(b.subject);
      })
    };
  } catch (error) {
    console.error("Error fetching curriculum data:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch curriculum data",
      subjects: [],
      grades: [],
      gradeSubjectPairs: []
    };
  }
}

// Delete content by type and ID
export async function deleteLibraryContent(contentId, contentType) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const userId = session.user.id;

    let collectionName;
    let query;

    switch (contentType) {
      case 'content':
        collectionName = 'contents';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'slides':
        collectionName = 'presentations';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'comic':
        collectionName = 'comics';
        query = { _id: new ObjectId(contentId), userId: new ObjectId(userId) };
        break;
      case 'image':
        collectionName = 'images';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'video':
        collectionName = 'videos';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'assessment':
        collectionName = 'assessments';
        query = { _id: new ObjectId(contentId), userId: new ObjectId(userId) };
        break;
      case 'websearch':
        collectionName = 'websearches'; // Fixed: Use correct collection name
        query = { _id: new ObjectId(contentId), userId: new ObjectId(userId) };
        break;
      default:
        throw new Error("Invalid content type");
    }

    const result = await db.collection(collectionName).deleteOne(query);

    if (result.deletedCount === 0) {
      throw new Error("Content not found or access denied");
    }

    return {
      success: true,
      message: "Content deleted successfully"
    };

  } catch (error) {
    console.error("Error deleting content:", error);
    return {
      success: false,
      error: error.message || "Failed to delete content"
    };
  }
}

// Add content to lesson functionality
export async function addContentToLesson(contentId, contentType, lessonData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const lessonsCollection = db.collection('lessons');

    // Check if lesson already exists for this content
    const existingLesson = await lessonsCollection.findOne({
      teacherId: new ObjectId(session.user.id),
      contentId: new ObjectId(contentId),
      contentType: contentType
    });

    if (existingLesson) {
      return {
        success: false,
        error: 'This content has already been added to a lesson',
        existingLessonId: existingLesson._id.toString(),
        message: 'A lesson for this content already exists'
      };
    }

    // Get the content from the appropriate collection
    let content;
    let collectionName;
    
    switch (contentType) {
      case 'content':
        collectionName = 'contents';
        content = await db.collection(collectionName).findOne({
          _id: new ObjectId(contentId),
          userId: session.user.id
        });
        break;
      case 'slides':
        collectionName = 'presentations';
        content = await db.collection(collectionName).findOne({
          _id: new ObjectId(contentId),
          userId: session.user.id
        });
        break;
      case 'comic':
        collectionName = 'comics';
        content = await db.collection(collectionName).findOne({
          _id: new ObjectId(contentId),
          userId: new ObjectId(session.user.id)
        });
        break;
      case 'image':
        collectionName = 'images';
        content = await db.collection(collectionName).findOne({
          _id: new ObjectId(contentId),
          userId: session.user.id
        });
        break;
      case 'video':
        collectionName = 'videos';
        content = await db.collection(collectionName).findOne({
          _id: new ObjectId(contentId),
          userId: session.user.id
        });
        break;
      case 'assessment':
        collectionName = 'assessments';
        content = await db.collection(collectionName).findOne({
          _id: new ObjectId(contentId),
          userId: new ObjectId(session.user.id)
        });
        break;
      case 'websearch':
        collectionName = 'websearches';
        content = await db.collection(collectionName).findOne({
          _id: new ObjectId(contentId),
          userId: new ObjectId(session.user.id)
        });
        break;
      default:
        throw new Error('Invalid content type');
    }

    if (!content) {
      throw new Error('Content not found or you do not have permission to access it');
    }

    // Create lesson document
    const lessonDocument = {
      teacherId: new ObjectId(session.user.id),
      contentId: new ObjectId(contentId),
      contentType: contentType,
      title: lessonData.title || `${content.title || content.topic || 'Untitled'} - Lesson`,
      subject: content.subject || 'General',
      grade: lessonData.grade || content.grade || 'All',
      topic: content.topic || content.title || 'General Topic',
      contentData: content.generatedContent || content.content || content.description || '',
      lessonDescription: lessonData.lessonDescription || `Lesson based on ${contentType}: ${content.title || content.topic || 'Untitled'}`,
      learningObjectives: lessonData.learningObjectives || '',
      duration: content.duration || 30,
      difficulty: content.difficulty || 'Medium',
      language: content.language || 'english',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: content.metadata?.tags || [],
        isPublic: lessonData.isPublic || false,
        viewCount: 0,
        completionCount: 0
      },
      status: 'published'
    };

    // **FIXED: Add ALL media URL fields for each content type**

    // For slides/presentations
    if (contentType === 'slides') {
      lessonDocument.presentationUrl = content.presentationUrl;
      lessonDocument.slideImages = content.slideImages;
      lessonDocument.slidesCount = content.slideCount || content.slidesCount;
      lessonDocument.slideCount = content.slideCount;
      lessonDocument.template = content.template;
      lessonDocument.verbosity = content.verbosity;
      lessonDocument.includeImages = content.includeImages;
      lessonDocument.downloadUrl = content.downloadUrl;
      lessonDocument.taskId = content.taskId;
      lessonDocument.taskStatus = content.taskStatus;
    }

    // For comics - ADD ALL COMIC URL FIELDS
    if (contentType === 'comic') {
      lessonDocument.imageUrls = content.imageUrls || [];
      lessonDocument.cloudinaryPublicIds = content.cloudinaryPublicIds || [];
      lessonDocument.panels = content.panels || [];
      lessonDocument.numPanels = content.numPanels || 0;
      lessonDocument.comicType = content.comicType || 'educational';
      lessonDocument.instruction = content.instruction;
      lessonDocument.panelTexts = content.panelTexts || [];
    }

    // For images - ADD ALL IMAGE URL FIELDS
    if (contentType === 'image') {
      lessonDocument.imageUrl = content.imageUrl;
      lessonDocument.cloudinaryPublicId = content.cloudinaryPublicId;
      lessonDocument.imageBase64 = content.imageBase64;
      lessonDocument.visualType = content.visualType;
      lessonDocument.instructions = content.instructions;
      lessonDocument.difficultyFlag = content.difficultyFlag;
    }

    // For videos - ADD ALL VIDEO URL FIELDS
    if (contentType === 'video') {
      lessonDocument.videoUrl = content.videoUrl;
      lessonDocument.thumbnailUrl = content.thumbnailUrl;
      lessonDocument.voiceName = content.voiceName;
      lessonDocument.talkingPhotoName = content.talkingPhotoName;
      lessonDocument.videoId = content.videoId;
      lessonDocument.slidesCount = content.slidesCount;
      lessonDocument.voiceId = content.voiceId;
      lessonDocument.talkingPhotoId = content.talkingPhotoId;
      lessonDocument.presentationUrl = content.presentationUrl;
    }

    // For assessments
    if (contentType === 'assessment') {
      lessonDocument.assessmentContent = content.generatedContent || content.assessmentContent;
      lessonDocument.assessmentId = content._id;
    }

    // For web searches
    if (contentType === 'websearch') {
      lessonDocument.searchResults = content.searchResults || content.generatedContent;
      lessonDocument.searchQuery = content.searchQuery;
    }

    const result = await lessonsCollection.insertOne(lessonDocument);

    return {
      success: true,
      lessonId: result.insertedId.toString(),
      message: 'Content added to lesson successfully!'
    };
  } catch (error) {
    console.error('Error adding content to lesson:', error);
    throw new Error(error.message || 'Failed to add content to lesson');
  }
}
