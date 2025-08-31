import { NextRequest, NextResponse } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    const messages = await dbHelpers.getMessages(roomId);
    
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, content, userId } = body;
    
    if (!roomId || !content || !userId) {
      return NextResponse.json(
        { error: 'Room ID, content, and user ID are required' },
        { status: 400 }
      );
    }

    const message = await dbHelpers.createMessage({
      room_id: roomId,
      content,
      user_id: userId
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