"use server";
import { ObjectId } from "mongodb";
import PythonApiClient from "@/lib/PythonApi.js";
import { connectToDatabase } from "@/lib/db.js";
import { getServerSession } from "@/lib/get-session.js";

export async function generateContent(formData) {
  try {
    const contentData = {
      contentType: formData.contentType,
      subject: formData.subjects[0],
      topic: formData.topic,
      grade: formData.grades[0],
      objectives: formData.objective,
      emotionalFlags: formData.emotionalConsideration,
      instructionalDepth: formData.instructionDepth,
      contentVersion: formData.contentVersion,
      adaptiveLevel: formData.adaptiveLearning,
      includeAssessment: formData.includeAssessment,
      multimediaSuggestions: formData.multimediaSuggestions,
      language: formData.language === "arabic" ? "Arabic" : "English",
      webSearchEnabled: true
    };

    const response = await PythonApiClient.generateContent(contentData);

    return {
      success: true,
      data: response,
      generatedContent: response.generated_content
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to generate content"
    };
  }
}

export async function generateSlidesFromContent(contentData) {
  try {
    const slideData = {
      content: contentData.content,
      topic: contentData.topic,
      slideCount: contentData.slideCount || 10,
      language: contentData.language === "arabic" ? "ARABIC" : "ENGLISH",
      template: contentData.template || "default"
    };

    const response = await PythonApiClient.generateSlidesFromContent(slideData);

    return {
      success: true,
      data: response,
      presentation: response.presentation
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to generate slides"
    };
  }
}

export async function saveContentToDatabase(contentData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const contentsCollection = db.collection("contents");

    const contentDocument = {
      userId: session.user.id,
      title: contentData.title || `${contentData.contentType} - ${contentData.topic}`,
      contentType: contentData.contentType,
      subject: contentData.subjects ? contentData.subjects[0] : null,
      grade: contentData.grades ? contentData.grades[0] : null,
      topic: contentData.topic,
      objective: contentData.objective,
      emotionalConsideration: contentData.emotionalConsideration,
      language: contentData.language,
      adaptiveLearning: contentData.adaptiveLearning || false,
      includeAssessment: contentData.includeAssessment || false,
      multimediaSuggestions: contentData.multimediaSuggestions || false,
      instructionDepth: contentData.instructionDepth,
      contentVersion: contentData.contentVersion,
      generatedContent: contentData.generatedContent,
      presentation: contentData.presentation || null,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: contentData.tags || [],
        isPublic: contentData.isPublic || false,
        downloadCount: 0
      },
      status: "draft"
    };

    const result = await contentsCollection.insertOne(contentDocument);

    return {
      success: true,
      contentId: result.insertedId.toString(),
      message: "Content saved to database successfully"
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to save content to database"
    };
  }
}

export async function getUserContent(userId = null) {
  try {
    const session = await getServerSession();
    const targetUserId = userId || session?.user?.id;

    if (!targetUserId) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const contentsCollection = db.collection("contents");

    const contents = await contentsCollection
      .find({ userId: targetUserId })
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    const serializedContents = contents.map(content => ({
      ...content,
      _id: content._id.toString(),
      userId: content.userId.toString()
    }));

    return {
      success: true,
      contents: serializedContents
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to fetch user content"
    };
  }
}

export async function updateContentInDatabase(contentId, updateData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const contentsCollection = db.collection("contents");

    const updateDocument = {
      "metadata.updatedAt": new Date()
    };

    if (updateData.generatedContent !== undefined) {
      updateDocument.generatedContent = updateData.generatedContent;
    }

    if (updateData.contentType) {
      updateDocument.title = updateData.title || `${updateData.contentType} - ${updateData.topic}`;
      updateDocument.contentType = updateData.contentType;
      updateDocument.subject = updateData.subjects ? updateData.subjects[0] : null;
      updateDocument.grade = updateData.grades ? updateData.grades[0] : null;
      updateDocument.topic = updateData.topic;
      updateDocument.objective = updateData.objective;
      updateDocument.emotionalConsideration = updateData.emotionalConsideration;
      updateDocument.language = updateData.language;
      updateDocument.adaptiveLearning = updateData.adaptiveLearning || false;
      updateDocument.includeAssessment = updateData.includeAssessment || false;
      updateDocument.multimediaSuggestions = updateData.multimediaSuggestions || false;
      updateDocument.instructionDepth = updateData.instructionDepth;
      updateDocument.contentVersion = updateData.contentVersion;
    }

    console.log("Updating content with document:", updateDocument);

    const result = await contentsCollection.updateOne(
      {
        _id: new ObjectId(contentId),
        userId: session.user.id
      },
      { $set: updateDocument }
    );

    if (result.matchedCount === 0) {
      throw new Error("Content not found or access denied");
    }

    return {
      success: true,
      message: "Content updated successfully"
    };
  } catch (error) {
    console.error("Error updating content:", error);
    return {
      success: false,
      error: error.message || "Failed to update content"
    };
  }
}

export async function deleteContentFromDatabase(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const contentsCollection = db.collection("contents");

    const result = await contentsCollection.deleteOne({
      _id: new ObjectId(contentId),
      userId: session.user.id
    });

    if (result.deletedCount === 0) {
      throw new Error("Content not found or access denied");
    }

    return {
      success: true,
      message: "Content deleted from database successfully"
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to delete content from database"
    };
  }
}

export async function savePresentationToDatabase(presentationData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const presentationsCollection = db.collection("presentations");

    const presentationDocument = {
      userId: session.user.id,
      title: presentationData.title,
      topic: presentationData.topic,
      slideCount: presentationData.slideCount,
      template: presentationData.template,
      language: presentationData.language,
      presentationUrl: presentationData.presentationUrl,
      downloadUrl: presentationData.downloadUrl,
      taskId: presentationData.taskId,
      taskStatus: presentationData.taskStatus,
      contentId: presentationData.contentId || null,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: presentationData.tags || [],
        isPublic: presentationData.isPublic || false,
        downloadCount: 0,
        viewCount: 0
      },
      status: "saved"
    };

    const result = await presentationsCollection.insertOne(presentationDocument);

    return {
      success: true,
      presentationId: result.insertedId.toString(),
      message: "Presentation saved to database successfully"
    };
  } catch (error) {
    console.error("Error saving presentation:", error);
    return {
      success: false,
      error: error.message || "Failed to save presentation to database"
    };
  }
}

export async function getUserPresentations(userId = null) {
  try {
    const session = await getServerSession();
    const targetUserId = userId || session?.user?.id;

    if (!targetUserId) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const presentationsCollection = db.collection("presentations");

    const presentations = await presentationsCollection
      .find({ userId: targetUserId })
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    const serializedPresentations = presentations.map(presentation => ({
      ...presentation,
      _id: presentation._id.toString(),
      userId: presentation.userId.toString()
    }));

    return {
      success: true,
      presentations: serializedPresentations
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to fetch user presentations"
    };
  }
}

export async function deletePresentationFromDatabase(presentationId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const presentationsCollection = db.collection("presentations");

    const result = await presentationsCollection.deleteOne({
      _id: new ObjectId(presentationId),
      userId: session.user.id
    });

    if (result.deletedCount === 0) {
      throw new Error("Presentation not found or access denied");
    }

    return {
      success: true,
      message: "Presentation deleted from database successfully"
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to delete presentation from database"
    };
  }
}

// Get user's assigned grades and subjects
export async function getUserAssignedGradesAndSubjects() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return {
      success: true,
      grades: user.grades || [],
      subjects: user.subjects || []
    };
  } catch (error) {
    console.error("Error fetching user grades and subjects:", error);
    return {
      success: false,
      grades: [],
      subjects: [],
      error: error.message || "Failed to fetch user data"
    };
  }
}

// Lesson CRUD operations for Content Generation
export async function addContentToLesson(contentId, lessonData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const contentsCollection = db.collection('contents');
    const lessonsCollection = db.collection('lessons');

    // Check if lesson already exists for this content
    const existingLesson = await lessonsCollection.findOne({
      teacherId: new ObjectId(session.user.id),
      contentId: new ObjectId(contentId)
    });

    if (existingLesson) {
      return {
        success: false,
        error: 'This content has already been added to a lesson',
        existingLessonId: existingLesson._id.toString(),
        message: 'A lesson for this content already exists'
      };
    }

    // Get the content
    const content = await contentsCollection.findOne({
      _id: new ObjectId(contentId),
      userId: session.user.id
    });

    if (!content) {
      throw new Error('Content not found or you do not have permission to access it');
    }

    // Create lesson document
    const lessonDocument = {
      teacherId: new ObjectId(session.user.id),
      contentId: new ObjectId(contentId), // Reference to content instead of assessment
      title: lessonData.title || `${content.title || content.topic} - Lesson`,
      subject: content.subject,
      grade: content.grade,
      topic: content.topic,
      contentData: content.generatedContent, // Store the generated content
      lessonDescription: lessonData.lessonDescription || `Lesson based on content: ${content.title || content.topic}`,
      learningObjectives: lessonData.learningObjectives || content.objective || '',
      duration: 30, // Default duration for content-based lessons
      difficulty: 'Medium', // Default difficulty
      language: content.language,
      contentType: content.contentType, // Store the original content type
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [content.subject, content.grade, content.contentType],
        isPublic: lessonData.isPublic || false,
        viewCount: 0,
        completionCount: 0
      },
      status: 'published'
    };

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

export async function getTeacherLessons() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const lessonsCollection = db.collection('lessons');

    const lessons = await lessonsCollection
      .find({ teacherId: new ObjectId(session.user.id) })
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    const transformedLessons = lessons.map(lesson => ({
      id: lesson._id.toString(),
      teacherId: lesson.teacherId.toString(),
      contentId: lesson.contentId?.toString() || lesson.assessmentId?.toString(),
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      topic: lesson.topic,
      contentData: lesson.contentData || lesson.assessmentContent,
      lessonDescription: lesson.lessonDescription,
      learningObjectives: lesson.learningObjectives,
      duration: lesson.duration,
      difficulty: lesson.difficulty,
      language: lesson.language,
      contentType: lesson.contentType || 'lesson',
      metadata: {
        ...lesson.metadata,
        createdAt: lesson.metadata.createdAt.toISOString(),
        updatedAt: lesson.metadata.updatedAt.toISOString()
      },
      status: lesson.status
    }));

    return transformedLessons;
  } catch (error) {
    console.error('Error fetching teacher lessons:', error);
    throw new Error('Failed to fetch lessons');
  }
}

export async function updateLesson(lessonId, updateData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const lessonsCollection = db.collection('lessons');

    const updateDocument = {
      ...updateData,
      'metadata.updatedAt': new Date()
    };

    const result = await lessonsCollection.updateOne(
      {
        _id: new ObjectId(lessonId),
        teacherId: new ObjectId(session.user.id)
      },
      { $set: updateDocument }
    );

    if (result.matchedCount === 0) {
      throw new Error('Lesson not found or access denied');
    }

    return {
      success: true,
      message: 'Lesson updated successfully!'
    };
  } catch (error) {
    console.error('Error updating lesson:', error);
    throw new Error(error.message || 'Failed to update lesson');
  }
}

export async function deleteLesson(lessonId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const lessonsCollection = db.collection('lessons');

    const result = await lessonsCollection.deleteOne({
      _id: new ObjectId(lessonId),
      teacherId: new ObjectId(session.user.id)
    });

    if (result.deletedCount === 0) {
      throw new Error('Lesson not found or access denied');
    }

    return {
      success: true,
      message: 'Lesson deleted successfully!'
    };
  } catch (error) {
    console.error('Error deleting lesson:', error);
    throw new Error(error.message || 'Failed to delete lesson');
  }
}