import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatTime } from '../../utils/formatTime';
import { getColorForString } from '../../utils/colors';
import { Pencil, Trash2 } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useServer } from '../../context/ServerContext';
import toast from 'react-hot-toast';
import UserPopover from '../profile/UserPopover'; // YENİ EKLENDİ

export default function Message({ message, isOwn, grouped, userId }) {
  const { socket } = useSocket();
  const { currentChannel } = useServer();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  
  // Profil kartını açmak için state
  const [showProfile, setShowProfile] = useState(false);

  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="text-xs text-[#949BA4] font-medium bg-[#2B2D31] px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const handleDelete = () => {
    if (window.confirm('Bu mesajı silmek istediğine emin misin?')) {
      socket.emit('message:delete', { messageId: message.id, channelId: currentChannel.id });
    }
  };

  const handleEdit = () => {
    if (editContent.trim() === message.content) { setIsEditing(false); return; }
    socket.emit('message:edit', { messageId: message.id, channelId: currentChannel.id, content: editContent });
    setIsEditing(false);
    toast.success('Mesaj güncellendi');
  };

  const avatarColor = getColorForString(message.username);
  const initial = message.username[0].toUpperCase();

  // Tıklandığında popover'a gönderilecek kullanıcı objesi
  const messageUser = {
    id: message.userId, // Mesaj modelinde gönderen kişinin ID'si
    username: message.username,
  };

  return (
    <>
      {/* Kullanıcı Profili Modalı */}
      {showProfile && (
        <UserPopover targetUser={messageUser} onClose={() => setShowProfile(false)} />
      )}

      <div className={`group relative px-4 py-0.5 hover:bg-[#2E3035] transition-colors ${grouped ? '' : 'mt-[17px]'}`}>
        
        {isOwn && !isEditing && (
          <div className="absolute right-4 -top-4 bg-[#313338] border border-[#1E1F22] rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center z-10 overflow-hidden">
            <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-[#404249] text-[#B5BAC1] hover:text-[#DBDEE1] transition-colors" title="Düzenle">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={handleDelete} className="p-2 hover:bg-[#404249] text-[#B5BAC1] hover:text-[#DA373C] transition-colors" title="Sil">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {grouped && (
          <div className="absolute left-0 w-[72px] text-right opacity-0 group-hover:opacity-100 select-none z-0 mt-[2px]">
            <span className="text-[0.65rem] text-[#949BA4] font-medium mr-1">
              {formatTime(message.timestamp).split(' ')[0]}
            </span>
          </div>
        )}

        <div className="flex items-start space-x-4 pl-[56px] relative">
          {!grouped && (
            <div 
              onClick={() => setShowProfile(true)}
              className="absolute left-4 top-0.5 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold select-none cursor-pointer hover:opacity-80 shadow-sm transition-opacity" 
              style={{ backgroundColor: avatarColor }}
            >
              {initial}
            </div>
          )}

          <div className="flex-1 min-w-0 overflow-hidden">
            {!grouped && (
              <div className="flex items-baseline space-x-2 mb-0.5">
                <span 
                  onClick={() => setShowProfile(true)}
                  className="text-[1rem] font-medium hover:underline cursor-pointer text-[#F2F3F5]"
                >
                  {message.username}
                </span>
                <span className="text-[0.75rem] text-[#949BA4] select-none font-medium">{formatTime(message.timestamp)}</span>
              </div>
            )}

            {isEditing ? (
              <div className="bg-[#2B2D31] p-3 rounded-lg mt-1">
                <input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-transparent text-[#DBDEE1] focus:outline-none" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleEdit(); if (e.key === 'Escape') setIsEditing(false); }} />
                <div className="text-[11px] text-[#949BA4] mt-2 font-medium">İptal için <span className="text-[#00A8FC] cursor-pointer hover:underline" onClick={() => setIsEditing(false)}>escape</span> • Kaydetmek için <span className="text-[#00A8FC] cursor-pointer hover:underline" onClick={handleEdit}>enter</span></div>
              </div>
            ) : (
              <div className="text-[#DBDEE1] break-words leading-[1.375rem] text-[1rem] markdown-content">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({node, ...props}) => <a {...props} className="text-[#00A8FC] hover:underline" target="_blank" rel="noopener noreferrer" />,
                    code: ({node, inline, ...props}) => inline ? <code {...props} className="bg-[#1E1F22] px-1.5 py-0.5 rounded text-[13px] font-mono text-[#DBDEE1]" /> : <div className="bg-[#2B2D31] border border-[#1E1F22] p-3 rounded-md my-2 overflow-x-auto"><code {...props} className="font-mono text-[13px] text-[#DBDEE1]" /></div>
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.isEdited && <span className="text-[10px] text-[#949BA4] ml-1 select-none">(düzenlendi)</span>}
              </div>
            )}

            {!isEditing && message.metadata && (
              <div className="mt-2 max-w-md bg-[#2B2D31] border-l-[4px] border-[#1E1F22] rounded-[4px] p-3 cursor-pointer">
                <div className="text-[12px] text-[#949BA4] font-medium mb-1">{new URL(message.metadata.url).hostname}</div>
                <a href={message.metadata.url} target="_blank" rel="noopener noreferrer" className="block text-[#00A8FC] font-semibold hover:underline mb-1 truncate text-[15px]">{message.metadata.title}</a>
                {message.metadata.description && <p className="text-[14px] text-[#DBDEE1] line-clamp-3 mb-3">{message.metadata.description}</p>}
                {message.metadata.image && <img src={message.metadata.image} alt="Preview" className="rounded-[4px] max-h-64 object-cover w-auto" />}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}