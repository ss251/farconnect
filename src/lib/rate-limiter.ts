import { LRUCache } from 'lru-cache';
import { NextRequest } from 'next/server';

// Types
interface RateLimitOptions {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// Create a new rate limiter instance
export function createRateLimiter(options: RateLimitOptions = {}) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000, // 60 seconds default
  });

  return {
    check: (token: string, limit: number): RateLimitResult => {
      const now = Date.now();
      const windowStart = now - (options.interval || 60000);
      
      // Get existing tokens for this identifier
      const tokens = tokenCache.get(token) || [];
      
      // Filter out old tokens outside the window
      const validTokens = tokens.filter(t => t > windowStart);
      
      // Check if limit exceeded
      if (validTokens.length >= limit) {
        return {
          success: false,
          limit,
          remaining: 0,
          reset: Math.min(...validTokens) + (options.interval || 60000),
        };
      }
      
      // Add new token
      validTokens.push(now);
      tokenCache.set(token, validTokens);
      
      return {
        success: true,
        limit,
        remaining: limit - validTokens.length,
        reset: now + (options.interval || 60000),
      };
    },
  };
}

// Default rate limiters for different endpoints
export const rateLimiters = {
  // Strict limit for auth endpoints
  auth: createRateLimiter({
    uniqueTokenPerInterval: 100,
    interval: 60000, // 1 minute
  }),
  
  // Moderate limit for message sending
  messages: createRateLimiter({
    uniqueTokenPerInterval: 500,
    interval: 60000, // 1 minute
  }),
  
  // Relaxed limit for reading
  read: createRateLimiter({
    uniqueTokenPerInterval: 1000,
    interval: 60000, // 1 minute
  }),
  
  // Very strict for verification
  verification: createRateLimiter({
    uniqueTokenPerInterval: 50,
    interval: 300000, // 5 minutes
  }),
};

// Helper to get identifier from request
export function getIdentifier(request: NextRequest): string {
  // Try to get user identifier from various sources
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Create a unique identifier
  return `${ip}:${userAgent}`;
}

// Middleware helper for rate limiting
export async function rateLimit(
  request: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>,
  limit: number = 10
): Promise<RateLimitResult> {
  const identifier = getIdentifier(request);
  return limiter.check(identifier, limit);
}

// Response helper for rate limit errors
export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again later.`,
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.reset).toISOString(),
        'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
      },
    }
  );
}