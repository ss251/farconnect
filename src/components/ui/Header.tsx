"use client";

import { useMiniApp } from "@neynar/react";

export function Header() {
  const { context } = useMiniApp();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      {/* Logo/App Name */}
      <div className="flex items-center space-x-2">
        <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-bold">DC</span>
        </div>
        <div>
          <h1 className="font-semibold text-lg text-gray-900">Devconnect Social</h1>
          <p className="text-xs text-gray-500">Verified attendees only</p>
        </div>
      </div>

      {/* User Profile */}
      <div className="flex items-center space-x-2">
        {context?.user?.pfpUrl && (
          <img 
            src={context.user.pfpUrl} 
            alt="Profile" 
            className="w-9 h-9 rounded-full border-2 border-purple-200"
          />
        )}
      </div>
    </div>
  );
}