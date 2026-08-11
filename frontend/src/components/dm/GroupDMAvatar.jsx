import { Users } from 'lucide-react';
import { getColorForString } from '../../utils/colors';

export default function GroupDMAvatar({ conversation, size = 36, className = '' }) {
  const name = conversation?.name || 'Grup';
  const icon = conversation?.icon;

  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white ${className}`}
      style={{ width: size, height: size, backgroundColor: getColorForString(name) }}
      aria-hidden="true"
    >
      <Users style={{ width: Math.max(15, size * 0.48), height: Math.max(15, size * 0.48) }} />
    </div>
  );
}
