import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Pin, Search, Users, X } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { fetchChannelMessages } from '../../services/api';
import Message from '../chat/Message';
import MessageInput from '../chat/MessageInput';
import TypingIndicator from '../chat/TypingIndicator';

function updateMessageInList(messages, update) {
  const messageId = update.messageId || update.id;
  return messages.map((message) => message.id === messageId ? { ...message, ...update } : message);
}

export default function ChatArea() {
  const { currentChannel } = useServer();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteSearchResults, setRemoteSearchResults] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messageListRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const isNearBottomRef = useRef(true);
  const shouldScrollToBottomRef = useRef(true);

  const channelId = currentChannel?.id;

  const markChannelRead = useCallback(() => {
    if (!channelId || !user?.id) return;
    localStorage.setItem(`chat:last-read:${channelId}:${user.id}`, String(Date.now()));
    setFirstUnreadId(null);
    socket?.emit('channel:read', { channelId, userId: user.id });
  }, [channelId, socket, user?.id]);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setFirstUnreadId(null);
      return undefined;
    }

    let stillCurrent = true;
    setMessages([]);
    setTypingUsers([]);
    setReplyTo(null);
    setSearchQuery('');
    setRemoteSearchResults([]);
    setFirstUnreadId(null);
    shouldScrollToBottomRef.current = true;

    fetchChannelMessages(channelId)
      .then((channelMessages) => {
        if (!stillCurrent) return;
        setMessages(channelMessages);
      })
      .catch((error) => console.error('Kanal mesajları yüklenemedi:', error));

    return () => {
      stillCurrent = false;
    };
  }, [channelId]);

  useEffect(() => {
    if (!socket || !channelId || !user) return undefined;

    socket.emit('user:join', { channelId, username: user.username });

    const clearTypingUser = (username) => {
      const existingTimer = typingTimersRef.current.get(username);
      if (existingTimer) clearTimeout(existingTimer);
      typingTimersRef.current.delete(username);
      setTypingUsers((current) => current.filter((name) => name !== username));
    };

    const handleReceive = (message) => {
      if (message.channelId !== channelId) return;
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message];
      });

      if (message.userId !== user.id && !isNearBottomRef.current) {
        setFirstUnreadId((current) => current || message.id);
      } else {
        shouldScrollToBottomRef.current = true;
      }
    };

    const handleUpdate = (updatedMessage) => {
      setMessages((current) => updateMessageInList(current, updatedMessage));
    };

    const handleDelete = ({ messageId }) => {
      setMessages((current) => current.filter((message) => message.id !== messageId));
      setReplyTo((current) => current?.id === messageId ? null : current);
    };

    const handleTypingActive = ({ username }) => {
      if (!username || username === user.username) return;
      const existingTimer = typingTimersRef.current.get(username);
      if (existingTimer) clearTimeout(existingTimer);
      setTypingUsers((current) => current.includes(username) ? current : [...current, username]);
      typingTimersRef.current.set(username, setTimeout(() => clearTypingUser(username), 3000));
    };

    const handleTypingInactive = ({ username }) => {
      if (username) clearTypingUser(username);
    };

    const handleReactionUpdate = (payload) => {
      const update = payload.message || payload;
      if (!update?.messageId && !update?.id) return;
      setMessages((current) => updateMessageInList(current, update));
    };

    const handlePinUpdate = (payload) => {
      const update = payload.message || payload;
      if (!update?.messageId && !update?.id) return;
      setMessages((current) => updateMessageInList(current, update));
    };

    const handleSearchResults = (payload) => {
      if (payload?.channelId && payload.channelId !== channelId) return;
      setRemoteSearchResults(Array.isArray(payload) ? payload : payload?.messages || payload?.results || []);
    };

    socket.on('message:receive', handleReceive);
    socket.on('message:update', handleUpdate);
    socket.on('message:delete', handleDelete);
    socket.on('typing:active', handleTypingActive);
    socket.on('typing:inactive', handleTypingInactive);
    socket.on('message:reaction:update', handleReactionUpdate);
    socket.on('message:pin:update', handlePinUpdate);
    socket.on('message:search:results', handleSearchResults);

    return () => {
      socket.emit('user:leave', { channelId });
      socket.off('message:receive', handleReceive);
      socket.off('message:update', handleUpdate);
      socket.off('message:delete', handleDelete);
      socket.off('typing:active', handleTypingActive);
      socket.off('typing:inactive', handleTypingInactive);
      socket.off('message:reaction:update', handleReactionUpdate);
      socket.off('message:pin:update', handlePinUpdate);
      socket.off('message:search:results', handleSearchResults);
      typingTimersRef.current.forEach((timer) => clearTimeout(timer));
      typingTimersRef.current.clear();
    };
  }, [channelId, socket, user]);

  useEffect(() => {
    if (!searchQuery.trim() || !socket || !channelId) {
      setRemoteSearchResults([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      socket.emit('message:search', { channelId, query: searchQuery.trim() }, (result) => {
        if (Array.isArray(result)) setRemoteSearchResults(result);
        else if (Array.isArray(result?.messages)) setRemoteSearchResults(result.messages);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [channelId, searchQuery, socket]);

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto' });
      shouldScrollToBottomRef.current = false;
      markChannelRead();
    }
  }, [markChannelRead, messages]);

  const localSearchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('tr-TR');
    if (!normalizedQuery) return messages;
    return messages.filter((message) => {
      const attachmentText = (message.attachments || []).map((attachment) => attachment.filename || attachment.name || '').join(' ');
      return `${message.username || ''} ${message.content || ''} ${attachmentText}`.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
    });
  }, [messages, searchQuery]);

  const visibleMessages = searchQuery.trim() && remoteSearchResults.length > 0 ? remoteSearchResults : localSearchResults;
  const pinnedMessages = messages.filter((message) => message.isPinned);

  const handleScroll = () => {
    const node = messageListRef.current;
    if (!node) return;
    const nextNearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 64;
    if (nextNearBottom !== isNearBottomRef.current) {
      isNearBottomRef.current = nextNearBottom;
      setIsNearBottom(nextNearBottom);
    }
    if (nextNearBottom) markChannelRead();
  };

  const handleSendMessage = (payload) => {
    if (!channelId || !socket || !user) return;
    const messagePayload = typeof payload === 'string' ? { content: payload, attachments: [], replyTo: null } : payload;
    if (!messagePayload.content?.trim() && !(messagePayload.attachments || []).length) return;

    socket.emit('message:send', {
      channelId,
      content: messagePayload.content,
      attachments: messagePayload.attachments || [],
      replyTo: messagePayload.replyTo || null,
      userId: user.id,
      username: user.username,
    });
    socket.emit('typing:stop', { channelId });
    shouldScrollToBottomRef.current = true;
  };

  const handleReaction = (message, emoji) => {
    socket?.emit('message:reaction:toggle', { channelId, messageId: message.id, emoji, userId: user.id });
  };

  const handlePin = (message) => {
    socket?.emit('message:pin:toggle', { channelId, messageId: message.id, userId: user.id });
  };

  if (!currentChannel) return null;

  return (
    <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col bg-[#111827]">
      <div className="z-20 flex h-14 shrink-0 items-center border-b border-white/[0.06] bg-[#111827]/90 px-5 backdrop-blur">
        <div className="mr-2.5 flex items-center text-[#60a5fa]"><Hash className="h-5 w-5" /></div>
        <div className="font-semibold text-[#f8fafc]">{currentChannel.name}</div>

        <div className="ml-auto flex items-center gap-2 text-[#94a3b8]">
          {isSearchOpen ? (
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#1e293b] px-2">
              <Search className="h-4 w-4 text-[#64748b]" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} autoFocus placeholder="Mesajlarda ara" className="w-40 bg-transparent px-2 py-1.5 text-sm text-[#e2e8f0] outline-none placeholder:text-[#64748b]" />
              <button type="button" onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="rounded p-0.5 hover:bg-white/[0.08]" aria-label="Aramayı kapat"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setIsSearchOpen(true)} className="rounded-lg p-2 transition-colors hover:bg-white/[0.07] hover:text-[#f8fafc]" title="Mesajlarda ara" aria-label="Mesajlarda ara"><Search className="h-5 w-5" /></button>
          )}
          <button type="button" onClick={() => setShowPinned((show) => !show)} className={`rounded-lg p-2 transition-colors hover:bg-white/[0.07] hover:text-[#f8fafc] ${showPinned ? 'text-[#fbbf24]' : ''}`} title="Sabitlenmiş mesajlar" aria-label="Sabitlenmiş mesajlar"><Pin className="h-5 w-5" /></button>
          <Users className="h-5 w-5 cursor-pointer transition-colors hover:text-[#f8fafc]" title="Üye listesi" />
        </div>
      </div>

      {showPinned && (
        <div className="absolute right-5 top-16 z-40 w-80 overflow-hidden rounded-xl border border-white/[0.1] bg-[#1e293b] shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5"><span className="text-sm font-semibold text-[#f8fafc]">Sabitlenmiş mesajlar</span><button type="button" onClick={() => setShowPinned(false)} className="rounded p-1 text-[#94a3b8] hover:bg-white/[0.08] hover:text-white"><X className="h-4 w-4" /></button></div>
          <div className="custom-scrollbar max-h-72 overflow-y-auto p-2">
            {pinnedMessages.length === 0 ? <p className="p-3 text-sm text-[#94a3b8]">Bu kanalda sabitlenmiş mesaj yok.</p> : pinnedMessages.map((message) => <button key={message.id} type="button" onClick={() => { setShowPinned(false); document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="block w-full rounded-lg px-2 py-2 text-left hover:bg-white/[0.06]"><span className="mr-2 text-xs font-semibold text-[#93c5fd]">{message.username}</span><span className="text-sm text-[#cbd5e1]">{message.content || 'Ekli mesaj'}</span></button>)}
          </div>
        </div>
      )}

      <div ref={messageListRef} onScroll={handleScroll} className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-7 mt-5 border-b border-white/[0.06] pb-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/20"><Hash className="h-8 w-8" /></div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-[#f8fafc]">#{currentChannel.name} kanalına hoş geldin</h1>
          <p className="text-[14px] text-[#94a3b8]">Sohbete başlamak için ilk mesajını gönder.</p>
        </div>

        {searchQuery.trim() && <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#94a3b8]"><Search className="h-3.5 w-3.5" /> “{searchQuery}” için {visibleMessages.length} sonuç</div>}

        {visibleMessages.map((message, index) => {
          const previousMessage = visibleMessages[index - 1];
          const grouped = previousMessage && previousMessage.userId === message.userId && (message.timestamp - previousMessage.timestamp < 300000);
          return (
            <div id={`message-${message.id}`} key={message.id}>
              {firstUnreadId === message.id && !searchQuery.trim() && <div className="my-3 flex items-center gap-2 text-xs font-semibold text-[#f87171]"><div className="h-px flex-1 bg-[#ef4444]/70" /><span>Yeni mesajlar</span><div className="h-px flex-1 bg-[#ef4444]/70" /></div>}
              <Message message={message} isOwn={message.userId === user.id} grouped={grouped} userId={user.id} currentUsername={user.username} onReply={setReplyTo} onReaction={handleReaction} onPin={handlePin} />
            </div>
          );
        })}

        {visibleMessages.length === 0 && searchQuery.trim() && <div className="py-12 text-center text-sm text-[#94a3b8]">Aramanla eşleşen mesaj bulunamadı.</div>}
        <div ref={messagesEndRef} />
      </div>

      {!isNearBottom && firstUnreadId && <button type="button" onClick={() => { shouldScrollToBottomRef.current = true; messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); markChannelRead(); }} className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/30 transition-colors hover:bg-[#3b82f6]">Yeni mesajlara git</button>}

      <div className="shrink-0 px-5 pb-2 pt-1"><TypingIndicator users={typingUsers} /></div>
      <div className="shrink-0 px-5 pb-5 pt-2">
        <MessageInput
          onSendMessage={handleSendMessage}
          onTypingStart={() => socket?.emit('typing:start', { channelId })}
          onTypingStop={() => socket?.emit('typing:stop', { channelId })}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={`#${currentChannel.name} kanalına mesaj gönder`}
        />
      </div>
    </div>
  );
}
