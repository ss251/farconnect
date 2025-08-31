'use client';

import { useState, useEffect, useRef } from 'react';
import { useMiniApp } from '@neynar/react';
import { ZupassClientVerifier } from '~/components/ui/ZupassClientVerifier';

interface WelcomeProps {
  onVerified: () => void;
}

export function Welcome({ onVerified }: WelcomeProps) {
  const { context } = useMiniApp();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{ pcd: string; watermark: string } | null>(null);

  const handleVerify = async () => {
    if (!context?.user?.fid || isVerifying) return;
    
    setIsVerifying(true);
    setError(null);

    try {
      // Dynamically import zuAuthPopup to avoid webpack warnings
      const { zuAuthPopup } = await import('@pcd/zuauth/client');
      
      // Generate a unique watermark for this verification attempt (must be a bigint)
      const watermark = BigInt(Date.now()) * 1000000n + BigInt(Math.floor(Math.random() * 1000000));
      
      // Store watermark in session storage temporarily (convert to string)
      sessionStorage.setItem('zupass_watermark', watermark.toString());

      // Open ZuPass popup for proof generation
      const result = await zuAuthPopup({
        zupassUrl: 'https://zupass.org',
        fieldsToReveal: {
          revealEventId: true,
          revealAttendeeName: false,
          revealAttendeeEmail: false,
          revealTicketId: true,
          revealTicketCategory: true
        },
        watermark,
        config: [
          {
            pcdType: 'eddsa-ticket-pcd',
            publicKey: [
              '044e711fd3a1792a825aa896104da5276bbe710fd9b59dddea1aaf8d84535aaf',
              '2b259329f0adf98c9b6cf2a11db7225fdcaa4f8796c61864e86154477da10663'
            ],
            eventId: '1f36ddce-e538-4c7a-9f31-6a4b2221ecac',
            eventName: 'Devconnect ARG'
          }
        ]
      });

      // Check if we got a valid proof from the popup
      if (!result || result.type !== 'pcd') {
        throw new Error('No proof generated');
      }

      const pcdStr = (result as { type: 'pcd'; pcdStr: string }).pcdStr;
      
      // Set pending verification for client-side verification
      setPendingVerification({ pcd: pcdStr, watermark: watermark.toString() });
      setIsVerifying(true);
    } catch (err) {
      console.error('Verification error:', err);
      setError('Verification failed');
      setIsVerifying(false);
    }
  };

  // Check for verification response
  const hasCheckedRef = useRef(false);
  useEffect(() => {
    if (hasCheckedRef.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const proof = params.get('proof');
    const watermark = sessionStorage.getItem('zupass_watermark');
    
    if (proof && watermark && context?.user?.fid) {
      hasCheckedRef.current = true;
      // Set pending verification for client-side verification
      setPendingVerification({ pcd: proof, watermark });
      setIsVerifying(true);
      
      // Clear URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('proof');
      window.history.replaceState({}, '', url.toString());
    }
  }, [context?.user?.fid]);

  // Handle verification result with useRef to prevent duplicate calls
  const isStoringRef = useRef(false);
  const handleVerificationComplete = async (result: { verified: boolean; ticketData?: any; error?: string }) => {
    // Prevent duplicate calls
    if (isStoringRef.current) return;
    
    if (!result.verified || !result.ticketData) {
      setError(result.error || 'Verification failed');
      setIsVerifying(false);
      setPendingVerification(null);
      sessionStorage.removeItem('zupass_watermark');
      return;
    }

    isStoringRef.current = true;
    
    try {
      // Store the verified ticket data
      const response = await fetch('/api/zupass/store-verified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: context?.user?.fid,
          username: context?.user?.username,
          displayName: context?.user?.displayName,
          pfpUrl: context?.user?.pfpUrl,
          ticketData: result.ticketData,
          watermark: pendingVerification?.watermark
        })
      });

      if (response.ok) {
        sessionStorage.removeItem('zupass_watermark');
        setPendingVerification(null);
        onVerified();
      } else {
        const error = await response.json();
        setError(error?.error || 'Failed to store verification');
      }
    } catch (err) {
      setError('Failed to store verification');
    } finally {
      setIsVerifying(false);
      isStoringRef.current = false;
    }
  };

  // Show client verifier if we have a pending verification
  if (pendingVerification) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔐</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verifying Ticket</h2>
          <ZupassClientVerifier
            pcd={pendingVerification.pcd}
            watermark={pendingVerification.watermark}
            onVerificationComplete={handleVerificationComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Simple header */}
      <div className="px-6 pt-12 pb-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🎫</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Devconnect</h1>
          <p className="text-gray-600 mt-2">Buenos Aires 2025</p>
        </div>
      </div>

      {/* Main content - just the button */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center">
          {/* User info - minimal */}
          {context?.user && (
            <div className="text-center mb-8">
              <p className="text-gray-700 text-lg">
                Welcome, @{context.user.username}
              </p>
            </div>
          )}

          {/* Verify button - width based on content */}
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="bg-black text-white rounded-2xl py-4 px-8 text-lg font-semibold hover:bg-gray-800 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Verifying...
              </span>
            ) : (
              'Verify Ticket'
            )}
          </button>

          {error && (
            <p className="text-red-500 text-center mt-4">{error}</p>
          )}

          {/* Minimal helper text */}
          <p className="text-gray-500 text-sm text-center mt-6">
            Prove your attendance with ZuPass
          </p>
        </div>
      </div>
    </div>
  );
}