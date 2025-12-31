import { getColorForString } from '../../utils/colors';

export default function ServerIcon({ server, active, onClick }) {
  const color = getColorForString(server.name);
  const initials = server.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative group">
      {/* Active Indicator */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-white rounded-r-full" />
      )}

      {/* Server Circle */}
      <button
        onClick={onClick}
        className={`
          w-12 h-12 flex items-center justify-center
          transition-all duration-200
          ${active 
            ? 'rounded-2xl' 
            : 'rounded-full hover:rounded-2xl'
          }
        `}
        style={{ backgroundColor: color }}
      >
        {server.icon ? (
          server.icon
        ) : (
          <span className="text-white font-semibold text-sm">
            {initials}
          </span>
        )}
      </button>

      {/* Tooltip */}
      <div className="absolute left-full ml-2 px-3 py-2 bg-gray-950 text-white 
                      text-sm font-medium rounded opacity-0 group-hover:opacity-100 
                      pointer-events-none whitespace-nowrap z-50 transition-opacity">
        {server.name}
      </div>
    </div>
  );
}