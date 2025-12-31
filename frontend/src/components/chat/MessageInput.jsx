// frontend/src/components/chat/MessageInput.jsx
import { useState, useRef, useEffect } from 'react';
import { Plus, Smile, Image } from 'lucide-react';
import GifPicker from './GifPicker';

export default function MessageInput({ channelName, onSend, onTyping }) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [channelName]);

  const handleChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 1000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    onSend(message);
    setMessage('');
    setIsTyping(false);
    onTyping(false);
    clearTimeout(typingTimeoutRef.current);
    inputRef.current?.focus();
  };

  const handleGifSelect = (gifUrl) => {
    // GIF seçildiğinde özel bir format ile gönderiyoruz
    onSend(`[GIF:${gifUrl}]`);
    setShowGifPicker(false); // Seçimden sonra kapat
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      <div className="px-4 pb-6">
        <form onSubmit={handleSubmit}>
          <div className="bg-gray-600 rounded-lg flex items-center px-4">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-200 transition-colors mr-2"
            >
              <Plus className="w-6 h-6" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${channelName}`}
              className="flex-1 bg-transparent text-white py-3 px-2 focus:outline-none placeholder-gray-400"
              maxLength={2000}
            />

            {/* GIF Button */}
            <button
              type="button"
              onClick={() => setShowGifPicker(!showGifPicker)}
              className={`transition-colors ml-2 ${showGifPicker ? 'text-gray-200' : 'text-gray-400 hover:text-gray-200'}`}
              title="Send GIF"
            >
              <Image className="w-6 h-6" />
            </button>

            <button
              type="button"
              className="text-gray-400 hover:text-gray-200 transition-colors ml-2"
            >
              <Smile className="w-6 h-6" />
            </button>
          </div>
        </form>
      </div>

      {/* GIF Picker Modal/Popover */}
      {showGifPicker && (
        <GifPicker
          onClose={() => setShowGifPicker(false)}
          onSelectGif={handleGifSelect}
        />
      )}
    </>
  );
}