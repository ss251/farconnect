'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatRoom } from './ChatRoom';
import { useMiniApp } from '@neynar/react';

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
      {/* Simple header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
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