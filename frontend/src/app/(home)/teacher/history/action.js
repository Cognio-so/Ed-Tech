"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

// Helper function to serialize MongoDB objects
function serializeMongoData(data) {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => serializeMongoData(item));
  }
  
  if (typeof data === 'object') {
    if (data._id && typeof data._id.toString === 'function') {
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

/**
 * Get Voice Coach conversation history
 * @param {Object} formData - Form data containing pagination info
 * @returns {Promise<Object>} - Conversation history
 */
export async function getVoiceCoachConversationHistory(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const page = parseInt(formData.get("page")) || 1;
    const limit = parseInt(formData.get("limit")) || 10;
    const sessionType = formData.get("sessionType") || "all";

    const { db } = await connectToDatabase();
    
    // Build query
    const query = { teacherId: new ObjectId(session.user.id) };
    if (sessionType !== "all") {
      query.sessionType = sessionType;
    }

    // Get conversations with pagination
    const conversations = await db.collection('teacherConversations')
      .find(query)
      .sort({ 'metadata.lastMessageAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('teacherConversations')
      .countDocuments(query);

    // Serialize the data
    const serializedConversations = conversations.map(conv => ({
      _id: conv._id.toString(),
      teacherId: conv.teacherId.toString(),
      sessionId: conv.sessionId,
      title: conv.title,
      sessionType: conv.sessionType,
      messageCount: conv.messages.length,
      lastMessage: conv.messages[conv.messages.length - 1]?.content || "",
      lastMessageAt: conv.metadata.lastMessageAt.toISOString(),
      createdAt: conv.metadata.createdAt.toISOString(),
      conversationStats: conv.conversationStats,
      tags: conv.metadata.tags
    }));

    return {
      success: true,
      data: {
        conversations: serializedConversations,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    };
  } catch (error) {
    console.error("Error in getVoiceCoachConversationHistory:", error);
    return {
      success: false,
      error: error.message || "Failed to get conversation history"
    };
  }
}

/**
 * Get a specific Voice Coach conversation
 * @param {Object} formData - Form data containing conversation ID
 * @returns {Promise<Object>} - Conversation details
 */
export async function getVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");

    if (!conversationId) {
      return {
        success: false,
        error: "Conversation ID is required"
      };
    }

    const { db } = await connectToDatabase();
    
    const conversation = await db.collection('teacherConversations')
      .findOne({ 
        _id: new ObjectId(conversationId),
        teacherId: new ObjectId(session.user.id)
      });

    if (!conversation) {
      return {
        success: false,
        error: "Conversation not found"
      };
    }

    // Serialize the conversation data
    const serializedConversation = {
      _id: conversation._id.toString(),
      teacherId: conversation.teacherId.toString(),
      sessionId: conversation.sessionId,
      title: conversation.title,
      sessionType: conversation.sessionType,
      messages: conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        isImageResponse: msg.isImageResponse,
        metadata: msg.metadata
      })),
      uploadedFiles: conversation.uploadedFiles.map(file => ({
        filename: file.filename,
        originalName: file.originalName,
        fileType: file.fileType,
        uploadTime: file.uploadTime.toISOString()
      })),
      teacherData: conversation.teacherData,
      studentContext: conversation.studentContext,
      conversationStats: conversation.conversationStats,
      metadata: {
        ...conversation.metadata,
        createdAt: conversation.metadata.createdAt.toISOString(),
        updatedAt: conversation.metadata.updatedAt.toISOString(),
        lastMessageAt: conversation.metadata.lastMessageAt.toISOString()
      }
    };

    return {
      success: true,
      data: serializedConversation
    };
  } catch (error) {
    console.error("Error in getVoiceCoachConversation:", error);
    return {
      success: false,
      error: error.message || "Failed to get conversation"
    };
  }
}

/**
 * Delete a Voice Coach conversation
 * @param {Object} formData - Form data containing conversation ID
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");

    if (!conversationId) {
      return {
        success: false,
        error: "Conversation ID is required"
      };
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('teacherConversations')
      .deleteOne({ 
        _id: new ObjectId(conversationId),
        teacherId: new ObjectId(session.user.id)
      });

    if (result.deletedCount === 0) {
      return {
        success: false,
        error: "Conversation not found or already deleted"
      };
    }

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Conversation deleted successfully"
    };
  } catch (error) {
    console.error("Error in deleteVoiceCoachConversation:", error);
    return {
      success: false,
      error: error.message || "Failed to delete conversation"
    };
  }
}

/**
 * Update conversation title
 * @param {Object} formData - Form data containing conversation ID and new title
 * @returns {Promise<Object>} - Update result
 */
export async function updateVoiceCoachConversationTitle(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");
    const newTitle = formData.get("title");

    if (!conversationId || !newTitle) {
      return {
        success: false,
        error: "Conversation ID and title are required"
      };
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('teacherConversations')
      .updateOne(
        { 
          _id: new ObjectId(conversationId),
          teacherId: new ObjectId(session.user.id)
        },
        { 
          $set: { 
            title: newTitle,
            'metadata.updatedAt': new Date()
          }
        }
      );

    if (result.matchedCount === 0) {
      return {
        success: false,
        error: "Conversation not found"
      };
    }

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Conversation title updated successfully"
    };
  } catch (error) {
    console.error("Error in updateVoiceCoachConversationTitle:", error);
    return {
      success: false,
      error: error.message || "Failed to update conversation title"
    };
  }
}

/**
 * Debug function to check all conversations in database
 * @returns {Promise<Object>} - Debug info
 */
export async function debugConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();
    
    // Get all conversations for this teacher
    const allConversations = await db.collection('teacherConversations')
      .find({ teacherId: new ObjectId(session.user.id) })
      .toArray();

    // Get all conversations in the database (for debugging)
    const allConversationsInDb = await db.collection('teacherConversations')
      .find({})
      .toArray();

    console.log('Debug - All conversations for teacher:', allConversations.length);
    console.log('Debug - All conversations in DB:', allConversationsInDb.length);
    console.log('Debug - Teacher ID:', session.user.id);

    return {
      success: true,
      data: {
        teacherConversations: allConversations.length,
        totalConversations: allConversationsInDb.length,
        teacherId: session.user.id,
        conversations: allConversations.map(conv => ({
          _id: conv._id.toString(),
          teacherId: conv.teacherId?.toString(),
          sessionId: conv.sessionId,
          title: conv.title,
          sessionType: conv.sessionType,
          messageCount: conv.messages?.length || 0
        }))
      }
    };
  } catch (error) {
    console.error("Error in debugConversations:", error);
    return {
      success: false,
      error: error.message || "Failed to debug conversations"
    };
  }
}

