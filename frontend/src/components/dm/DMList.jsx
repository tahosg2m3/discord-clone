import { useDM } from '../../context/DMContext';
import { useFriends } from '../../context/FriendsContext';
import { MessageSquare } from 'lucide-react';
import { getColorForString } from '../../utils/colors';

export default function DMList() {
  const { conversations, currentConversation, setCurrentConversation } = useDM();
  const { friends } = useFriends();

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      <div className="h-12 px-4 flex items-center shadow-md border-b border-gray-900">
        <h2 className="font-semibold text-white">Direct Messages</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {conversations.map((conv) => {
          const otherUser = conv.otherUser;
          if (!otherUser) return null;

          const color = getColorForString(otherUser.username);
          const initial = otherUser.username[0].toUpperCase();
          const isActive = currentConversation?.id === conv.id;

          return (
            <button
              key={conv.id}
              onClick={() => setCurrentConversation(conv)}
              className={`w-full flex items-center space-x-3 p-2 rounded-lg mb-1 transition-colors ${
                isActive
                  ? 'bg-gray-700'
                  : 'hover:bg-gray-750'
              }`}
            >
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: color }}
                >
                  {initial}
                </div>
                {otherUser.status === 'online' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
                )}
              </div>
              <span className="text-sm font-medium text-white truncate">
                {otherUser.username}
              </span>
            </button>
          );
        })}

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm text-center">
              No conversations yet. Add a friend to start chatting!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}