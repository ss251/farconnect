// Database type definitions only
// Actual database access should only happen through server-side API routes
// using the service role key in supabase-server.ts

export interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url?: string;
  zupass_verified: boolean;
  devconnect_event_id?: string;
  verification_timestamp?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ZupassVerification {
  id: string;
  fid: number;
  event_id: string;
  ticket_id?: string;
  attendee_name?: string;
  verified_at: Date;
  proof_watermark: string;
}

// Note: DO NOT create a Supabase client here
// All database operations must go through API routes for security