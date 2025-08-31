'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatRoom } from './ChatRoom';
import { useMiniApp } from '@neynar/react';
import { sdk } from '@farcaster/miniapp-sdk';

// Define chat rooms - simplified
const CHAT_ROOMS = [
  { 
    id: 'general', 
    name: 'General', 
    emoji: '💬'
  },
  { 
    id: 'builders', 
    name: 'Builders', 
    emoji: '🔨'
  },
  { 
    id: 'hackathon', 
    name: 'Hackathon', 
    emoji: '⚡'
  },
  { 
    id: 'afterparty', 
    name: 'After Hours', 
    emoji: '🌙'
  }
];

export function ChatHub() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const { context } = useMiniApp();
  
  const handleShare = async () => {
    try {
      // Use Farcaster SDK to compose a cast with embedded mini app
      await sdk.actions.composeCast({
        text: `Join me at Devconnect Argentina! 🇦🇷\n\nConnect with verified attendees, find your hackathon team, and chat with builders.\n\n`,
        embeds: ['https://farconnect.social'] // This will embed the mini app
      });
    } catch (error) {
      console.error('Error composing cast:', error);
      // Fallback to regular share
      const shareUrl = 'https://farconnect.social';
      if (navigator.share) {
        navigator.share({
          title: 'Devconnect Argentina Chat',
          text: 'Join me at Devconnect Argentina! Connect with builders and find your team.',
          url: shareUrl
        }).catch(console.log);
      } else {
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    }
  };


  // Show chat room
  if (selectedRoom) {
    const room = CHAT_ROOMS.find(r => r.id === selectedRoom);
    return (
      <ChatRoom 
        roomId={selectedRoom}
        roomName={`${room?.emoji} ${room?.name}` || 'Chat'}
        onBack={() => setSelectedRoom(null)}
      />
    );
  }

  // Room list view
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with logo and app name */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
            <span className="text-2xl">💬</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">farconnect</h1>
            <p className="text-sm text-gray-600">Devconnect live chat</p>
          </div>
        </div>
      </div>

      {/* Rooms - simplified with huge touch targets */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-4">
          {CHAT_ROOMS.map((room) => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room.id)}
              className="w-full bg-white rounded-2xl p-6 text-left transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{room.emoji}</span>
                <div className="flex-1">
                  <span className="font-semibold text-lg text-gray-900">
                    {room.name}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}