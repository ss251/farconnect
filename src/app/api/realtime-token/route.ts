import { NextRequest, NextResponse } from 'next/server';
import { generateAppJWT } from '~/lib/supabase-jwt';
import { dbHelpers } from '~/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid } = body;
    
    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Verify user exists and is verified
    const user = await dbHelpers.getUserByFid(fid);
    if (!user || !user.zupass_verified) {
      return NextResponse.json(
        { error: 'User not verified' },
        { status: 403 }
      );
    }

    // Generate custom JWT with audience claim
    const token = await generateAppJWT(user.id, fid);
    
    return NextResponse.json({ 
      token,
      expiresIn: 86400 // 24 hours in seconds
    });
  } catch (error) {
    console.error('Error generating realtime token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}