// frontend/src/components/chat/Message.jsx
import { formatTime } from '../../utils/formatTime';
import { getColorForString } from '../../utils/colors';

export default function Message({ message, isOwn, grouped }) {
  // System messages (join/leave notifications)
  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center py-1">
        <span className="text-xs text-gray-500 italic">{message.content}</span>
      </div>
    );
  }

  const avatarColor = getColorForString(message.username);
  const initial = message.username[0].toUpperCase();

  // GIF kontrolü: [GIF:url] formatını algıla
  const isGif = message.content.startsWith('[GIF:') && message.content.endsWith(']');
  const gifUrl = isGif ? message.content.slice(5, -1) : null;

  return (
    <div
      className={`
        group relative py-0.5 px-4 -mx-4 hover:bg-gray-800/30 
        ${grouped ? '' : 'mt-4'}
      `}
    >
      <div className="flex items-start space-x-4">
        {/* Avatar (hidden if grouped) */}
        <div className={`${grouped ? 'invisible' : ''} flex-shrink-0`}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center 
                        text-white font-semibold"
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Username & Timestamp (hidden if grouped) */}
          {!grouped && (
            <div className="flex items-baseline space-x-2 mb-1">
              <span
                className="font-semibold hover:underline cursor-pointer"
                style={{ color: avatarColor }}
              >
                {message.username}
              </span>
              <span className="text-xs text-gray-500">
                {formatTime(message.timestamp)}
              </span>
            </div>
          )}

          {/* GIF veya Text Render */}
          {isGif ? (
            <div className="mt-1">
              <img
                src={gifUrl}
                alt="GIF"
                className="max-w-md rounded-lg shadow-sm"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="text-gray-100 break-words leading-relaxed">
              {message.content}
            </div>
          )}
        </div>

        {/* Hover Timestamp (only for grouped messages) */}
        {grouped && (
          <div className="opacity-0 group-hover:opacity-100 text-xs text-gray-500 
                          absolute right-4 top-1 transition-opacity">
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}