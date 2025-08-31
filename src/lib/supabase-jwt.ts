import { SignJWT, jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

// Generate a custom JWT with audience claim for your app
export async function generateAppJWT(userId: string, fid: number) {
  const secret = new TextEncoder().encode(
    process.env.SUPABASE_JWT_SECRET! // Same secret as Supabase uses
  );

  const jwt = await new SignJWT({
    aud: 'farconnect.social', // Your app's audience
    sub: userId,
    fid: fid,
    role: 'authenticated_user',
    // Add any other claims you need
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);

  return jwt;
}

// Create a Supabase client with custom JWT
export function createAuthenticatedClient(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}