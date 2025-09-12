"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
    if (data._id && data._id.toString) {
      data._id = data._id.toString();
    }
    
    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.constructor === Date) {
        serialized[key] = value.toISOString();
      } else if (value && typeof value === 'object' && value.toString && value.toString().includes('ObjectId')) {
        serialized[key] = value.toString();
      } else {
        serialized[key] = serializeMongoData(value);
      }
    }
    return serialized;
  }
  
  return data;
}

// Get all conversations for a student
export async function getStudentConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    console.log('Fetching conversations for user:', session.user.id);

    const { db } = await connectToDatabase();
    const conversations = await db.collection('student_conversations')
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ 'metadata.lastMessageAt': -1 })
      .toArray();

    console.log('Found conversations:', conversations.length);

    return {
      success: true,
      data: serializeMongoData(conversations)
    };
  } catch (error) {
    console.error('Error fetching student conversations:', error);
    return { success: false, error: "Failed to fetch conversations" };
  }
}

// Get a specific conversation by ID
export async function getConversationById(conversationId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const conversation = await db.collection('student_conversations')
      .findOne({ 
        _id: new ObjectId(conversationId),
        studentId: new ObjectId(session.user.id)
      });

    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    return {
      success: true,
      data: serializeMongoData(conversation)
    };
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return { success: false, error: "Failed to fetch conversation" };
  }
}

// Save or update a conversation
export async function saveStudentConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const conversationData = JSON.parse(formData.get('conversationData'));
    console.log('Saving conversation data for user:', session.user.id);
    
    const { db } = await connectToDatabase();

    const conversation = {
      studentId: new ObjectId(session.user.id),
      sessionId: conversationData.sessionId,
      title: conversationData.title || `AI Tutor Chat - ${new Date().toLocaleDateString()}`,
      sessionType: conversationData.sessionType || 'text',
      messages: conversationData.messages || [],
      uploadedFiles: conversationData.uploadedFiles || [],
      studentData: conversationData.studentData || {},
      conversationStats: {
        totalMessages: conversationData.messages?.length || 0,
        userMessages: conversationData.messages?.filter(m => m.role === 'user').length || 0,
        aiMessages: conversationData.messages?.filter(m => m.role === 'assistant').length || 0,
        totalDuration: conversationData.totalDuration || 0,
        topicsDiscussed: conversationData.topicsDiscussed || [],
        difficultyLevel: conversationData.difficultyLevel || 'medium',
        learningOutcomes: conversationData.learningOutcomes || []
      },
      metadata: {
        createdAt: conversationData.metadata?.createdAt ? new Date(conversationData.metadata.createdAt) : new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: conversationData.metadata?.isActive !== false,
        tags: conversationData.metadata?.tags || []
      }
    };

    // Check if conversation already exists
    const existingConversation = await db.collection('student_conversations')
      .findOne({ sessionId: conversationData.sessionId });

    let result;
    if (existingConversation) {
      // Update existing conversation
      result = await db.collection('student_conversations')
        .updateOne(
          { sessionId: conversationData.sessionId },
          { $set: conversation }
        );
    } else {
      // Create new conversation
      result = await db.collection('student_conversations')
        .insertOne(conversation);
    }

    revalidatePath('/student/history');
    return { 
      success: true, 
      conversationId: (result.insertedId || existingConversation._id).toString() 
    };
  } catch (error) {
    console.error('Error saving conversation:', error);
    return { success: false, error: "Failed to save conversation" };
  }
}

// Delete a conversation
export async function deleteConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const conversationId = formData.get('conversationId');
    const { db } = await connectToDatabase();

    const result = await db.collection('student_conversations')
      .deleteOne({ 
        _id: new ObjectId(conversationId),
        studentId: new ObjectId(session.user.id)
      });

    if (result.deletedCount === 0) {
      return { success: false, error: "Conversation not found" };
    }

    revalidatePath('/student/history');
    return { success: true };
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return { success: false, error: "Failed to delete conversation" };
  }
}

// Update conversation title
export async function updateConversationTitle(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const conversationId = formData.get('conversationId');
    const newTitle = formData.get('title');
    const { db } = await connectToDatabase();

    const result = await db.collection('student_conversations')
      .updateOne(
        { 
          _id: new ObjectId(conversationId),
          studentId: new ObjectId(session.user.id)
        },
        { 
          $set: { 
            title: newTitle,
            'metadata.updatedAt': new Date()
          }
        }
      );

    if (result.matchedCount === 0) {
      return { success: false, error: "Conversation not found" };
    }

    revalidatePath('/student/history');
    return { success: true };
  } catch (error) {
    console.error('Error updating conversation title:', error);
    return { success: false, error: "Failed to update title" };
  }
}

// Get conversation statistics
export async function getConversationStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    
    const stats = await db.collection('student_conversations').aggregate([
      { $match: { studentId: new ObjectId(session.user.id) } },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: { $size: '$messages' } },
          totalUserMessages: { 
            $sum: { 
              $size: { 
                $filter: { 
                  input: '$messages', 
                  cond: { $eq: ['$$this.role', 'user'] } 
                } 
              } 
            } 
          },
          totalAiMessages: { 
            $sum: { 
              $size: { 
                $filter: { 
                  input: '$messages', 
                  cond: { $eq: ['$$this.role', 'assistant'] } 
                } 
              } 
            } 
          },
          averageMessagesPerConversation: { $avg: { $size: '$messages' } },
          lastConversationDate: { $max: '$metadata.lastMessageAt' }
        }
      }
    ]).toArray();

    return {
      success: true,
      data: stats[0] || {
        totalConversations: 0,
        totalMessages: 0,
        totalUserMessages: 0,
        totalAiMessages: 0,
        averageMessagesPerConversation: 0,
        lastConversationDate: null
      }
    };
  } catch (error) {
    console.error('Error fetching conversation stats:', error);
    return { success: false, error: "Failed to fetch conversation statistics" };
  }
}
