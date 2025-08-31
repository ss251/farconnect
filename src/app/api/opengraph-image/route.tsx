import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getNeynarUser } from "~/lib/neynar";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  const user = fid ? await getNeynarUser(Number(fid)) : null;

  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-gray-900">
        <div tw="flex flex-col items-center">
          {/* Mate emoji as hero icon */}
          <div tw="text-9xl mb-8">🧉</div>
          
          {/* User profile if available */}
          {user?.pfp_url && (
            <div tw="flex w-64 h-64 rounded-full overflow-hidden mb-8 border-4 border-sky-500">
              <img src={user.pfp_url} alt="Profile" tw="w-full h-full object-cover" />
            </div>
          )}
          
          {/* Main title */}
          <h1 tw="text-7xl text-white font-bold">
            {user?.display_name ? `Welcome ${user.display_name ?? user.username}!` : 'Farconnect'}
          </h1>
          
          {/* Subtitle */}
          <p tw="text-4xl mt-6 text-gray-400">Devconnect Argentina • Live Chat</p>
          
          {/* Tagline */}
          <p tw="text-3xl mt-4 text-sky-400">Connect. Build. Ship.</p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}