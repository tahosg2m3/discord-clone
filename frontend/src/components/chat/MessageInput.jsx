// frontend/src/components/chat/MessageInput.jsx
import { useState, useRef, useEffect } from 'react';
import { Plus, Smile } from 'lucide-react';

export default function MessageInput({ channelName, onSend, onTyping }) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus input when component mounts
    inputRef.current?.focus();
  }, [channelName]); // Refocus when channel changes

  const handleChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Typing indicator logic
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    // Reset typing timeout
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 1000); // Stop typing indicator after 1 second of inactivity
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    onSend(message);
    setMessage('');
    setIsTyping(false);
    onTyping(false);
    clearTimeout(typingTimeoutRef.current);

    // Keep focus on input
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="px-4 pb-6">
      <form onSubmit={handleSubmit}>
        <div className="bg-gray-600 rounded-lg flex items-center px-4">
          {/* Add Attachment Button */}
          <button
            type="button"
            className="text-gray-400 hover:text-gray-200 transition-colors mr-2"
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="flex-1 bg-transparent text-white py-3 px-2 
                     focus:outline-none placeholder-gray-400"
            maxLength={2000}
          />

          {/* Emoji Button */}
          <button
            type="button"
            className="text-gray-400 hover:text-gray-200 transition-colors ml-2"
          >
            <Smile className="w-6 h-6" />
          </button>
        </div>
      </form>
    </div>
  );
}