'use client';

import { useEffect, useState } from 'react';
import type { ZKEdDSAEventTicketPCD } from '@pcd/zk-eddsa-event-ticket-pcd';

interface ClientVerifierProps {
  pcd: string;
  watermark: string;
  onVerificationComplete: (result: {
    verified: boolean;
    ticketData?: any;
    error?: string;
  }) => void;
}

export function ZupassClientVerifier({ pcd, watermark, onVerificationComplete }: ClientVerifierProps) {
  const [status, setStatus] = useState('Initializing verification...');
  const [hasCompleted, setHasCompleted] = useState(false);
  
  useEffect(() => {
    // Prevent duplicate verification
    if (hasCompleted) return;
    
    const verifyInBrowser = async () => {
      try {
        setStatus('Loading verification libraries...');
        
        // Dynamically import the package in browser context
        const { ZKEdDSAEventTicketPCDPackage } = await import('@pcd/zk-eddsa-event-ticket-pcd');
        
        setStatus('Initializing ZK verification...');
        
        // Initialize the package with artifacts from ZuPass CDN
        if (ZKEdDSAEventTicketPCDPackage.init) {
          await ZKEdDSAEventTicketPCDPackage.init({
            wasmFilePath: 'https://zupass.org/artifacts/zk-eddsa-event-ticket-pcd/circuit.wasm',
            zkeyFilePath: 'https://zupass.org/artifacts/zk-eddsa-event-ticket-pcd/circuit.zkey'
          });
        }
        
        setStatus('Deserializing proof...');
        
        // Parse and deserialize the PCD
        let deserializedPCD: ZKEdDSAEventTicketPCD;
        try {
          const outerPCD = JSON.parse(pcd);
          if (outerPCD.pcd && typeof outerPCD.pcd === 'string') {
            deserializedPCD = await ZKEdDSAEventTicketPCDPackage.deserialize(outerPCD.pcd);
          } else {
            deserializedPCD = await ZKEdDSAEventTicketPCDPackage.deserialize(pcd);
          }
        } catch {
          deserializedPCD = await ZKEdDSAEventTicketPCDPackage.deserialize(pcd);
        }
        
        setStatus('Verifying cryptographic proof...');
        
        // Perform the actual cryptographic verification
        const isValid = await ZKEdDSAEventTicketPCDPackage.verify(deserializedPCD);
        
        if (!isValid) {
          throw new Error('Cryptographic verification failed');
        }
        
        // Extract ticket data
        const partialTicket = deserializedPCD.claim?.partialTicket || {};
        const ticketData = {
          eventId: partialTicket.eventId,
          eventName: 'Devconnect ARG',
          ticketId: partialTicket.ticketId,
          ticketCategory: partialTicket.ticketCategory,
          attendeeName: partialTicket.attendeeName,
          attendeeEmail: partialTicket.attendeeEmail,
          productId: partialTicket.productId
        };
        
        setStatus('Verification complete!');
        
        setHasCompleted(true);
        onVerificationComplete({
          verified: true,
          ticketData
        });
        
      } catch (error) {
        console.error('Browser verification error:', error);
        setStatus('Verification failed');
        setHasCompleted(true);
        onVerificationComplete({
          verified: false,
          error: error instanceof Error ? error.message : 'Verification failed'
        });
      }
    };
    
    verifyInBrowser();
  }, [pcd, watermark]); // Remove onVerificationComplete from deps to avoid re-runs
  
  return (
    <div className="text-center text-sm text-gray-500">
      {status}
    </div>
  );
}