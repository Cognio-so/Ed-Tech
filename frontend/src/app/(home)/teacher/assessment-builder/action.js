'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import PythonApiClient from '@/lib/PythonApi';
import { ObjectId } from 'mongodb';


export async function generateAssessment(assessmentData) {
    try {
        console.log('Generating assessment with data:', assessmentData);

        const session = await getServerSession();
        if (!session?.user?.id) {
            throw new Error('User not authenticated');
        }

        const result = await PythonApiClient.generateAssessment(assessmentData);

        if (!result || !result.assessment) {
            throw new Error('Failed to generate assessment. Please try again.');
        }

        // Don't save to database automatically - just return the generated content
        const generatedAssessment = {
            id: `temp_${Date.now()}`, // Temporary ID for preview
            userId: session.user.id, // String, not ObjectId
            title: assessmentData.title,
            subject: assessmentData.subject,
            grade: assessmentData.grade,
            topic: assessmentData.topic,
            duration: parseInt(assessmentData.duration),
            difficulty: assessmentData.difficulty,
            language: assessmentData.language,
            numQuestions: parseInt(assessmentData.numQuestions),
            questionTypes: assessmentData.questionTypes,
            questionDistribution: assessmentData.questionDistribution,
            learningObjectives: assessmentData.learningObjectives || '',
            anxietyTriggers: assessmentData.anxietyTriggers || '',
            customPrompt: assessmentData.customPrompt || '',
            generatedContent: result.assessment,
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                tags: [assessmentData.subject, assessmentData.grade, assessmentData.difficulty],
                isPublic: false,
                downloadCount: 0,
                shareCount: 0
            },
            status: 'draft', // Not saved yet
            version: 1
        };

        console.log('Assessment generated successfully (not saved yet):', generatedAssessment);

        return {
            success: true,
            assessment: generatedAssessment,
            message: 'Assessment generated successfully! Click Save to store it in your database.'
        };

    } catch (error) {
        console.error('Error generating assessment:', error);
        throw new Error(error.message || 'Failed to generate assessment. Please try again.');
    }
}


export async function updateAssessment(assessmentId, assessmentData) {
    try {
        console.log('Updating assessment:', assessmentId, assessmentData);

        const session = await getServerSession();
        if (!session?.user?.id) {
            throw new Error('User not authenticated');
        }

        const { db } = await connectToDatabase();
        const assessmentsCollection = db.collection('assessments');

        // Check if this is a new assessment (temp ID) or existing one
        const isNewAssessment = assessmentId.startsWith('temp_');

        if (isNewAssessment) {
            // Create new assessment
            const assessmentDocument = {
                userId: new ObjectId(session.user.id),
                title: assessmentData.title,
                subject: assessmentData.subject,
                grade: assessmentData.grade,
                topic: assessmentData.topic,
                duration: parseInt(assessmentData.duration),
                difficulty: assessmentData.difficulty,
                language: assessmentData.language,
                numQuestions: parseInt(assessmentData.numQuestions),
                questionTypes: assessmentData.questionTypes,
                questionDistribution: assessmentData.questionDistribution,
                learningObjectives: assessmentData.learningObjectives || '',
                anxietyTriggers: assessmentData.anxietyTriggers || '',
                customPrompt: assessmentData.customPrompt || '',
                generatedContent: assessmentData.generatedContent,
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    tags: [assessmentData.subject, assessmentData.grade, assessmentData.difficulty],
                    isPublic: false,
                    downloadCount: 0,
                    shareCount: 0
                },
                status: 'generated',
                version: 1
            };

            const dbResult = await assessmentsCollection.insertOne(assessmentDocument);

            const savedAssessment = {
                id: dbResult.insertedId.toString(),
                userId: session.user.id,
                title: assessmentData.title,
                subject: assessmentData.subject,
                grade: assessmentData.grade,
                topic: assessmentData.topic,
                duration: parseInt(assessmentData.duration),
                difficulty: assessmentData.difficulty,
                language: assessmentData.language,
                numQuestions: parseInt(assessmentData.numQuestions),
                questionTypes: assessmentData.questionTypes,
                questionDistribution: assessmentData.questionDistribution,
                learningObjectives: assessmentData.learningObjectives || '',
                anxietyTriggers: assessmentData.anxietyTriggers || '',
                customPrompt: assessmentData.customPrompt || '',
                generatedContent: assessmentData.generatedContent,
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    tags: [assessmentData.subject, assessmentData.grade, assessmentData.difficulty],
                    isPublic: false,
                    downloadCount: 0,
                    shareCount: 0
                },
                status: 'generated',
                version: 1
            };

            console.log('Assessment saved successfully:', savedAssessment);

            revalidatePath('/teacher/assessment-builder');

            return {
                success: true,
                assessment: savedAssessment,
                message: 'Assessment saved successfully!'
            };
        } else {
            // Update existing assessment
            const existingAssessment = await assessmentsCollection.findOne({
                _id: new ObjectId(assessmentId),
                userId: new ObjectId(session.user.id)
            });

            if (!existingAssessment) {
                throw new Error('Assessment not found or you do not have permission to edit it');
            }

            const shouldRegenerate = assessmentData.regenerate || false;

            let generatedContent = existingAssessment.generatedContent;
            if (shouldRegenerate) {
                const result = await PythonApiClient.generateAssessment(assessmentData);
                if (result && result.assessment) {
                    generatedContent = result.assessment;
                }
            }

            const updateData = {
                title: assessmentData.title,
                subject: assessmentData.subject,
                grade: assessmentData.grade,
                topic: assessmentData.topic,
                duration: parseInt(assessmentData.duration),
                difficulty: assessmentData.difficulty,
                language: assessmentData.language,
                numQuestions: parseInt(assessmentData.numQuestions),
                questionTypes: assessmentData.questionTypes,
                questionDistribution: assessmentData.questionDistribution,
                learningObjectives: assessmentData.learningObjectives || '',
                anxietyTriggers: assessmentData.anxietyTriggers || '',
                customPrompt: assessmentData.customPrompt || '',
                generatedContent: generatedContent,
                'metadata.updatedAt': new Date(),
                'metadata.tags': [assessmentData.subject, assessmentData.grade, assessmentData.difficulty],
                version: existingAssessment.version + 1
            };

            const result = await assessmentsCollection.updateOne(
                { _id: new ObjectId(assessmentId) },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                throw new Error('Assessment not found');
            }

            const updatedAssessment = await assessmentsCollection.findOne({
                _id: new ObjectId(assessmentId)
            });

            const transformedAssessment = {
                id: updatedAssessment._id.toString(),
                userId: session.user.id,
                title: updatedAssessment.title,
                subject: updatedAssessment.subject,
                grade: updatedAssessment.grade,
                topic: updatedAssessment.topic,
                duration: updatedAssessment.duration,
                difficulty: updatedAssessment.difficulty,
                language: updatedAssessment.language,
                numQuestions: updatedAssessment.numQuestions,
                questionTypes: updatedAssessment.questionTypes,
                questionDistribution: updatedAssessment.questionDistribution,
                learningObjectives: updatedAssessment.learningObjectives,
                anxietyTriggers: updatedAssessment.anxietyTriggers,
                customPrompt: updatedAssessment.customPrompt,
                generatedContent: updatedAssessment.generatedContent,
                metadata: {
                    ...updatedAssessment.metadata,
                    createdAt: updatedAssessment.metadata.createdAt.toISOString(),
                    updatedAt: updatedAssessment.metadata.updatedAt.toISOString()
                },
                status: updatedAssessment.status,
                version: updatedAssessment.version
            };

            console.log('Assessment updated successfully:', transformedAssessment);

            revalidatePath('/teacher/assessment-builder');

            return {
                success: true,
                assessment: transformedAssessment,
                message: 'Assessment updated successfully!'
            };
        }

    } catch (error) {
        console.error('Error updating assessment:', error);
        throw new Error(error.message || 'Failed to update assessment. Please try again.');
    }
}


export async function deleteAssessment(assessmentId) {
    try {
        console.log('Deleting assessment:', assessmentId);


        const session = await getServerSession();
        if (!session?.user?.id) {
            throw new Error('User not authenticated');
        }


        const { db } = await connectToDatabase();
        const assessmentsCollection = db.collection('assessments');


        const existingAssessment = await assessmentsCollection.findOne({
            _id: new ObjectId(assessmentId),
            userId: new ObjectId(session.user.id)
        });

        if (!existingAssessment) {
            throw new Error('Assessment not found or you do not have permission to delete it');
        }


        const result = await assessmentsCollection.deleteOne({
            _id: new ObjectId(assessmentId),
            userId: new ObjectId(session.user.id)
        });

        if (result.deletedCount === 0) {
            throw new Error('Failed to delete assessment');
        }

        console.log('Assessment deleted successfully:', assessmentId);


        revalidatePath('/teacher/assessment-builder');

        return {
            success: true,
            message: 'Assessment deleted successfully!'
        };

    } catch (error) {
        console.error('Error deleting assessment:', error);
        throw new Error(error.message || 'Failed to delete assessment. Please try again.');
    }
}


export async function getAssessments() {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            throw new Error('User not authenticated');
        }

        const { db } = await connectToDatabase();
        const assessmentsCollection = db.collection('assessments');

        const assessments = await assessmentsCollection
            .find({ userId: new ObjectId(session.user.id) })
            .sort({ 'metadata.createdAt': -1 })
            .toArray();

        // Convert ObjectIds and Dates to strings for client components
        const transformedAssessments = assessments.map(assessment => ({
            id: assessment._id.toString(),
            userId: assessment.userId.toString(), // Convert ObjectId to string
            title: assessment.title,
            subject: assessment.subject,
            grade: assessment.grade,
            topic: assessment.topic,
            duration: assessment.duration,
            difficulty: assessment.difficulty,
            language: assessment.language,
            numQuestions: assessment.numQuestions,
            questionTypes: assessment.questionTypes,
            questionDistribution: assessment.questionDistribution,
            learningObjectives: assessment.learningObjectives,
            anxietyTriggers: assessment.anxietyTriggers,
            customPrompt: assessment.customPrompt,
            generatedContent: assessment.generatedContent,
            metadata: {
                ...assessment.metadata,
                createdAt: assessment.metadata.createdAt.toISOString(), // Convert Date to string
                updatedAt: assessment.metadata.updatedAt.toISOString() // Convert Date to string
            },
            status: assessment.status,
            version: assessment.version
        }));

        return transformedAssessments;
    } catch (error) {
        console.error('Error fetching assessments:', error);
        throw new Error('Failed to fetch assessments. Please try again.');
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

// Lesson CRUD operations
export async function addAssessmentToLesson(assessmentId, lessonData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const assessmentsCollection = db.collection('assessments');
    const lessonsCollection = db.collection('lessons');

    // Check if lesson already exists for this assessment
    const existingLesson = await lessonsCollection.findOne({
      teacherId: new ObjectId(session.user.id),
      assessmentId: new ObjectId(assessmentId)
    });

    if (existingLesson) {
      return {
        success: false,
        error: 'This assessment has already been added to a lesson',
        existingLessonId: existingLesson._id.toString(),
        message: 'A lesson for this assessment already exists'
      };
    }

    // Get the assessment
    const assessment = await assessmentsCollection.findOne({
      _id: new ObjectId(assessmentId),
      userId: new ObjectId(session.user.id)
    });

    if (!assessment) {
      throw new Error('Assessment not found or you do not have permission to access it');
    }

    // Create lesson document
    const lessonDocument = {
      teacherId: new ObjectId(session.user.id),
      assessmentId: new ObjectId(assessmentId),
      title: lessonData.title || `${assessment.title} - Lesson`,
      subject: assessment.subject,
      grade: assessment.grade,
      topic: assessment.topic,
      assessmentContent: assessment.generatedContent,
      lessonDescription: lessonData.lessonDescription || `Lesson based on assessment: ${assessment.title}`,
      learningObjectives: lessonData.learningObjectives || assessment.learningObjectives || '',
      duration: assessment.duration,
      difficulty: assessment.difficulty,
      language: assessment.language,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [assessment.subject, assessment.grade, assessment.difficulty],
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
      message: 'Assessment added to lesson successfully!'
    };
  } catch (error) {
    console.error('Error adding assessment to lesson:', error);
    throw new Error(error.message || 'Failed to add assessment to lesson');
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
      assessmentId: lesson.assessmentId.toString(),
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      topic: lesson.topic,
      assessmentContent: lesson.assessmentContent,
      lessonDescription: lesson.lessonDescription,
      learningObjectives: lesson.learningObjectives,
      duration: lesson.duration,
      difficulty: lesson.difficulty,
      language: lesson.language,
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

    revalidatePath('/teacher/assessment-builder');

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

    revalidatePath('/teacher/assessment-builder');

    return {
      success: true,
      message: 'Lesson deleted successfully!'
    };
  } catch (error) {
    console.error('Error deleting lesson:', error);
    throw new Error(error.message || 'Failed to delete lesson');
  }
}

// Get lessons for students based on their grade
export async function getStudentLessons() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const lessonsCollection = db.collection('lessons');

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

    // Get lessons for the student's grade
    const lessons = await lessonsCollection
      .find({ 
        grade: { $in: user.grades },
        status: 'published'
      })
      .sort({ 'metadata.createdAt': -1 })
      .toArray();

    const transformedLessons = lessons.map(lesson => ({
      id: lesson._id.toString(),
      teacherId: lesson.teacherId.toString(),
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      topic: lesson.topic,
      assessmentContent: lesson.assessmentContent,
      lessonDescription: lesson.lessonDescription,
      learningObjectives: lesson.learningObjectives,
      duration: lesson.duration,
      difficulty: lesson.difficulty,
      language: lesson.language,
      metadata: {
        ...lesson.metadata,
        createdAt: lesson.metadata.createdAt.toISOString(),
        updatedAt: lesson.metadata.updatedAt.toISOString()
      },
      status: lesson.status
    }));

    return {
      success: true,
      lessons: transformedLessons
    };
  } catch (error) {
    console.error('Error fetching student lessons:', error);
    throw new Error(error.message || 'Failed to fetch lessons');
  }
}


