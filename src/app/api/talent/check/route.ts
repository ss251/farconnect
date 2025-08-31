import { NextRequest, NextResponse } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';

const TALENT_API_KEY = process.env.TALENT_API_KEY;
const TALENT_API_URL = 'https://api.talentprotocol.com/api/v2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json(
        { error: 'Missing FID parameter' },
        { status: 400 }
      );
    }

    // Check if we already have the score cached
    const user = await dbHelpers.getUserByFid(parseInt(fid));
    if (user?.has_talent_score !== null && user?.has_talent_score !== undefined) {
      return NextResponse.json({ hasScore: user.has_talent_score });
    }

    // If not cached and no API key, return false
    if (!TALENT_API_KEY) {
      console.log('No Talent Protocol API key configured');
      return NextResponse.json({ hasScore: false });
    }

    // Fetch from Talent Protocol API v2 using Farcaster social
    try {
      const response = await fetch(
        `${TALENT_API_URL}/passports?passport_socials=farcaster:${fid}`,
        {
          headers: {
            'X-API-KEY': TALENT_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('Talent Protocol API error:', response.status);
        return NextResponse.json({ hasScore: false });
      }

      const data = await response.json();
      
      // Check if user has a builder score from any passport
      const hasScore = data.passports && data.passports.length > 0 && 
                      data.passports.some((p: any) => p.score && p.score > 0);
      const builderScore = hasScore ? Math.max(...data.passports.map((p: any) => p.score || 0)) : null;
      
      // Cache the result in database
      if (user) {
        await dbHelpers.upsertUser({
          fid: parseInt(fid),
          username: user.username,
          display_name: user.display_name,
          pfp_url: user.pfp_url,
          zupass_verified: user.zupass_verified,
          has_talent_score: hasScore,
          builder_score: builderScore
        });
      }

      return NextResponse.json({ hasScore });
    } catch (apiError) {
      console.error('Error fetching from Talent Protocol:', apiError);
      return NextResponse.json({ hasScore: false });
    }

  } catch (error) {
    console.error('Error checking Talent score:', error);
    return NextResponse.json(
      { error: 'Failed to check Talent score' },
      { status: 500 }
    );
  }
}