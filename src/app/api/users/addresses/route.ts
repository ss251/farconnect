import { NextRequest, NextResponse } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Fetch verified addresses from Neynar API
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          'api_key': process.env.NEYNAR_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch user data from Neynar');
    }

    const data = await response.json();
    const user = data.users?.[0];
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Extract verified Ethereum addresses
    const ethAddresses = user.verified_addresses?.eth_addresses || [];
    
    // Update user in database with verified addresses
    if (ethAddresses.length > 0) {
      await dbHelpers.upsertUser({
        fid: parseInt(fid),
        verified_addresses: {
          eth_addresses: ethAddresses
        }
      } as any);
    }

    return NextResponse.json({ 
      addresses: ethAddresses,
      primaryAddress: ethAddresses[0] || null
    });
  } catch (error) {
    console.error('Error fetching user addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch addresses' },
      { status: 500 }
    );
  }
}