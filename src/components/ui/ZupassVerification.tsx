'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { useMiniApp } from "@neynar/react";
import dynamic from 'next/dynamic';

// Dynamically import client verifier with no SSR
const ZupassClientVerifier = dynamic(
  () => import('./ZupassClientVerifier').then(mod => mod.ZupassClientVerifier),
  { ssr: false }
);

// Devconnect Argentina event configuration
const DEVCONNECT_EVENT_ID = '1f36ddce-e538-4c7a-9f31-6a4b2221ecac';
// EdDSA public key is a tuple of exactly 2 strings
const TICKET_PUBLIC_KEY: [string, string] = [
  '044e711fd3a1792a825aa896104da5276bbe710fd9b59dddea1aaf8d84535aaf',
  '2b259329f0adf98c9b6cf2a11db7225fdcaa4f8796c61864e86154477da10663'
];

interface ZupassVerificationProps {
  onVerificationComplete?: (verified: boolean) => void;
}

export function ZupassVerification({ onVerificationComplete }: ZupassVerificationProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingPCD, setPendingPCD] = useState<{ pcd: string; watermark: string } | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    verified: boolean;
    loading: boolean;
    error?: string;
    verifications?: any[];
  }>({
    verified: false,
    loading: true,  // Start loading to check status
    error: undefined,
    verifications: []
  });
  const { context } = useMiniApp();
  const fid = context?.user?.fid;

  // Handle client-side verification result
  const handleClientVerificationComplete = useCallback(async (result: {
    verified: boolean;
    ticketData?: any;
    error?: string;
  }) => {
    if (!pendingPCD || !fid) {
      setVerificationStatus({
        verified: false,
        loading: false,
        error: 'Missing data for verification'
      });
      setPendingPCD(null);
      setIsVerifying(false);
      return;
    }

    if (!result.verified) {
      setVerificationStatus({
        verified: false,
        loading: false,
        error: result.error || 'Cryptographic verification failed'
      });
      setPendingPCD(null);
      setIsVerifying(false);
      return;
    }

    try {
      // Send verified proof and ticket data to backend for storage
      const response = await fetch('/api/zupass/store-verified', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fid: fid,
          username: context?.user?.username,
          displayName: context?.user?.displayName,
          pfpUrl: context?.user?.pfpUrl || null,
          ticketData: result.ticketData,
          watermark: pendingPCD.watermark
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || 'Failed to store verification');
      }

      setVerificationStatus({
        verified: true,
        loading: false,
        verifications: [result.ticketData]
      });

      setPendingPCD(null);
      onVerificationComplete?.(true);

    } catch (error) {
      console.error('Storage error:', error);
      setVerificationStatus({
        verified: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to store verification'
      });
      setPendingPCD(null);
    } finally {
      setIsVerifying(false);
    }
  }, [pendingPCD, fid, context, onVerificationComplete]);

  // Check verification status on mount
  useEffect(() => {
    if (!fid) {
      setVerificationStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/zupass/verify?fid=${fid}`);
        if (response.ok) {
          const data = await response.json();
          setVerificationStatus({
            verified: data.verified || false,
            loading: false,
            verifications: data.verifications || []
          });
          if (data.verified) {
            onVerificationComplete?.(true);
          }
        } else {
          setVerificationStatus(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
        setVerificationStatus(prev => ({ ...prev, loading: false }));
      }
    };

    checkStatus();
  }, [fid, onVerificationComplete]);

  const handleVerification = async () => {
    setIsVerifying(true);
    setVerificationStatus(prev => ({ ...prev, error: undefined }));
    setPendingPCD(null);

    try {
      // Dynamically import zuAuthPopup to avoid webpack warnings
      const { zuAuthPopup } = await import('@pcd/zuauth/client');
      
      // Generate a unique watermark for this verification attempt (must be a bigint)
      // Using timestamp + random number to create a unique bigint
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
            publicKey: TICKET_PUBLIC_KEY,
            eventId: DEVCONNECT_EVENT_ID,
            eventName: 'Devconnect ARG'
          }
        ]
      });

      if (!result || result.type !== 'pcd') {
        throw new Error('No proof generated');
      }

      const pcdStr = (result as { type: 'pcd'; pcdStr: string }).pcdStr;

      // Check if user is authenticated
      if (!fid) {
        throw new Error('Not authenticated - please sign in with Farcaster');
      }

      // Store PCD for client-side verification
      setPendingPCD({ pcd: pcdStr, watermark: watermark.toString() });

      // Clean up watermark
      sessionStorage.removeItem('zupass_watermark');

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationStatus({
        verified: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      });
      sessionStorage.removeItem('zupass_watermark');
      setIsVerifying(false);
    }
  };

  // Show client verifier when we have a pending PCD
  if (pendingPCD && !verificationStatus.verified) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg mb-1">
                🔐 Verifying Your Proof
              </h3>
              <ZupassClientVerifier
                pcd={pendingPCD.pcd}
                watermark={pendingPCD.watermark}
                onVerificationComplete={handleClientVerificationComplete}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus.loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <div className="text-gray-500 text-sm">Checking verification status...</div>
        </div>
      </div>
    );
  }

  if (verificationStatus.verified) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-r from-purple-50 to-green-50 border border-green-300 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-green-600"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  ✨ Devconnect Verified
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  You&apos;re a verified Devconnect Argentina attendee
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                🎫 Verified
              </span>
            </div>
          </div>
          
          {verificationStatus.verifications && verificationStatus.verifications.length > 0 && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">Event:</span> {verificationStatus.verifications[0].event_name || 'Devconnect ARG'}
                {verificationStatus.verifications[0].ticket_category && (
                  <span className="ml-3">
                    <span className="font-medium">Ticket:</span> {verificationStatus.verifications[0].ticket_category}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-center">
          <Button
            onClick={handleVerification}
            disabled={isVerifying}
            className="text-sm text-gray-600 hover:text-purple-600 border border-gray-300 hover:border-purple-300 bg-white"
          >
            🔄 Re-verify Ticket
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-lg mb-2">
              🎫 Verify Your Devconnect Ticket
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Connect your ZuPass to prove you&apos;re a registered Devconnect Argentina attendee 
              and unlock exclusive features in farconnect.
            </p>
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Zero-knowledge proof protects your privacy</span>
          </div>
        </div>
        
        {verificationStatus.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-700 text-sm">{verificationStatus.error}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleVerification}
          disabled={isVerifying}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium py-3 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Verifying with ZuPass...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
              Verify with ZuPass
            </span>
          )}
        </Button>
      </div>
      
      <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
        <div className="flex items-center space-x-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>Need help?</span>
        </div>
        <a href="https://zupass.org" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline">
          Learn about ZuPass
        </a>
      </div>
    </div>
  );
}