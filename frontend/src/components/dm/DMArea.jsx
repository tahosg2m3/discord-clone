import { useState, useEffect } from 'react';
import { useDM } from '../../context/DMContext';
import { useAuth } from '../../context/AuthContext';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';

export default function DMArea() {
  const { currentConversation, dmMessages, sendDM } = useDM();
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState([]);

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Select a conversation to start chatting</p>
      </div>
    );
  }

  const messages = dmMessages[currentConversation.id] || [];
  const otherUser = currentConversation.otherUser;

  const handleSendMessage = (content) => {
    sendDM(content);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-700">
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-800">
        <h2 className="font-semibold text-white">
          @ {otherUser?.username}
        </h2>
      </div>

      <MessageList messages={messages} currentUser={user.username} />

      <MessageInput
        channelName={otherUser?.username || 'User'}
        onSend={handleSendMessage}
        onTyping={() => {}}
      />
    </div>
  );
}
