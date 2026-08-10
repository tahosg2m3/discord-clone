import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CornerUpLeft, FileText, Pencil, Pin, SmilePlus, Trash2 } from 'lucide-react';
import { formatTime } from '../../utils/formatTime';
import { getColorForString } from '../../utils/colors';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';
import UserPopover from '../profile/UserPopover';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

function asAbsoluteUrl(url) {
  if (!url || url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function normalizeReactions(reactions) {
  if (!reactions) return [];

  if (Array.isArray(reactions)) {
    return reactions
      .map((reaction) => ({
        emoji: reaction.emoji || reaction.name || reaction,
        userIds: reaction.userIds || reaction.users || [],
        count: reaction.count ?? (reaction.userIds || reaction.users || []).length ?? 0,
      }))
      .filter((reaction) => reaction.emoji);
  }

  return Object.entries(reactions).map(([emoji, value]) => ({
    emoji,
    userIds: Array.isArray(value) ? value : value?.userIds || value?.users || [],
    count: typeof value === 'number' ? value : value?.count ?? (Array.isArray(value) ? value.length : 0),
  }));
}

function attachmentIsImage(attachment) {
  return attachment?.type === 'image'
    || attachment?.type === 'gif'
    || attachment?.mimetype?.startsWith('image/');
}

export default function Message({
  message,
  isOwn,
  grouped,
  userId,
  currentUsername,
  onReply,
  onReaction,
  onPin,
}) {
  const { socket } = useSocket();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showProfile, setShowProfile] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const reactions = useMemo(() => normalizeReactions(message.reactions), [message.reactions]);
  const hasMention = Boolean(
    currentUsername
    && (message.mentions?.includes?.(userId)
      || message.content?.toLocaleLowerCase('tr-TR').includes(`@${currentUsername}`.toLocaleLowerCase('tr-TR')))
  );

  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs font-medium text-[#94a3b8]">
          {message.content}
        </span>
      </div>
    );
  }

  const handleDelete = () => {
    if (window.confirm('Bu mesajı silmek istediğine emin misin?')) {
      socket?.emit('message:delete', {
        messageId: message.id,
        channelId: message.channelId,
        userId,
      });
    }
  };

  const handleEdit = () => {
    if (!editContent.trim() || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }

    socket?.emit('message:edit', {
      messageId: message.id,
      channelId: message.channelId,
      content: editContent.trim(),
      userId,
    });
    setIsEditing(false);
    toast.success('Mesaj güncellendi');
  };

  const handleReaction = (emoji) => {
    setShowReactionPicker(false);
    onReaction?.(message, emoji);
  };

  const handlePin = () => onPin?.(message);

  const avatarColor = getColorForString(message.username || '?');
  const initial = (message.username || '?')[0].toUpperCase();
  const messageUser = { id: message.userId, username: message.username };
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const quote = message.replyTo || message.reply || null;

  let metadataHostname = '';
  try {
    metadataHostname = message.metadata?.url ? new URL(message.metadata.url).hostname : '';
  } catch {
    metadataHostname = '';
  }

  return (
    <>
      {showProfile && <UserPopover targetUser={messageUser} onClose={() => setShowProfile(false)} />}

      <div className={`group relative border-l-2 px-4 py-0.5 transition-colors hover:bg-white/[0.035] ${hasMention ? 'border-[#fbbf24] bg-[#f59e0b]/[0.08]' : 'border-transparent'} ${grouped ? '' : 'mt-[17px]'}`}>
        <div className="absolute right-4 -top-4 z-20 flex overflow-visible rounded-md border border-[#111827] bg-[#1e293b] shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => onReply?.(message)} className="rounded-l-md p-2 text-[#B5BAC1] transition-colors hover:bg-[#334155] hover:text-[#DBDEE1]" title="Yanıtla" aria-label="Yanıtla">
            <CornerUpLeft className="h-4 w-4" />
          </button>
          <div className="relative">
            <button onClick={() => setShowReactionPicker((show) => !show)} className="p-2 text-[#B5BAC1] transition-colors hover:bg-[#334155] hover:text-[#DBDEE1]" title="Tepki ekle" aria-label="Tepki ekle">
              <SmilePlus className="h-4 w-4" />
            </button>
            {showReactionPicker && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex gap-1 rounded-xl border border-white/[0.1] bg-[#1e293b] p-1.5 shadow-2xl shadow-black/50">
                {QUICK_REACTIONS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => handleReaction(emoji)} className="rounded-lg p-1.5 text-lg transition-colors hover:bg-white/[0.1]" aria-label={`${emoji} tepkisi`}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handlePin} className={`p-2 transition-colors hover:bg-[#334155] ${message.isPinned ? 'text-[#fbbf24]' : 'text-[#B5BAC1] hover:text-[#DBDEE1]'}`} title={message.isPinned ? 'Sabitlemeyi kaldır' : 'Mesajı sabitle'} aria-label={message.isPinned ? 'Sabitlemeyi kaldır' : 'Mesajı sabitle'}>
            <Pin className="h-4 w-4" />
          </button>
          {isOwn && !isEditing && (
            <>
              <button onClick={() => setIsEditing(true)} className="p-2 text-[#B5BAC1] transition-colors hover:bg-[#334155] hover:text-[#DBDEE1]" title="Düzenle" aria-label="Düzenle">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={handleDelete} className="rounded-r-md p-2 text-[#B5BAC1] transition-colors hover:bg-[#334155] hover:text-[#fb7185]" title="Sil" aria-label="Sil">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {grouped && (
          <div className="absolute left-0 z-0 mt-[2px] w-[72px] select-none text-right opacity-0 group-hover:opacity-100">
            <span className="mr-1 text-[0.65rem] font-medium text-[#64748b]">{formatTime(message.timestamp).split(' ')[0]}</span>
          </div>
        )}

        <div className="relative flex items-start space-x-4 pl-[56px]">
          {!grouped && (
            <div
              onClick={() => setShowProfile(true)}
              className="absolute left-4 top-0.5 flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full text-white font-semibold shadow-sm transition-opacity hover:opacity-80"
              style={{ backgroundColor: avatarColor }}
            >
              {initial}
            </div>
          )}

          <div className="min-w-0 flex-1 overflow-hidden">
            {!grouped && (
              <div className="mb-0.5 flex items-baseline space-x-2">
                <span onClick={() => setShowProfile(true)} className="cursor-pointer text-[1rem] font-medium text-[#F2F3F5] hover:underline">
                  {message.username}
                </span>
                <span className="select-none text-[0.75rem] font-medium text-[#64748b]">{formatTime(message.timestamp)}</span>
                {message.isPinned && <Pin className="h-3.5 w-3.5 text-[#fbbf24]" aria-label="Sabitlenmiş mesaj" />}
              </div>
            )}

            {quote && (
              <button type="button" onClick={() => onReply?.(quote)} className="mb-1.5 flex max-w-full items-center gap-2 overflow-hidden border-l-2 border-[#64748b] pl-2 text-left text-xs text-[#94a3b8] transition-colors hover:border-[#60a5fa] hover:text-[#cbd5e1]">
                <CornerUpLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="shrink-0 font-semibold text-[#93c5fd]">{quote.username || quote.authorUsername || 'Bilinmeyen kullanıcı'}</span>
                <span className="truncate">{quote.content || 'Ekli mesaj'}</span>
              </button>
            )}

            {isEditing ? (
              <div className="mt-1 rounded-lg bg-[#1e293b] p-3">
                <input
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  className="w-full bg-transparent text-[#DBDEE1] outline-none"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) handleEdit();
                    if (event.key === 'Escape') setIsEditing(false);
                  }}
                />
                <div className="mt-2 text-[11px] font-medium text-[#64748b]">
                  İptal için <span className="cursor-pointer text-[#60a5fa] hover:underline" onClick={() => setIsEditing(false)}>escape</span> • Kaydetmek için <span className="cursor-pointer text-[#60a5fa] hover:underline" onClick={handleEdit}>enter</span>
                </div>
              </div>
            ) : (
              <>
                {message.content && message.content !== '\u200B' && (
                  <div className="markdown-content break-words text-[1rem] leading-[1.375rem] text-[#DBDEE1]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => <a {...props} className="text-[#60a5fa] hover:underline" target="_blank" rel="noopener noreferrer" />,
                        code: ({ node, inline, ...props }) => inline
                          ? <code {...props} className="rounded bg-[#111827] px-1.5 py-0.5 font-mono text-[13px] text-[#DBDEE1]" />
                          : <div className="my-2 overflow-x-auto rounded-md border border-white/[0.06] bg-[#111827] p-3"><code {...props} className="font-mono text-[13px] text-[#DBDEE1]" /></div>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {message.isEdited && <span className="ml-1 select-none text-[10px] text-[#64748b]">(düzenlendi)</span>}
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {attachments.map((attachment, index) => {
                      const url = asAbsoluteUrl(attachment.url);
                      const label = attachment.filename || attachment.name || 'Dosya';
                      return attachmentIsImage(attachment) ? (
                        <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="block max-w-[min(520px,100%)] overflow-hidden rounded-xl border border-white/[0.08] bg-[#111827]">
                          <img src={attachment.previewUrl || url} alt={label} className="max-h-[360px] max-w-full object-contain" loading="lazy" />
                        </a>
                      ) : (
                        <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="flex max-w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-[#1e293b] px-3 py-2 text-[#cbd5e1] transition-colors hover:bg-[#26354b]">
                          <FileText className="h-7 w-7 shrink-0 text-[#60a5fa]" />
                          <span className="min-w-0 truncate text-sm font-medium">{label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {!isEditing && message.metadata && (
              <div className="mt-2 max-w-md cursor-pointer rounded-r-lg border-l-4 border-[#334155] bg-[#1e293b] p-3">
                {metadataHostname && <div className="mb-1 text-[12px] font-medium text-[#64748b]">{metadataHostname}</div>}
                <a href={message.metadata.url} target="_blank" rel="noopener noreferrer" className="mb-1 block truncate text-[15px] font-semibold text-[#60a5fa] hover:underline">
                  {message.metadata.title}
                </a>
                {message.metadata.description && <p className="mb-3 line-clamp-3 text-[14px] text-[#DBDEE1]">{message.metadata.description}</p>}
                {message.metadata.image && <img src={message.metadata.image} alt="Önizleme" className="max-h-64 w-auto rounded-[4px] object-cover" />}
              </div>
            )}

            {reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {reactions.map((reaction) => {
                  const reacted = reaction.userIds.includes?.(userId);
                  return (
                    <button key={reaction.emoji} type="button" onClick={() => handleReaction(reaction.emoji)} className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-sm transition-colors ${reacted ? 'border-[#3b82f6]/70 bg-[#2563eb]/20 text-[#dbeafe]' : 'border-white/[0.09] bg-[#1e293b] text-[#cbd5e1] hover:bg-[#26354b]'}`}>
                      <span>{reaction.emoji}</span>
                      <span className="text-xs">{reaction.count || reaction.userIds.length || 1}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
