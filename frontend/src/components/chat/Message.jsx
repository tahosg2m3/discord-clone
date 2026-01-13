import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatTime } from '../../utils/formatTime';
import { getColorForString } from '../../utils/colors';
import { Pencil, Trash2, MoreHorizontal, X, Check } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useServer } from '../../context/ServerContext';
import toast from 'react-hot-toast';

export default function Message({ message, isOwn, grouped, userId }) {
  const { socket } = useSocket();
  const { currentChannel } = useServer();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  // System messages
  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center py-1">
        <span className="text-xs text-gray-500 italic">{message.content}</span>
      </div>
    );
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      socket.emit('message:delete', { 
        messageId: message.id, 
        channelId: currentChannel.id 
      });
    }
  };

  const handleEdit = () => {
    if (editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    
    socket.emit('message:edit', {
      messageId: message.id,
      channelId: currentChannel.id,
      content: editContent
    });
    setIsEditing(false);
    toast.success('Message updated');
  };

  const avatarColor = getColorForString(message.username);
  const initial = message.username[0].toUpperCase();

  return (
    <div className={`group relative py-0.5 px-4 -mx-4 hover:bg-gray-800/30 ${grouped ? '' : 'mt-4'}`}>
      
      {/* Edit/Delete Actions */}
      {isOwn && !isEditing && (
        <div className="absolute right-4 top-0 -translate-y-1/2 bg-gray-900 border border-gray-800 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center z-10">
          <button onClick={() => setIsEditing(true)} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-blue-400" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-red-400" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-start space-x-4">
        {/* Avatar */}
        <div className={`${grouped ? 'invisible' : ''} flex-shrink-0 w-10`}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold select-none"
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {!grouped && (
            <div className="flex items-baseline space-x-2 mb-1">
              <span className="font-semibold hover:underline cursor-pointer text-white">
                {message.username}
              </span>
              <span className="text-xs text-gray-500 select-none">
                {formatTime(message.timestamp)}
              </span>
            </div>
          )}

          {isEditing ? (
            <div className="bg-gray-900 p-2 rounded">
              <input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-transparent text-white p-1 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) handleEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <div className="text-xs text-gray-500 mt-1">
                escape to cancel • enter to save
              </div>
            </div>
          ) : (
            <div className="text-gray-300 break-words leading-relaxed markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({node, ...props}) => <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
                  code: ({node, inline, ...props}) => 
                    inline 
                      ? <code {...props} className="bg-gray-900 px-1 py-0.5 rounded text-sm font-mono" />
                      : <div className="bg-gray-950 p-2 rounded my-1 overflow-x-auto"><code {...props} className="font-mono text-sm" /></div>
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isEdited && <span className="text-xs text-gray-500 ml-1">(edited)</span>}
            </div>
          )}

          {/* Link Preview (Metadata) */}
          {!isEditing && message.metadata && (
            <div className="mt-2 max-w-sm bg-gray-900 border-l-4 border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">{new URL(message.metadata.url).hostname}</div>
              <a href={message.metadata.url} target="_blank" rel="noopener noreferrer" className="block text-blue-400 font-semibold hover:underline mb-1 truncate">
                {message.metadata.title}
              </a>
              {message.metadata.description && (
                <p className="text-sm text-gray-300 line-clamp-2 mb-2">{message.metadata.description}</p>
              )}
              {message.metadata.image && (
                <img src={message.metadata.image} alt="Preview" className="rounded max-h-40 object-cover" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}