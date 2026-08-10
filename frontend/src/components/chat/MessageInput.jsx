import { useCallback, useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Image as ImageIcon, SmilePlus, X } from 'lucide-react';
import FileUpload from './FileUpload';
import GifPicker from './GifPicker';

function attachmentLabel(attachment) {
  if (attachment.type === 'gif') return 'GIF';
  return attachment.filename || 'Dosya';
}

export default function MessageInput({
  onSendMessage,
  placeholder,
  onTypingStart,
  onTypingStop,
  replyTo,
  onCancelReply,
  disabled = false,
}) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
    if (typingRef.current) onTypingStop?.();
    typingRef.current = false;
  }, [onTypingStop]);

  const refreshTypingTimer = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      onTypingStart?.();
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 1600);
  }, [onTypingStart, stopTyping]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const content = message.trim();
    if ((!content && attachments.length === 0) || disabled) return;

    // ZWSP, yalnızca ekli bir mesajın eski backend sürümlerinde reddedilmemesini sağlar.
    onSendMessage({
      content: content || '\u200B',
      attachments,
      replyTo: replyTo
        ? { id: replyTo.id, username: replyTo.username, content: replyTo.content }
        : null,
    });
    setMessage('');
    setAttachments([]);
    setShowEmojiPicker(false);
    stopTyping();
    onCancelReply?.();
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setMessage(nextValue);
    if (nextValue.trim()) refreshTypingTimer();
    else stopTyping();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
    if (event.key === 'Escape') {
      setShowEmojiPicker(false);
      setShowGifPicker(false);
      if (replyTo) onCancelReply?.();
    }
  };

  const appendEmoji = (emojiData) => {
    setMessage((current) => `${current}${emojiData.emoji}`);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
    refreshTypingTimer();
  };

  const addAttachment = (attachment) => {
    setAttachments((current) => [...current, attachment]);
  };

  return (
    <>
      {showGifPicker && (
        <GifPicker
          onClose={() => setShowGifPicker(false)}
          onSelectGif={addAttachment}
        />
      )}

      <div className="relative">
        {replyTo && (
          <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-white/[0.08] bg-[#1a2333] px-4 py-2.5 text-sm">
            <div className="min-w-0 truncate text-[#cbd5e1]">
              <span className="mr-2 font-semibold text-[#60a5fa]">{replyTo.username}</span>
              <span className="text-[#94a3b8]">{replyTo.content || 'Ekli mesaj'}</span>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              aria-label="Yanıtı iptal et"
              className="ml-3 rounded-md p-1 text-[#94a3b8] hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border border-b-0 border-white/[0.08] bg-[#1a2333] px-3 py-2">
            {attachments.map((attachment, index) => (
              <div key={`${attachment.url}-${index}`} className="group/attachment relative flex max-w-[220px] items-center gap-2 rounded-lg bg-[#111827] px-2 py-1.5 text-xs text-[#cbd5e1]">
                {attachment.type === 'image' || attachment.type === 'gif' ? (
                  <img src={attachment.previewUrl || attachment.url} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-[#26354b] font-semibold text-[#93c5fd]">FILE</span>
                )}
                <span className="truncate">{attachmentLabel(attachment)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="rounded p-0.5 text-[#94a3b8] hover:bg-white/[0.1] hover:text-white"
                  aria-label={`${attachmentLabel(attachment)} ekini kaldır`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`relative flex items-center border border-white/[0.07] bg-[#1e293b] px-3 py-2.5 shadow-lg shadow-black/10 transition-colors focus-within:border-[#3b82f6]/70 ${replyTo || attachments.length > 0 ? 'rounded-b-xl' : 'rounded-xl'}`}
        >
          <FileUpload onFileSelect={addAttachment} disabled={disabled} />

          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Bir emoji veya dosya düğmesine basarken yazıyor bilgisini hemen kapatma.
              window.setTimeout(stopTyping, 200);
            }}
            placeholder={placeholder || 'Mesaj gönder...'}
            disabled={disabled}
            className="min-w-0 flex-1 bg-transparent px-2 text-[15px] text-[#DBDEE1] outline-none placeholder:text-[#64748b] disabled:cursor-not-allowed"
            autoComplete="off"
          />

          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setShowGifPicker(true);
                setShowEmojiPicker(false);
              }}
              disabled={disabled}
              className="rounded-lg p-1.5 text-[#B5BAC1] transition-colors hover:bg-white/[0.08] hover:text-[#DBDEE1] disabled:opacity-50"
              aria-label="GIF ekle"
              title="GIF ekle"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker((show) => !show);
                setShowGifPicker(false);
              }}
              disabled={disabled}
              className="rounded-lg p-1.5 text-[#B5BAC1] transition-colors hover:bg-white/[0.08] hover:text-[#DBDEE1] disabled:opacity-50"
              aria-label="Emoji ekle"
              title="Emoji ekle"
            >
              <SmilePlus className="h-5 w-5" />
            </button>
          </div>

          {showEmojiPicker && (
            <div className="absolute bottom-[calc(100%+10px)] right-0 z-[70] overflow-hidden rounded-xl border border-white/[0.1] shadow-2xl shadow-black/50">
              <EmojiPicker
                theme="dark"
                width={320}
                height={400}
                lazyLoadEmojis
                onEmojiClick={appendEmoji}
                searchPlaceholder="Emoji ara"
              />
            </div>
          )}
        </form>
      </div>
    </>
  );
}
