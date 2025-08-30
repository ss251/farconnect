import { NextResponse } from 'next/server';
import { getFarcasterDomainManifest } from '~/lib/utils';

export async function GET() {
  try {
    const config = await getFarcasterDomainManifest();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error generating metadata:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
