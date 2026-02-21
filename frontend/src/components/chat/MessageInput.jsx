import { useState } from 'react';
import { PlusCircle, Image as ImageIcon, SmilePlus } from 'lucide-react';

export default function MessageInput({ onSendMessage, placeholder }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message); // Mesajı üst komponente iletir
      setMessage(''); // Kutuyu temizler
    }
  };

  const handleKeyDown = (e) => {
    // Sadece Enter'a basıldığında (Shift+Enter alt satıra geçer)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="relative bg-[#383A40] rounded-lg flex items-center px-4 py-2.5 shadow-sm"
    >
      {/* Sol Artı Butonu */}
      <button 
        type="button" 
        className="text-[#B5BAC1] hover:text-[#DBDEE1] transition-colors mr-4"
      >
        <PlusCircle className="w-6 h-6" />
      </button>
      
      {/* Mesaj Yazma Alanı */}
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Mesaj gönder...'}
        className="flex-1 bg-transparent border-none focus:outline-none text-[#DBDEE1] placeholder-[#949BA4] text-[15px]"
        autoFocus
        autoComplete="off"
      />
      
      {/* Sağ İkonlar (Gif, Emoji vs.) */}
      <div className="flex items-center space-x-3 ml-3">
        <button type="button" className="text-[#B5BAC1] hover:text-[#DBDEE1] transition-colors">
          <ImageIcon className="w-6 h-6" />
        </button>
        <button type="button" className="text-[#B5BAC1] hover:text-[#DBDEE1] transition-colors">
          <SmilePlus className="w-6 h-6" />
        </button>
      </div>
    </form>
  );
}