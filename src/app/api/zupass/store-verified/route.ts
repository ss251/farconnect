/**
 * Store Verified ZuPass Ticket API Route
 * 
 * This endpoint stores already-verified ticket data after client-side ZK proof verification.
 * The actual cryptographic verification happens in the browser to avoid WASM/Node.js issues.
 * 
 * This endpoint only stores the verified data, trusting that the client has performed
 * proper cryptographic verification. In production, you might want additional checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbHelpers } from '~/lib/supabase-server';

// Devconnect Argentina event configuration
const DEVCONNECT_EVENT_ID = '1f36ddce-e538-4c7a-9f31-6a4b2221ecac';

export async function POST(request: NextRequest) {
  try {
    console.log('Storing verified ZuPass ticket...');
    
    // Get the verified ticket data from request body
    const body = await request.json();
    const { fid, username, displayName, pfpUrl, ticketData, watermark } = body;

    console.log('Storage request for FID:', fid, 'Username:', username);

    if (!fid || !ticketData) {
      return NextResponse.json(
        { error: 'Missing required data (fid or ticketData)' },
        { status: 400 }
      );
    }

    // Validate the ticket is for Devconnect Argentina
    const eventId = ticketData.eventId || DEVCONNECT_EVENT_ID;
    if (eventId !== DEVCONNECT_EVENT_ID) {
      return NextResponse.json(
        { error: 'Invalid event - only Devconnect Argentina tickets are accepted' },
        { status: 400 }
      );
    }

    console.log('Storing verified ticket data:', {
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
        proof_watermark: watermark || 'client-verified'
      });
    } else {
      console.log('Verification already exists for this event');
    }

    console.log('Verification storage successful for FID:', fid);
    
    return NextResponse.json({
      success: true,
      verified: true,
      user: {
        fid: fid,
        zupassVerified: true
      }
    });

  } catch (error) {
    console.error('Storage error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Storage failed' },
      { status: 500 }
    );
  }
}