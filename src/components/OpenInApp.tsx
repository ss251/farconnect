'use client';

export function OpenInApp() {
  const farcasterDeepLink = 'https://farcaster.xyz/miniapps/uUWNudWhnU_Q/farconnect';
  
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl mb-8">🎫</div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Farconnect</h1>
        <p className="text-gray-600 mb-8">Open in Farcaster</p>
        <a
          href={farcasterDeepLink}
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-8 rounded-lg transition-colors"
        >
          Open in Farcaster
        </a>
      </div>
    </div>
  );
}