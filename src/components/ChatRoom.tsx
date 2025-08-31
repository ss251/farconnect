'use client';

import { useState, useEffect, useRef } from 'react';
import { useMiniApp } from '@neynar/react';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { context } = useMiniApp();
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Smooth scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize user
  useEffect(() => {
    const initUser = async () => {
      if (!context?.user?.fid) return;

      // VIP usernames that bypass verification (from env variable)
      const VIP_USERNAMES = process.env.NEXT_PUBLIC_VIP_USERNAMES?.split(',').map(u => u.trim().toLowerCase()) || [];
      const username = context.user.username?.toLowerCase();
      const isVIP = username && VIP_USERNAMES.includes(username);

      try {
        // First, just create/update basic user info without touching verification status
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: context.user.fid,
            username: context.user.username || `user_${context.user.fid}`,
            display_name: context.user.displayName || `User ${context.user.fid}`,
            pfp_url: context.user.pfpUrl
            // Don't touch zupass_verified here - it's already set by the verification process
            // VIP users got through via App.tsx, regular users via ZuPass verification
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
            // For VIP users, explicitly set has_talent_score to false
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
          }
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };

    initUser();
  }, [context?.user]);

  // Load and poll messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/messages?roomId=${roomId}`);
        if (response.ok) {
          const { messages } = await response.json();
          setMessages(messages);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
    pollingInterval.current = setInterval(loadMessages, 2000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [roomId]);

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
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111' }}>{roomName}</h2>
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
                <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
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
                      <div>
                        <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                          <span className="font-medium text-gray-900 text-sm">
                            {message.user?.username}
                          </span>
                          {message.user?.has_talent_score && (
                            <img 
                              src="https://docs.talentprotocol.com/img/talent-protocol-logo.avif"
                              alt="Talent Protocol"
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                        <div className={`inline-block rounded-2xl px-4 py-2 max-w-sm ${
                          isOwnMessage 
                            ? 'bg-black text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
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