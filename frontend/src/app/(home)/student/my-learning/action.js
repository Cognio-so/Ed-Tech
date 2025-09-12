"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Get all student progress records
export async function getStudentProgress() {
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

    return { success: true, data: progressItems };
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return { success: false, error: error.message };
  }
}

// Get specific progress record
export async function getProgressById(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const progressItem = await db.collection('studentProgress')
      .findOne({ 
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId)
      });

    return { success: true, data: progressItem };
  } catch (error) {
    console.error('Error fetching progress by ID:', error);
    return { success: false, error: error.message };
  }
}

// Update progress record
export async function updateProgress(progressData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const { contentId, ...updateData } = progressData;
    
    const result = await db.collection('studentProgress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId)
      },
      {
        $set: {
          ...updateData,
          'metadata.updatedAt': new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    return { success: true, data: result };
  } catch (error) {
    console.error('Error updating progress:', error);
    return { success: false, error: error.message };
  }
}

// Add feedback to completed content
export async function addFeedback(contentId, feedback) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('studentProgress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId),
        status: 'completed'
      },
      {
        $set: {
          'completionData.feedback': feedback,
          'metadata.updatedAt': new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!result) {
      throw new Error('Progress record not found or content not completed');
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding feedback:', error);
    return { success: false, error: error.message };
  }
}

// Update feedback
export async function updateFeedback(contentId, feedback) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('studentProgress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId),
        status: 'completed'
      },
      {
        $set: {
          'completionData.feedback': feedback,
          'metadata.updatedAt': new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!result) {
      throw new Error('Progress record not found or content not completed');
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error updating feedback:', error);
    return { success: false, error: error.message };
  }
}

// Delete feedback
export async function deleteFeedback(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('studentProgress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId)
      },
      {
        $unset: {
          'completionData.feedback': ""
        },
        $set: {
          'metadata.updatedAt': new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!result) {
      throw new Error('Progress record not found');
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return { success: false, error: error.message };
  }
}

// Bookmark content
export async function toggleBookmark(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    // First get the current bookmark status
    const currentRecord = await db.collection('studentProgress').findOne({
      studentId: new ObjectId(session.user.id),
      contentId: new ObjectId(contentId)
    });

    const newBookmarkStatus = !currentRecord?.metadata?.bookmarked;

    const result = await db.collection('studentProgress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId)
      },
      {
        $set: {
          'metadata.bookmarked': newBookmarkStatus,
          'metadata.updatedAt': new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    return { success: true, data: result, bookmarked: newBookmarkStatus };
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    return { success: false, error: error.message };
  }
}

// Get progress statistics
export async function getProgressStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const { db } = await connectToDatabase();
    
    const stats = await db.collection('studentProgress').aggregate([
      { $match: { studentId: new ObjectId(session.user.id) } },
      {
        $group: {
          _id: null,
          totalContent: { $sum: 1 },
          completedContent: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          inProgressContent: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          totalTimeSpent: { $sum: '$progress.timeSpent' },
          averageScore: {
            $avg: {
              $cond: [
                { $ne: ['$completionData.score', null] },
                '$completionData.score',
                null
              ]
            }
          },
          bookmarkedContent: {
            $sum: { $cond: [{ $eq: ['$metadata.bookmarked', true] }, 1, 0] }
          }
        }
      }
    ]).toArray();

    return { success: true, data: stats[0] || {
      totalContent: 0,
      completedContent: 0,
      inProgressContent: 0,
      totalTimeSpent: 0,
      averageScore: 0,
      bookmarkedContent: 0
    }};
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    return { success: false, error: error.message };
  }
}
