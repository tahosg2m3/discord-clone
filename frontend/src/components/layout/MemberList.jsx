import { useCallback, useEffect, useState } from 'react';
import { MicOff, Shield, VolumeX } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useSocket } from '../../context/SocketContext';
import { fetchServerMembers } from '../../services/api';
import { getColorForString } from '../../utils/colors';
import UserPopover from '../profile/UserPopover';

function sortMembers(members) {
  return [...members].sort((first, second) => {
    if (first.status !== second.status) {
      return first.status === 'online' ? -1 : 1;
    }

    return first.username.localeCompare(second.username, 'tr');
  });
}

export default function MemberList() {
  const { currentServer } = useServer();
  const { socket, isPresenceReady } = useSocket();
  const [members, setMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const loadMembers = useCallback(() => {
    if (!currentServer?.id) return;
    fetchServerMembers(currentServer.id)
      .then(data => setMembers(sortMembers(data)))
      .catch(console.error);
  }, [currentServer?.id]);

  useEffect(() => {
    if (!currentServer?.id || !isPresenceReady) return;

    loadMembers();
  }, [currentServer?.id, isPresenceReady, loadMembers]);

  useEffect(() => {
    if (!socket) return undefined;

    const handlePresence = ({ userId, status, serverId }) => {
      if (serverId && serverId !== currentServer?.id) return;

      setMembers(previousMembers => sortMembers(
        previousMembers.map(member => (
          member.id === userId ? { ...member, status } : member
        )),
      ));
    };

    socket.on('presence:update', handlePresence);

    const refreshMembers = ({ serverId }) => {
      if (!serverId || serverId === currentServer?.id) loadMembers();
    };
    socket.on('server:members-changed', refreshMembers);
    socket.on('server:member-updated', refreshMembers);
    socket.on('roles:changed', refreshMembers);

    return () => {
      socket.off('presence:update', handlePresence);
      socket.off('server:members-changed', refreshMembers);
      socket.off('server:member-updated', refreshMembers);
      socket.off('roles:changed', refreshMembers);
    };
  }, [socket, currentServer?.id, loadMembers]);

  if (!currentServer) return null;

  const onlineMembers = members.filter(member => member.status === 'online');
  const offlineMembers = members.filter(member => member.status !== 'online');

  const renderGroup = (title, group, online) => {
    if (!group.length) return null;

    return (
      <section className="mb-5">
        <h3 className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">
          {title} — {group.length}
        </h3>

        <div className="space-y-0.5">
          {group.map(member => (
            <button
              type="button"
              key={member.id}
              onClick={() => setSelectedUser(member)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <div className="relative shrink-0">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-bold text-white ${online ? '' : 'grayscale opacity-55'}`}
                  style={{ backgroundColor: getColorForString(member.username) }}
                >
                  {member.username?.[0]?.toUpperCase() || '?'}
                </div>

                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[3px] border-[#151b27] ${online ? 'bg-[#34d399]' : 'bg-[#64748b]'}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  {member.isOwner && <Shield className="h-3.5 w-3.5 shrink-0 text-[#fbbf24]" title="Sunucu sahibi" />}
                  <div className={`truncate text-[14px] font-medium ${online ? 'text-[#e2e8f0]' : 'text-[#718096]'}`}>
                    {member.username}
                  </div>
                  {member.serverMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-[#fb7185]" title="Sunucu tarafından susturuldu" />}
                  {member.serverDeafened && <VolumeX className="h-3.5 w-3.5 shrink-0 text-[#fb7185]" title="Sunucu tarafından sağırlaştırıldı" />}
                </div>
                {(member.roles || []).filter(role => !role.isDefault).slice(0, 2).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(member.roles || []).filter(role => !role.isDefault).slice(0, 2).map(role => (
                      <span key={role.id} className="max-w-[92px] truncate rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: `${role.color || '#64748b'}22`, color: role.color || '#cbd5e1' }}>
                        {role.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className={`text-[11px] ${online ? 'text-[#34d399]' : 'text-[#64748b]'}`}>
                  {online ? 'Çevrimiçi' : 'Çevrimdışı'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  };

  return (
    <>
      {selectedUser && (
        <UserPopover
          targetUser={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}

      <aside className="flex h-full w-[256px] flex-col overflow-y-auto border-l border-white/[0.06] bg-[#151b27] custom-scrollbar">
        <div className="px-3 py-4">
          <div className="mb-4 flex items-center justify-between px-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">
              Üyeler
            </h2>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[#cbd5e1]">
              {members.length}
            </span>
          </div>

          {renderGroup('Çevrimiçi', onlineMembers, true)}
          {renderGroup('Çevrimdışı', offlineMembers, false)}
        </div>
      </aside>
    </>
  );
}
