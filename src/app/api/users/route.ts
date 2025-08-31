import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { NextResponse, NextRequest } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const fids = searchParams.get('fids');
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Neynar API key is not configured. Please add NEYNAR_API_KEY to your environment variables.' },
      { status: 500 }
    );
  }

  if (!fids) {
    return NextResponse.json(
      { error: 'FIDs parameter is required' },
      { status: 400 }
    );
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey });
    const fidsArray = fids.split(',').map(fid => parseInt(fid.trim()));
    
    const { users } = await neynar.fetchBulkUsers({
      fids: fidsArray,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users. Please check your Neynar API key and try again.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, username, display_name, pfp_url, zupass_verified, has_talent_score, builder_score } = body;
    
    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Get or create user - pass all fields including talent/builder scores
    const user = await dbHelpers.upsertUser({
      fid,
      username,
      display_name,
      pfp_url,
      zupass_verified,
      has_talent_score,
      builder_score
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create/update user' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { error: 'Failed to create/update user' },
      { status: 500 }
    );
  }
}
