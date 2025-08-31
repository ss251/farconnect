'use client';

import { useState, useEffect, useRef } from 'react';
import { useMiniApp } from '@neynar/react';
import { sdk } from '@farcaster/miniapp-sdk';
import { createAuthenticatedClient } from '~/lib/supabase-jwt';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { messageCache } from '~/lib/message-cache';
import { TipRequestMessage } from './TipRequestMessage';
import { TipRequestModal } from './TipRequestModal';
import { useAccount } from 'wagmi';

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
  message_type?: 'text' | 'tip_request';
  metadata?: {
    amount?: string;
    note?: string;
    recipient_address?: string;
  };
  user: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url?: string;
    has_talent_score?: boolean;
    verified_addresses?: { eth_addresses?: string[] };
  };
}

export function ChatRoom({ roomId, roomName, onBack }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [showTipModal, setShowTipModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { context } = useMiniApp();
  const { address } = useAccount();
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

  // Scroll when new messages are added (but not on initial load)
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      // Small delay to ensure DOM is updated
      setTimeout(() => scrollToBottom(true), 50);
    }
  }, [messages.length]);

  // Initialize user
  useEffect(() => {
    const initUser = async () => {
      if (!context?.user?.fid) return;

      // VIP usernames that bypass verification (from env variable)
      const VIP_USERNAMES = process.env.NEXT_PUBLIC_VIP_USERNAMES?.split(',').map(u => u.trim().toLowerCase()) || [];
      const username = context.user.username?.toLowerCase();
      const isVIP = username && VIP_USERNAMES.includes(username);

      try {
        // Log context.user to see what fields are available
        console.log('Context user data:', context.user);
        
        // First, just create/update basic user info
        // For VIP users, we'll explicitly set talent scores to false/null below
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: context.user.fid,
            username: context.user.username,
            display_name: context.user.displayName,
            pfp_url: context.user.pfpUrl
            // Don't touch verification or talent fields here - they're set separately
          })
        });

        if (response.ok) {
          const { user } = await response.json();
          setUserId(user.id);
          
          // Fetch and update user's verified addresses
          fetch(`/api/users/addresses?fid=${context.user.fid}`)
            .then(res => res.json())
            .then(data => {
              console.log('User addresses:', data.addresses);
            })
            .catch(err => console.error('Failed to fetch addresses:', err));
          
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
              
              // Only process messages from other users
              // The payload.new.user_id is the Supabase user ID, not the FID
              if (payload.new && payload.new.id) {
                const messageId = payload.new.id;
                const messageUserId = payload.new.user_id;
                
                // Skip if it's our own message or if we already have this message
                if (messageUserId === userId) {
                  console.log('Skipping own message from realtime:', messageId);
                  return;
                }
                
                // Check if we already processed this message ID
                if (lastMessageId.current === messageId) {
                  console.log('Already processed this message:', messageId);
                  return;
                }
                
                // Fetch the complete message with user data
                fetch(`/api/messages?roomId=${roomId}&messageId=${messageId}`)
                  .then(response => response.json())
                  .then(({ message }) => {
                    if (message) {
                      setMessages(current => {
                        // Final duplicate check before adding
                        const alreadyExists = current.some(m => m.id === message.id);
                        if (alreadyExists) {
                          console.log('Message already exists in state:', message.id);
                          return current;
                        }
                        
                        // Update last message ID and cache
                        lastMessageId.current = message.id;
                        const newMessages = [...current, message];
                        messageCache.set(roomId, newMessages, activeUsers);
                        return newMessages;
                      });
                    }
                  })
                  .catch(error => console.error('Error fetching message details:', error));
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

  // Send tip request
  const sendTipRequest = async (amount: string, note: string) => {
    if (!userId || isSending) return;

    setIsSending(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          content: `Requesting ${amount} USDC`,
          userId,
          messageType: 'tip_request',
          metadata: {
            amount,
            note,
            recipient_address: address || undefined
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send tip request');
      }
      
      const { message } = await response.json();
      if (message) {
        // Store the message ID immediately to prevent duplicates from realtime
        lastMessageId.current = message.id;
        
        setMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('Tip request already exists, skipping:', message.id);
            return prev;
          }
          const newMessages = [...prev, message];
          // Update cache with sent message
          messageCache.set(roomId, newMessages, activeUsers);
          return newMessages;
        });
        
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (error) {
      console.error('Error sending tip request:', error);
    } finally {
      setIsSending(false);
    }
  };

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
          userId,
          messageType: 'text'
        })
      });

      if (!response.ok) {
        setInputMessage(messageText);
        throw new Error('Failed to send message');
      }
      
      // Get the created message and add it immediately
      const { message } = await response.json();
      if (message) {
        // Store the message ID immediately to prevent duplicates from realtime
        lastMessageId.current = message.id;
        
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('Message already exists, skipping:', message.id);
            return prev;
          }
          const newMessages = [...prev, message];
          // Update cache with sent message
          messageCache.set(roomId, newMessages, activeUsers);
          return newMessages;
        });
        
        // Scroll to bottom after message is added
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
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
    <div className="h-full flex flex-col bg-white dark:elevation-0">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-200 dark:border-white/5 bg-white dark:elevation-1 dark:ios-backdrop">
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{roomName}</h2>
            {activeUsers > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
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
            <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-400 rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 dark:text-gray-600">No messages yet</p>
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
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              {message.user?.username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => message.user?.fid && handleProfileClick(message.user.fid)}
                            className="font-medium text-gray-900 dark:text-white text-sm hover:underline cursor-pointer"
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
                            <span className="text-xs text-gray-500 dark:text-gray-400">(You)</span>
                          )}
                        </div>
                        {message.message_type === 'tip_request' && message.metadata ? (
                          <TipRequestMessage
                            amount={message.metadata.amount || '1'}
                            recipientAddress={message.metadata.recipient_address || (isOwnMessage ? address : message.user?.verified_addresses?.eth_addresses?.[0])}
                            recipientName={message.user?.username || 'User'}
                            recipientAvatar={message.user?.pfp_url}
                            note={message.metadata.note}
                            isOwnMessage={isOwnMessage}
                          />
                        ) : (
                          <div className="inline-block rounded-2xl px-4 py-2 max-w-sm transition-premium bg-gray-100 dark:elevation-2 text-gray-900 dark:text-gray-100 border border-transparent dark:border-white/5">
                            <p className="break-words">
                              {message.content}
                            </p>
                          </div>
                        )}
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

      {/* Input area - ChatGPT style with buttons inside */}
      <div className="p-5 ">
        <div className="relative flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl transition-all focus-within:border-primary dark:focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          {/* Input field - no box/border styling */}
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message"
            disabled={!userId || isSending}
            className="flex-1 px-4 py-3 bg-transparent text-base text-black dark:text-white outline-none disabled:opacity-50 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
          
          {/* Buttons container - conditional rendering based on message content */}
          {inputMessage.trim() ? (
            <>
              {/* USDC Tip Button - visible when there's content */}
              <button
                onClick={() => setShowTipModal(true)}
                disabled={!userId}
                className="mr-2 flex items-center justify-center w-8 h-8 rounded-full bg-[#2775CA] hover:bg-[#2775CA]/90 text-white disabled:opacity-50"
                title="Request USDC tip"
              >
                <span className="text-sm font-bold">$</span>
              </button>
              
              {/* Send Button - visible when there's content */}
              <button
                onClick={sendMessage}
                disabled={!userId || isSending}
                className={`mr-2 group flex items-center justify-center w-8 h-8 rounded-full disabled:opacity-50 ${
              (() => {
                const hasContent = inputMessage.trim().length > 0;
                
                if (isSending) {
                  return hasContent 
                    ? "bg-primary text-white"
                    : "bg-gray-400 dark:bg-gray-600 text-white";
                }
                
                if (hasContent) {
                  return "bg-primary hover:bg-primary/90 text-white";
                }
                
                // No content: transparent
                return "bg-transparent text-gray-400 dark:text-gray-500";
              })()
            }`}
            title={inputMessage.trim() ? "Send message" : ""}
          >
            {isSending ? (
              // Loader2 style spinner
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : inputMessage.trim() ? (
              // ArrowUp when there's content
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              // No icon when empty
              null
            )}
              </button>
            </>
          ) : (
            /* USDC Tip Button only - when no message content */
            <button
              onClick={() => setShowTipModal(true)}
              disabled={!userId}
              className="mr-2 flex items-center justify-center w-8 h-8 rounded-full bg-[#2775CA] hover:bg-[#2775CA]/90 text-white disabled:opacity-50"
              title="Request USDC tip"
            >
              <span className="text-sm font-bold">$</span>
            </button>
          )}
        </div>
      </div>

      {/* Tip Request Modal */}
      <TipRequestModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        onSend={sendTipRequest}
      />
    </div>
  );
}