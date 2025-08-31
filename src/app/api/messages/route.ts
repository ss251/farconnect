import { NextRequest, NextResponse } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';
import { rateLimiters, rateLimit, rateLimitResponse } from '~/lib/rate-limiter';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, rateLimiters.read, 60); // 60 requests per minute
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const messageId = searchParams.get('messageId');
    const afterId = searchParams.get('afterId');
    const countOnly = searchParams.get('countOnly');
    
    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // If fetching a specific message by ID
    if (messageId) {
      const message = await dbHelpers.getMessageById(messageId);
      return NextResponse.json({ message });
    }

    // If countOnly, just return active users count
    if (countOnly === 'true') {
      const messages = await dbHelpers.getMessages(roomId);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const recentMessages = messages.filter(m => 
        new Date(m.created_at) > new Date(fiveMinutesAgo)
      );
      const activeUsers = new Set(recentMessages.map(m => m.user?.fid)).size;
      return NextResponse.json({ activeUsers });
    }

    // Get messages, optionally after a specific ID
    let messages = await dbHelpers.getMessages(roomId);
    
    // If afterId is provided, only return messages after that ID
    if (afterId) {
      const afterIndex = messages.findIndex(m => m.id === afterId);
      if (afterIndex !== -1) {
        messages = messages.slice(afterIndex + 1);
      }
    }
    
    // Get unique active users in last 5 minutes
    const allMessages = await dbHelpers.getMessages(roomId); // Need all for active users
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recentMessages = allMessages.filter(m => 
      new Date(m.created_at) > new Date(fiveMinutesAgo)
    );
    const activeUsers = new Set(recentMessages.map(m => m.user?.fid)).size;
    
    return NextResponse.json({ messages, activeUsers });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting - stricter for sending messages
  const rateLimitResult = await rateLimit(request, rateLimiters.messages, 30); // 30 messages per minute
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const body = await request.json();
    const { roomId, content, userId, messageType, metadata } = body;
    
    if (!roomId || !content || !userId) {
      return NextResponse.json(
        { error: 'Room ID, content, and user ID are required' },
        { status: 400 }
      );
    }

    const message = await dbHelpers.createMessage({
      room_id: roomId,
      content,
      user_id: userId,
      message_type: messageType || 'text',
      metadata: metadata || null
    });
    
    if (!message) {
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}