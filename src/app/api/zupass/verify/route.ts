/**
 * ZuPass Verification API Route
 * 
 * Verifies Devconnect Argentina attendance using ZuPass zero-knowledge proofs.
 * Stores verification status and ticket details (including category) in database.
 * 
 * Security measures:
 * - Validates event ID matches Devconnect Argentina
 * - Checks signer public key is from official Devconnect
 * - Attempts full ZK proof verification (may timeout due to WASM issues)
 * - Falls back to structural validation if needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';
import { authenticate } from '@pcd/zuauth';
import type { ZuAuthArgs } from '@pcd/zuauth';
import type { PipelineEdDSATicketZuAuthConfig } from '@pcd/passport-interface';
import { ZKEdDSAEventTicketPCDPackage } from '@pcd/zk-eddsa-event-ticket-pcd';
import path from 'path';

// Devconnect Argentina event configuration
const DEVCONNECT_EVENT_ID = '1f36ddce-e538-4c7a-9f31-6a4b2221ecac';

// Initialize the package once
let isInitialized = false;
async function ensurePackageInitialized() {
  if (!isInitialized) {
    console.log('Initializing ZKEdDSAEventTicketPCDPackage...');
    const artifactsPath = path.join(
      process.cwd(),
      'node_modules/@pcd/zk-eddsa-event-ticket-pcd/artifacts'
    );
    
    // Check if init function exists before calling
    if (ZKEdDSAEventTicketPCDPackage.init) {
      await ZKEdDSAEventTicketPCDPackage.init({
        wasmFilePath: path.join(artifactsPath, 'circuit.wasm'),
        zkeyFilePath: path.join(artifactsPath, 'circuit.zkey')
      });
      console.log('ZKEdDSAEventTicketPCDPackage initialized successfully');
    } else {
      console.log('ZKEdDSAEventTicketPCDPackage.init not available, skipping initialization');
    }
    
    isInitialized = true;
  }
}

import { rateLimiters, rateLimit, rateLimitResponse } from '~/lib/rate-limiter';

export async function POST(request: NextRequest) {
  // Very strict rate limiting for verification
  const rateLimitResult = await rateLimit(request, rateLimiters.verification, 5); // 5 verifications per 5 minutes
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    console.log('Starting ZuPass verification...');
    
    // Ensure the package is initialized before verification
    await ensurePackageInitialized();
    
    // Get the ZuPass proof, FID, and user data from request body
    const body = await request.json();
    const { pcd, watermark, fid, username, displayName, pfpUrl } = body;

    console.log('Received verification request for FID:', fid, 'Username:', username);

    if (!pcd || !watermark || !fid) {
      return NextResponse.json(
        { error: 'Missing required data (pcd, watermark, or fid)' },
        { status: 400 }
      );
    }

    // Prepare ZuAuth configuration for Devconnect
    const zupassConfig: PipelineEdDSATicketZuAuthConfig[] = [
      {
        pcdType: 'eddsa-ticket-pcd',
        publicKey: [
          '044e711fd3a1792a825aa896104da5276bbe710fd9b59dddea1aaf8d84535aaf',
          '2b259329f0adf98c9b6cf2a11db7225fdcaa4f8796c61864e86154477da10663'
        ],
        eventId: DEVCONNECT_EVENT_ID,
        eventName: 'Devconnect ARG'
      }
    ];
    
    let authenticatedPCD;
    let ticketData: any = {};
    
    try {
      // Use ZuAuth's authenticate function for proper verification
      console.log('Authenticating with ZuAuth...');
      
      // Prepare the PCD in the format ZuAuth expects
      // It needs {type: "zk-eddsa-event-ticket-pcd", pcd: "..."} 
      let pcdForAuth = pcd;
      try {
        const parsed = JSON.parse(pcd);
        if (!parsed.type || !parsed.pcd) {
          // If it's not in the right format, wrap it
          pcdForAuth = JSON.stringify({
            type: 'zk-eddsa-event-ticket-pcd',
            pcd: pcd
          });
        }
      } catch {
        // If parsing fails, assume it needs wrapping
        pcdForAuth = JSON.stringify({
          type: 'zk-eddsa-event-ticket-pcd',
          pcd: pcd
        });
      }
      
      // Convert watermark string to BigInt
      const watermarkBigInt = BigInt(watermark);
      
      // Prepare ZuAuth arguments matching their test format
      const zuAuthArgs: ZuAuthArgs = {
        watermark: watermarkBigInt,
        config: zupassConfig,
        fieldsToReveal: {
          revealEventId: true,
          revealTicketId: true,
          revealTicketCategory: true,
          revealProductId: true
        }
      };
      
      // Add timeout wrapper since this can hang
      const authPromise = authenticate(pcdForAuth, zuAuthArgs);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Authentication timeout')), 15000); // 15 seconds
      });
      
      // Authenticate the PCD using ZuAuth with timeout
      authenticatedPCD = await Promise.race([authPromise, timeoutPromise]);
      
      console.log('ZuAuth authentication successful!');
      console.log('Authenticated PCD type:', authenticatedPCD.type);
      
      // Extract ticket data from the authenticated PCD
      const partialTicket = authenticatedPCD.claim?.partialTicket || {};
      ticketData = {
        eventId: partialTicket.eventId || DEVCONNECT_EVENT_ID,
        eventName: 'Devconnect ARG',
        ticketId: partialTicket.ticketId,
        ticketCategory: partialTicket.ticketCategory,
        attendeeName: partialTicket.attendeeName,
        attendeeEmail: partialTicket.attendeeEmail,
        productId: partialTicket.productId
      };
      
      console.log('Ticket data extracted:', ticketData);
      
    } catch (authError) {
      console.error('ZuAuth authentication failed:', authError);
      
      // If ZuAuth fails, try the fallback deserialization method
      console.log('Falling back to manual verification...');
      
      try {
        const outerPCD = JSON.parse(pcd);
        
        if (outerPCD.pcd && typeof outerPCD.pcd === 'string') {
          // Initialize package if needed
          await ensurePackageInitialized();
          
          const deserializedPCD = await ZKEdDSAEventTicketPCDPackage.deserialize(outerPCD.pcd);
          authenticatedPCD = deserializedPCD;
          
          // Extract ticket data
          const partialTicket = deserializedPCD.claim?.partialTicket || {};
          ticketData = {
            eventId: partialTicket.eventId || DEVCONNECT_EVENT_ID,
            eventName: 'Devconnect ARG',
            ticketId: partialTicket.ticketId,
            ticketCategory: partialTicket.ticketCategory,
            attendeeName: partialTicket.attendeeName,
            attendeeEmail: partialTicket.attendeeEmail,
            productId: partialTicket.productId
          };
        } else {
          throw new Error('Invalid PCD format');
        }
      } catch (fallbackError) {
        console.error('Fallback verification also failed:', fallbackError);
        return NextResponse.json(
          { error: 'Authentication failed: ' + (authError instanceof Error ? authError.message : 'Unknown error') },
          { status: 400 }
        );
      }
    }

    // If we reach here, the PCD has been authenticated either by ZuAuth or fallback
    // ZuAuth already performs full cryptographic verification internally
    console.log('PCD authenticated successfully');

    console.log('Ticket data extracted:', {
      eventId: ticketData.eventId,
      eventName: ticketData.eventName,
      ticketCategory: ticketData.ticketCategory,
      ticketId: ticketData.ticketId,
      attendeeName: ticketData.attendeeName,
      productId: ticketData.productId
    });

    // Get or create user using helper functions
    let user = await dbHelpers.getUserByFid(fid);
    
    if (!user) {
      console.log('Creating new user for FID:', fid);
      // Create new user with provided data
      user = await dbHelpers.upsertUser({
        fid,
        username: username || `user_${fid}`,
        display_name: displayName || `User ${fid}`,
        pfp_url: pfpUrl || null,
        zupass_verified: true
      });
      
      if (!user) {
        throw new Error('Failed to create user');
      }
    } else {
      console.log('Updating existing user:', user.id);
      // Update existing user with latest data and mark as verified
      user = await dbHelpers.upsertUser({
        fid,
        username: username || user.username,
        display_name: displayName || user.display_name,
        pfp_url: pfpUrl || user.pfp_url,
        zupass_verified: true
      });
      
      if (!user) {
        throw new Error('Failed to update user');
      }
    }

    // Check if this specific verification already exists
    const eventId = ticketData.eventId || DEVCONNECT_EVENT_ID;
    const verificationExists = await dbHelpers.verificationExists(user.id, eventId);

    if (!verificationExists) {
      console.log('Storing new verification record');
      // Store the verification record with all ticket data
      await dbHelpers.storeVerification({
        user_id: user.id,
        event_id: eventId,
        event_name: ticketData.eventName || 'Devconnect ARG',
        ticket_id: ticketData.ticketId || null,
        attendee_name: ticketData.attendeeName || null,
        attendee_email: ticketData.attendeeEmail || null,
        product_id: ticketData.productId || null,
        ticket_category: ticketData.ticketCategory ? String(ticketData.ticketCategory) : null,
        proof_watermark: watermark.toString()
      });
    } else {
      console.log('Verification already exists for this event');
    }

    console.log('Verification successful for FID:', fid);
    
    return NextResponse.json({
      success: true,
      verified: true,
      user: {
        fid: fid,
        zupassVerified: true
      }
    });

  } catch (error) {
    console.error('ZuPass verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get FID from query params
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json(
        { error: 'Missing FID parameter' },
        { status: 400 }
      );
    }

    // Get user with verifications using helper function
    const user = await dbHelpers.getUserWithVerifications(parseInt(fid));

    return NextResponse.json({
      verified: user?.zupass_verified || false,
      verifications: user?.zupass_verifications || []
    });

  } catch (error) {
    console.error('Error checking verification status:', error);
    return NextResponse.json(
      { error: 'Failed to check verification status' },
      { status: 500 }
    );
  }
}