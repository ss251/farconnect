'use client';

import { useMiniApp } from '@neynar/react';
import { Welcome } from '~/components/Welcome';
import { ChatHub } from '~/components/ChatHub';
import { useState, useEffect, useRef } from 'react';

export default function App() {
  const { isSDKLoaded, context } = useMiniApp();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const checkRef = useRef(false);

  // VIP usernames that bypass verification (from env variable)
  const VIP_USERNAMES = process.env.NEXT_PUBLIC_VIP_USERNAMES?.split(',').map(u => u.trim().toLowerCase()) || [];

  // Check verification status with ref to prevent duplicate calls
  useEffect(() => {
    const checkVerification = async () => {
      if (!context?.user?.fid || checkRef.current) return;
      
      checkRef.current = true;
      
      // Check if user is VIP (bypass verification)
      const username = context.user.username?.toLowerCase();
      if (username && VIP_USERNAMES.includes(username)) {
        console.log(`VIP user @${username} - bypassing verification`);
        
        // Mark VIP user as zupass_verified in the database
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: context.user.fid,
            username: context.user.username,
            display_name: context.user.displayName,
            pfp_url: context.user.pfpUrl,
            zupass_verified: true
          })
        }).catch(err => console.error('Error updating VIP user:', err));
        
        setIsVerified(true);
        return;
      }
      
      try {
        const response = await fetch(`/api/zupass/verify?fid=${context.user.fid}`);
        if (response.ok) {
          const data = await response.json();
          setIsVerified(data.verified || false);
        } else {
          setIsVerified(false);
        }
      } catch (error) {
        console.error('Error checking verification:', error);
        setIsVerified(false);
      }
    };

    if (isSDKLoaded && context?.user) {
      checkVerification();
    }
    
    // Cleanup
    return () => {
      checkRef.current = false;
    };
  }, [isSDKLoaded, context?.user?.fid]);

  // Loading state - minimal
  if (!isSDKLoaded || isVerified === null) {
    return (
      <div className="flex items-center justify-center h-screen gradient-dark">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 rounded-full glow-accent animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col elevation-0 transition-colors"
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
        // NO padding bottom - let the keyboard push up naturally
      }}
    >
      {!isVerified ? (
        <Welcome onVerified={() => setIsVerified(true)} />
      ) : (
        <ChatHub />
      )}
    </div>
  );
}