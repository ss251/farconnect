// Simple in-memory cache for messages
interface Message {
  id: string;
  room_id: string;
  content: string;
  user_id: string;
  created_at: string;
  user: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url?: string;
    has_talent_score?: boolean;
  };
}

interface CacheEntry {
  messages: Message[];
  activeUsers: number;
  timestamp: number;
  lastMessageId: string | null;
}

class MessageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly FRESH_DURATION = 10 * 1000; // 10 seconds - data is considered fresh

  // Get cached messages if available and not stale
  get(roomId: string): { messages: Message[]; activeUsers: number; isFresh: boolean } | null {
    const entry = this.cache.get(roomId);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    
    // If cache is expired, delete it
    if (age > this.CACHE_DURATION) {
      this.cache.delete(roomId);
      return null;
    }

    // Return cache with freshness indicator
    return {
      messages: entry.messages,
      activeUsers: entry.activeUsers,
      isFresh: age < this.FRESH_DURATION
    };
  }

  // Set messages in cache
  set(roomId: string, messages: Message[], activeUsers: number) {
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    
    this.cache.set(roomId, {
      messages,
      activeUsers,
      timestamp: Date.now(),
      lastMessageId
    });
  }

  // Add a single message to cache
  addMessage(roomId: string, message: Message) {
    const entry = this.cache.get(roomId);
    if (!entry) return;

    // Check if message already exists
    if (entry.messages.some(m => m.id === message.id)) {
      return;
    }

    // Add message and update cache
    entry.messages.push(message);
    entry.lastMessageId = message.id;
    entry.timestamp = Date.now(); // Refresh timestamp
  }

  // Update active users count
  updateActiveUsers(roomId: string, count: number) {
    const entry = this.cache.get(roomId);
    if (entry) {
      entry.activeUsers = count;
    }
  }

  // Clear cache for a specific room
  clear(roomId: string) {
    this.cache.delete(roomId);
  }

  // Clear all cache
  clearAll() {
    this.cache.clear();
  }

  // Get last message ID for a room
  getLastMessageId(roomId: string): string | null {
    const entry = this.cache.get(roomId);
    return entry?.lastMessageId || null;
  }
}

// Export singleton instance
export const messageCache = new MessageCache();