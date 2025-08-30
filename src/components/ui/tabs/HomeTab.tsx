"use client";

import { useState } from 'react';
import { useMiniApp } from "@neynar/react";
import { ZupassVerification } from '../ZupassVerification';

/**
 * HomeTab component displays the main landing content for the mini app.
 * 
 * This is the default tab that users see when they first open the mini app.
 * It includes ZuPass verification for Devconnect attendees and shows
 * exclusive content for verified users.
 * 
 * @example
 * ```tsx
 * <HomeTab />
 * ```
 */
export function HomeTab() {
  const [isVerified, setIsVerified] = useState(false);
  const { context } = useMiniApp();
  
  // Check if user is authenticated via context (like testr does)
  const isAuthenticated = !!context?.user?.fid;

  const handleVerificationComplete = (verified: boolean) => {
    setIsVerified(verified);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] px-6">
        <div className="text-center w-full max-w-md mx-auto">
          <p className="text-lg mb-2">Welcome to farconnect!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Please sign in with Farcaster to continue
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] px-6">
      <div className="w-full max-w-2xl mx-auto">
        {/* Welcome section */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">
            Welcome to farconnect
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            FID: {context?.user?.fid || 'Unknown'} | @{context?.user?.username || 'user'}
          </p>
        </div>

        {/* ZuPass verification section */}
        <div className="mb-6">
          <ZupassVerification onVerificationComplete={handleVerificationComplete} />
        </div>

        {/* Main content area */}
        {isVerified ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">
              🎉 Welcome, Devconnect Attendee!
            </h3>
            <p className="text-green-700 dark:text-green-400 mb-4">
              You now have access to exclusive features for verified Devconnect attendees.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                • Connect with other verified attendees
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                • Access exclusive chat rooms
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                • Share and discover events
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Verify your Devconnect attendance to unlock exclusive features
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Powered by Neynar 🪐 & ZuPass 🎫
          </p>
        </div>
      </div>
    </div>
  );
}