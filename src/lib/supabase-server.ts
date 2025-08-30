import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key
// This bypasses Row Level Security and should only be used in server-side code

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

// Create a Supabase client with the service role key
// This client has full admin access and bypasses RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Database types for TypeScript
export interface User {
  id: string;
  fid: number;
  username: string;
  display_name: string;
  pfp_url?: string | null;
  zupass_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ZupassVerification {
  id: string;
  user_id: string;
  event_id: string;
  event_name?: string | null;
  ticket_id?: string | null;
  attendee_name?: string | null;
  attendee_email?: string | null;
  product_id?: string | null;
  ticket_category?: string | null;
  proof_watermark: string;
  verified_at: Date;
}

// Helper functions for database operations
export const dbHelpers = {
  // Get user by FID
  async getUserByFid(fid: number): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  },

  // Create or update user
  async upsertUser(user: Partial<User> & { fid: number }): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        fid: user.fid,
        username: user.username || `user_${user.fid}`,
        display_name: user.display_name || `User ${user.fid}`,
        pfp_url: user.pfp_url,
        zupass_verified: user.zupass_verified || false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'fid'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting user:', error);
      return null;
    }

    return data;
  },

  // Mark user as verified
  async markUserAsVerified(userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        zupass_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    return !error;
  },

  // Store verification record
  async storeVerification(verification: Omit<ZupassVerification, 'id' | 'verified_at'>): Promise<ZupassVerification | null> {
    const { data, error } = await supabaseAdmin
      .from('zupass_verifications')
      .insert(verification)
      .select()
      .single();

    if (error) {
      console.error('Error storing verification:', error);
      return null;
    }

    return data;
  },

  // Check if verification exists
  async verificationExists(userId: string, eventId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('zupass_verifications')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single();

    return !!data;
  },

  // Get user with verifications
  async getUserWithVerifications(fid: number): Promise<(User & { zupass_verifications: ZupassVerification[] }) | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        zupass_verifications (*)
      `)
      .eq('fid', fid)
      .single();

    if (error) {
      console.error('Error fetching user with verifications:', error);
      return null;
    }

    return data;
  }
};