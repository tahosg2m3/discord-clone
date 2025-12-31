// frontend/src/components/chat/MemberList.jsx
import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useServer } from '../../context/ServerContext';
import { getColorForString } from '../../utils/colors';

export default function MemberList() {
  const { socket } = useSocket();
  const { currentChannel } = useServer();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Request member list when channel changes
    socket.emit('members:request', { channelId: currentChannel.id });

    // Listen for member updates
    socket.on('members:update', (data) => {
      setMembers(data.members);
    });

    return () => {
      socket.off('members:update');
    };
  }, [socket, currentChannel]);

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-900">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Members — {members.length}
        </h3>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {members.map((member) => {
          const color = getColorForString(member.username);
          const initial = member.username[0].toUpperCase();

          return (
            <div
              key={member.id}
              className="flex items-center space-x-3 px-2 py-1.5 rounded 
                       hover:bg-gray-750 transition-colors cursor-pointer group"
            >
              {/* Avatar */}
              <div className="relative">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center 
                           text-white text-sm font-semibold"
                  style={{ backgroundColor: color }}
                >
                  {initial}
                </div>
                {/* Online Status */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 
                              rounded-full border-2 border-gray-800" />
              </div>

              {/* Username */}
              <span className="text-sm text-gray-300 group-hover:text-white 
                             transition-colors">
                {member.username}
              </span>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-4">
            No members online
          </div>
        )}
      </div>
    </div>
  );
}