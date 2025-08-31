import { NextResponse } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';

export async function GET() {
  try {
    const rooms = await dbHelpers.getRooms();
    
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}