import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sessionType = searchParams.get('sessionType') || 'all';

    const { db } = await connectToDatabase();
    const userId = session.user.id;

    console.log('Fetching conversations for user:', userId);

    // Build query - use teacherId field primarily
    let query = { 
      teacherId: { $in: [new ObjectId(userId), userId] }
    };
    
    if (sessionType !== "all") {
      query.sessionType = sessionType;
    }

    console.log('Query:', JSON.stringify(query));

    // Get conversations with pagination
    const conversations = await db.collection('teacher_conversations')
      .find(query)
      .sort({ 'metadata.updatedAt': -1, 'metadata.createdAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    console.log('Found conversations:', conversations.length);

    // Get total count for pagination
    const totalCount = await db.collection('teacher_conversations')
      .countDocuments(query);

    // Serialize the data with proper message structure
    const serializedConversations = conversations.map(conv => {
      const lastMessage = conv.messages && conv.messages.length > 0 
        ? conv.messages[conv.messages.length - 1] 
        : null;
      
      return {
        _id: conv._id.toString(),
        teacherId: conv.teacherId?.toString() || userId,
        sessionId: conv.sessionId,
        title: conv.title || `Conversation ${conv.sessionId?.split('_').pop() || 'Unknown'}`,
        sessionType: conv.sessionType || "text",
        messageCount: conv.messages?.length || 0,
        lastMessage: lastMessage?.content || "No messages",
        lastMessageAt: conv.metadata?.updatedAt || conv.metadata?.createdAt || new Date(),
        createdAt: conv.metadata?.createdAt || new Date(),
        // Include the full messages array
        messages: (conv.messages || []).map(msg => ({
          id: msg.id || msg._id?.toString(),
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || conv.metadata?.updatedAt,
          isImageResponse: msg.isImageResponse || false,
          metadata: msg.metadata || {}
        })),
        uploadedFiles: conv.uploadedFiles || [],
        teacherData: conv.teacherData || {},
        conversationStats: conv.conversationStats || {
          totalMessages: conv.messages?.length || 0,
          userMessages: conv.messages?.filter(m => m.role === 'user').length || 0,
          aiMessages: conv.messages?.filter(m => m.role === 'assistant').length || 0,
          totalDuration: 0
        },
        metadata: {
          createdAt: conv.metadata?.createdAt || new Date(),
          updatedAt: conv.metadata?.updatedAt || new Date(),
          lastMessageAt: conv.metadata?.lastMessageAt || conv.metadata?.updatedAt || new Date(),
          isActive: conv.metadata?.isActive !== false,
          tags: conv.metadata?.tags || []
        }
      };
    });

    return NextResponse.json({
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
    });

  } catch (error) {
    console.error('Error in GET /api/teacher/conversations:', error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// Add a new endpoint to get a specific conversation with full details
export async function POST(request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const userId = session.user.id;

    const conversation = await db.collection('teacher_conversations')
      .findOne({ 
        _id: new ObjectId(conversationId),
        teacherId: { $in: [new ObjectId(userId), userId] }
      });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Serialize the conversation with full message details
    const serializedConversation = {
      _id: conversation._id.toString(),
      teacherId: conversation.teacherId?.toString() || userId,
      sessionId: conversation.sessionId,
      title: conversation.title || `Conversation ${conversation.sessionId?.split('_').pop() || 'Unknown'}`,
      sessionType: conversation.sessionType || "text",
      messages: (conversation.messages || []).map(msg => ({
        id: msg.id || msg._id?.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || conversation.metadata?.updatedAt,
        isImageResponse: msg.isImageResponse || false,
        metadata: msg.metadata || {}
      })),
      uploadedFiles: conversation.uploadedFiles || [],
      teacherData: conversation.teacherData || {},
      conversationStats: conversation.conversationStats || {
        totalMessages: conversation.messages?.length || 0,
        userMessages: conversation.messages?.filter(m => m.role === 'user').length || 0,
        aiMessages: conversation.messages?.filter(m => m.role === 'assistant').length || 0,
        totalDuration: 0
      },
      metadata: {
        createdAt: conversation.metadata?.createdAt || new Date(),
        updatedAt: conversation.metadata?.updatedAt || new Date(),
        lastMessageAt: conversation.metadata?.lastMessageAt || conversation.metadata?.updatedAt || new Date(),
        isActive: conversation.metadata?.isActive !== false,
        tags: conversation.metadata?.tags || []
      }
    };

    return NextResponse.json({
      success: true,
      data: serializedConversation
    });

  } catch (error) {
    console.error('Error in POST /api/teacher/conversations:', error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const userId = session.user.id;

    const result = await db.collection('teacher_conversations')
      .deleteOne({ 
        _id: new ObjectId(conversationId),
        teacherId: { $in: [new ObjectId(userId), userId] }
      });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Conversation not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation deleted successfully"
    });

  } catch (error) {
    console.error('Error in DELETE /api/teacher/conversations:', error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
