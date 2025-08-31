import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

interface MessagesResponse {
  messages: Message[];
  activeUsers: number;
}

// Cache keys
const MESSAGES_KEY = (roomId: string) => ['messages', roomId];
const ACTIVE_USERS_KEY = (roomId: string) => ['activeUsers', roomId];

// Fetch messages from API
async function fetchMessages(roomId: string): Promise<MessagesResponse> {
  const response = await fetch(`/api/messages?roomId=${roomId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
}

// Send a message
async function sendMessage({ roomId, content, userId }: { roomId: string; content: string; userId: string }) {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, content, userId })
  });
  
  if (!response.ok) {
    throw new Error('Failed to send message');
  }
  
  return response.json();
}

export function useMessages(roomId: string) {
  const queryClient = useQueryClient();

  // Fetch messages with caching
  const { data, error, isLoading } = useQuery({
    queryKey: MESSAGES_KEY(roomId),
    queryFn: () => fetchMessages(roomId),
    staleTime: 10000, // Consider data fresh for 10 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes (gcTime replaced cacheTime in v5)
    refetchInterval: 30000, // Refetch every 30 seconds for active users
  });

  // Send message mutation with optimistic updates
  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    // Optimistic update
    onMutate: async (newMessage) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: MESSAGES_KEY(roomId) });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<MessagesResponse>(MESSAGES_KEY(roomId));

      // Optimistically update to the new value
      if (previousMessages) {
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          room_id: newMessage.roomId,
          content: newMessage.content,
          user_id: newMessage.userId,
          created_at: new Date().toISOString(),
          user: {
            fid: 0, // Will be updated when real message arrives
            username: 'Sending...',
            display_name: 'Sending...',
          }
        };

        queryClient.setQueryData<MessagesResponse>(MESSAGES_KEY(roomId), {
          ...previousMessages,
          messages: [...previousMessages.messages, optimisticMessage]
        });
      }

      return { previousMessages };
    },
    // If mutation fails, use the context returned from onMutate to roll back
    onError: (err, newMessage, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(MESSAGES_KEY(roomId), context.previousMessages);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_KEY(roomId) });
    },
  });

  // Add a new message to cache (for realtime updates)
  const addMessageToCache = (message: Message) => {
    queryClient.setQueryData<MessagesResponse>(MESSAGES_KEY(roomId), (old) => {
      if (!old) return { messages: [message], activeUsers: 0 };
      
      // Check if message already exists
      const exists = old.messages.some(m => m.id === message.id);
      if (exists) return old;
      
      return {
        ...old,
        messages: [...old.messages, message]
      };
    });
  };

  // Update active users count
  const updateActiveUsers = (count: number) => {
    queryClient.setQueryData<MessagesResponse>(MESSAGES_KEY(roomId), (old) => {
      if (!old) return { messages: [], activeUsers: count };
      return { ...old, activeUsers: count };
    });
  };

  return {
    messages: data?.messages || [],
    activeUsers: data?.activeUsers || 0,
    isLoading,
    error,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending, // v5 uses isPending instead of isLoading
    addMessageToCache,
    updateActiveUsers,
  };
}