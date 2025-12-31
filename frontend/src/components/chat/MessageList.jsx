import { useEffect, useRef } from 'react';
import Message from './Message';

export default function MessageList({ messages, currentUser }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const prevScrollHeightRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    // Only auto-scroll if user is near bottom (not reading old messages)
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    prevScrollHeightRef.current = container.scrollHeight;
  }, [messages]);

  // Group messages by same user if sent within 5 minutes
  const groupedMessages = messages.reduce((acc, message, index) => {
    if (message.type === 'system') {
      acc.push({ ...message, grouped: false });
      return acc;
    }

    const prevMessage = messages[index - 1];
    const shouldGroup =
      prevMessage &&
      prevMessage.type !== 'system' &&
      prevMessage.username === message.username &&
      message.timestamp - prevMessage.timestamp < 5 * 60 * 1000; // 5 minutes

    acc.push({ ...message, grouped: shouldGroup });
    return acc;
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5"
    >
      {groupedMessages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        groupedMessages.map((message, index) => (
          <Message
            key={message.id}
            message={message}
            isOwn={message.username === currentUser}
            grouped={message.grouped}
          />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}