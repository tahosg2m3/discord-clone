import { useState, useRef, useEffect } from 'react';
import { Plus, Smile, Image as ImageIcon } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import GifPicker from './GifPicker';

export default function MessageInput({ channelName, onSend, onTyping }) {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    
    // Dışarı tıklayınca emoji picker kapat
    const handleClickOutside = (event) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [channelName]);

  const handleChange = (e) => {
    setMessage(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 1000);
  };

  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSend(message);
    setMessage('');
    setShowEmoji(false);
  };

  return (
    <div className="px-4 pb-6 relative">
      {/* Emoji Picker Popup */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-20 right-4 z-50 shadow-2xl rounded-xl">
          <EmojiPicker 
            onEmojiClick={handleEmojiClick} 
            theme="dark" 
            width={350} 
            height={400}
          />
        </div>
      )}

      {/* Gif Picker */}
      {showGif && (
        <GifPicker onClose={() => setShowGif(false)} onSelectGif={(url) => onSend(`[GIF:${url}]`)} />
      )}

      <form onSubmit={handleSubmit} className="bg-gray-600 rounded-lg flex items-center px-4 relative z-10">
        <button type="button" className="text-gray-400 hover:text-gray-200 p-2">
          <Plus className="w-6 h-6" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleChange}
          placeholder={`Message #${channelName}`}
          className="flex-1 bg-transparent text-white py-3 px-2 focus:outline-none placeholder-gray-400"
        />

        <div className="flex items-center space-x-1">
          <button 
            type="button" 
            onClick={() => setShowGif(!showGif)} 
            className="text-gray-400 hover:text-gray-200 p-2"
          >
            <ImageIcon className="w-6 h-6" />
          </button>
          
          <button 
            type="button" 
            onClick={() => setShowEmoji(!showEmoji)} 
            className={`p-2 transition-colors ${showEmoji ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
          >
            <Smile className="w-6 h-6" />
          </button>
        </div>
      </form>
    </div>
  );
}