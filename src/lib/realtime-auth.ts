import crypto from 'crypto';

// Generate a secure session token for realtime access
export function generateRealtimeToken(userId: string, roomId: string): string {
  const secret = process.env.REALTIME_SECRET || 'your-secret-key';
  const timestamp = Date.now();
  const data = `${userId}:${roomId}:${timestamp}`;
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
    
  return `${data}:${hash}`;
}

// Verify a realtime token
export function verifyRealtimeToken(token: string): { valid: boolean; userId?: string; roomId?: string } {
  try {
    const secret = process.env.REALTIME_SECRET || 'your-secret-key';
    const [userId, roomId, timestamp, hash] = token.split(':');
    
    // Check if token is expired (24 hours)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    if (now - tokenTime > 24 * 60 * 60 * 1000) {
      return { valid: false };
    }
    
    // Verify hash
    const data = `${userId}:${roomId}:${timestamp}`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
      
    if (hash !== expectedHash) {
      return { valid: false };
    }
    
    return { valid: true, userId, roomId };
  } catch (error) {
    return { valid: false };
  }
}