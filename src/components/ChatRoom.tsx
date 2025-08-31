'use client';

import { useState, useEffect, useRef } from 'react';
import { useMiniApp } from '@neynar/react';
import { sdk } from '@farcaster/miniapp-sdk';
import { createAuthenticatedClient } from '~/lib/supabase-jwt';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { messageCache } from '~/lib/message-cache';

interface ChatRoomProps {
  roomId: string;
  roomName: string;
  onBack: () => void;
}

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

export function ChatRoom({ roomId, roomName, onBack }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { context } = useMiniApp();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastMessageId = useRef<string | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Scroll to bottom only for initial load and new messages
  const scrollToBottom = (smooth: boolean = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'instant',
      block: 'end'
    });
  };

  // Only scroll on initial load and when sending messages
  useEffect(() => {
    // Only scroll if it's the initial load (when loading becomes false)
    if (!isLoading && messages.length > 0) {
      // Use instant scroll for initial load
      scrollToBottom(false);
    }
  }, [isLoading]);

  // Scroll when user sends a message
  useEffect(() => {
    if (isSending) {
      scrollToBottom(true);
    }
  }, [isSending]);

  // Initialize user
  useEffect(() => {
    const initUser = async () => {
      if (!context?.user?.fid) return;

      // VIP usernames that bypass verification (from env variable)
      const VIP_USERNAMES = process.env.NEXT_PUBLIC_VIP_USERNAMES?.split(',').map(u => u.trim().toLowerCase()) || [];
      const username = context.user.username?.toLowerCase();
      const isVIP = username && VIP_USERNAMES.includes(username);

      try {
        // First, just create/update basic user info
        // For VIP users, we'll explicitly set talent scores to false/null below
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: context.user.fid,
            username: context.user.username || `user_${context.user.fid}`,
            display_name: context.user.displayName || `User ${context.user.fid}`,
            pfp_url: context.user.pfpUrl
            // Don't touch verification or talent fields here - they're set separately
          })
        });

        if (response.ok) {
          const { user } = await response.json();
          setUserId(user.id);
          
          // Check and update Talent score in background (skip for VIP users to avoid confusion)
          if (context?.user?.fid && !isVIP) {
            fetch(`/api/talent/check?fid=${context.user.fid}`)
              .then(res => res.json())
              .then(data => {
                // Explicitly set talent score based on API response
                fetch('/api/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fid: context.user.fid,
                    username: context.user.username,
                    display_name: context.user.displayName,
                    pfp_url: context.user.pfpUrl,
                    has_talent_score: data.hasScore || false  // Explicitly set to false if no score
                  })
                });
              })
              .catch(err => {
                console.log('Talent check failed:', err);
                // On error, explicitly set to false
                fetch('/api/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fid: context.user.fid,
                    username: context.user.username,
                    display_name: context.user.displayName,
                    pfp_url: context.user.pfpUrl,
                    has_talent_score: false
                  })
                });
              });
          } else if (isVIP) {
            // For VIP users, explicitly set has_talent_score to false and clear builder_score
            fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fid: context.user.fid,
                username: context.user.username,
                display_name: context.user.displayName,
                pfp_url: context.user.pfpUrl,
                has_talent_score: false,
                builder_score: null  // Explicitly clear any inherited builder score
              })
            });
          }
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };

    initUser();
  }, [context?.user]);

  // Load initial messages with caching
  useEffect(() => {
    let isMounted = true;

    const loadInitialMessages = async () => {
      // Check cache first
      const cached = messageCache.get(roomId);
      
      if (cached) {
        // Use cached data immediately - instant load!
        setMessages(cached.messages);
        setActiveUsers(cached.activeUsers);
        
        if (cached.messages.length > 0) {
          lastMessageId.current = cached.messages[cached.messages.length - 1].id;
        }
        
        // If data is fresh (< 10 seconds old), don't refetch
        if (cached.isFresh) {
          setIsLoading(false);
          return;
        }
        
        // Data is stale but usable - show it while fetching fresh data
        setIsLoading(false);
      }

      // Fetch fresh data (either no cache or stale cache)
      try {
        const response = await fetch(`/api/messages?roomId=${roomId}`);
        if (response.ok && isMounted) {
          const { messages, activeUsers } = await response.json();
          
          // Update cache
          messageCache.set(roomId, messages, activeUsers);
          
          // Update state only if different from cache
          setMessages(messages);
          setActiveUsers(activeUsers || 0);
          
          // Track the last message ID to prevent duplicates
          if (messages.length > 0) {
            lastMessageId.current = messages[messages.length - 1].id;
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        // If we have cache, keep showing it even if fetch failed
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialMessages();

    // Update active users count periodically (much less frequent)
    const activeUsersInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/messages?roomId=${roomId}&countOnly=true`);
        if (response.ok && isMounted) {
          const { activeUsers } = await response.json();
          setActiveUsers(activeUsers || 0);
          // Update cache with new active users count
          messageCache.updateActiveUsers(roomId, activeUsers || 0);
        }
      } catch (error) {
        console.error('Error updating active users:', error);
      }
    }, 30000); // Update every 30 seconds instead of constant polling

    return () => {
      isMounted = false;
      clearInterval(activeUsersInterval);
    };
  }, [roomId]);

  // Set up realtime subscription once we have userId
  useEffect(() => {
    if (!userId || !context?.user?.fid) return;

    const setupRealtimeWithAuth = async () => {
      try {
        // Get JWT token from server
        const response = await fetch('/api/realtime-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: context.user.fid })
        });

        if (!response.ok) {
          console.error('Failed to get realtime token');
          return;
        }

        const { token } = await response.json();

        // Create authenticated Supabase client
        const authenticatedClient = createAuthenticatedClient(token);
        supabaseRef.current = authenticatedClient;

        // Clean up any existing subscription
        if (channelRef.current && supabaseRef.current) {
          supabaseRef.current.removeChannel(channelRef.current);
        }

        // Create a new channel for this room
        const channel = authenticatedClient
          .channel(`room-${roomId}-user-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `room_id=eq.${roomId}`
            },
            async (payload) => {
              console.log('New message received:', payload);
              
              // Check if this is a message from another user (not our own)
              if (payload.new && payload.new.id && payload.new.user_id !== userId) {
                // Fetch the complete message with user data
                const response = await fetch(`/api/messages?roomId=${roomId}&messageId=${payload.new.id}`);
                if (response.ok) {
                  const { message } = await response.json();
                  if (message) {
                    setMessages(prev => {
                      // Avoid duplicates
                      const existingIds = new Set(prev.map(m => m.id));
                      if (!existingIds.has(message.id)) {
                        // Update cache with new message
                        messageCache.addMessage(roomId, message);
                        return [...prev, message];
                      }
                      return prev;
                    });
                    lastMessageId.current = message.id;
                  }
                }
              }
            }
          )
          .subscribe((status) => {
            console.log('Subscription status:', status);
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up realtime:', error);
      }
    };

    setupRealtimeWithAuth();

    return () => {
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, userId, context?.user?.fid]);

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || !userId || isSending) return;

    setIsSending(true);
    const messageText = inputMessage;
    setInputMessage('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          content: messageText,
          userId
        })
      });

      if (!response.ok) {
        setInputMessage(messageText);
        throw new Error('Failed to send message');
      }
      
      // Get the created message and add it immediately
      const { message } = await response.json();
      if (message) {
        setMessages(prev => [...prev, message]);
        lastMessageId.current = message.id;
        // Update cache with sent message
        messageCache.addMessage(roomId, message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Format time
  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Handle profile click to view profile
  const handleProfileClick = async (fid: number) => {
    try {
      await sdk.actions.viewProfile({ fid });
    } catch (error) {
      console.error('Error viewing profile:', error);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #e5e5e5', backgroundColor: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={onBack}
            style={{ 
              width: '40px', 
              height: '40px', 
              border: 'none', 
              borderRadius: '12px', 
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <svg style={{ width: '24px', height: '24px', color: '#666' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111' }}>{roomName}</h2>
            {activeUsers > 0 && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                {activeUsers} {activeUsers === 1 ? 'person' : 'people'} active
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isOwnMessage = message.user?.fid === context?.user?.fid;
              
              return (
                <div key={message.id} className="flex justify-start">
                  <div className="items-start">
                    <div className="flex gap-3">
                      <button
                        onClick={() => message.user?.fid && handleProfileClick(message.user.fid)}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: 'none', border: 'none', padding: 0 }}
                      >
                        {message.user?.pfp_url ? (
                          <img 
                            src={message.user.pfp_url} 
                            alt=""
                            className="w-10 h-10 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-gray-600">
                              {message.user?.username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => message.user?.fid && handleProfileClick(message.user.fid)}
                            className="font-medium text-gray-900 text-sm hover:underline cursor-pointer"
                            style={{ background: 'none', border: 'none', padding: 0 }}
                          >
                            {message.user?.username}
                          </button>
                          {message.user?.has_talent_score && (
                            <img 
                              src="https://docs.talentprotocol.com/img/talent-protocol-logo.avif"
                              alt="Talent Protocol"
                              className="w-4 h-4"
                            />
                          )}
                          {isOwnMessage && (
                            <span className="text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                        <div className="inline-block rounded-2xl px-4 py-2 max-w-sm bg-gray-100 text-gray-900">
                          <p className="break-words">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ 
        padding: '16px', 
        borderTop: '1px solid #e5e5e5', 
        backgroundColor: 'white',
        display: 'flex',
        gap: '12px'
      }}>
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Message"
          disabled={!userId || isSending}
          style={{ 
            flex: 1,
            padding: '12px 20px',
            backgroundColor: '#f5f5f5',
            borderRadius: '24px',
            border: 'none',
            fontSize: '16px',
            outline: 'none',
            color: '#000',  // Added black text color
            opacity: (!userId || isSending) ? 0.5 : 1
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!inputMessage.trim() || !userId || isSending}
          style={{
            padding: '12px 24px',
            backgroundColor: (!inputMessage.trim() || !userId || isSending) ? '#ccc' : '#000',
            color: 'white',
            borderRadius: '24px',
            border: 'none',
            fontWeight: '600',
            cursor: (!inputMessage.trim() || !userId || isSending) ? 'not-allowed' : 'pointer'
          }}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}