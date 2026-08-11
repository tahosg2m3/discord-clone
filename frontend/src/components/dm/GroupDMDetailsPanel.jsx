import { useEffect, useMemo, useState } from 'react';
import { Crown, LogOut, Save, UserMinus, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  addGroupDMMember,
  fetchFriends,
  fetchUsers,
  leaveGroupDM,
  removeGroupDMMember,
  updateGroupDM,
} from '../../services/api';
import { getColorForString } from '../../utils/colors';
import GroupDMAvatar from './GroupDMAvatar';

function MemberAvatar({ member }) {
  if (member?.avatar && !member.avatar.includes('ui-avatars.com')) {
    return <img src={member.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: getColorForString(member?.username || member?.id || '?') }}>
      {(member?.username || '?')[0].toUpperCase()}
    </div>
  );
}

export default function GroupDMDetailsPanel({ conversation, onClose, onUpdated, onLeft }) {
  const { user } = useAuth();
  const [name, setName] = useState(conversation.name || 'Yeni Grup');
  const [icon, setIcon] = useState(conversation.icon || '');
  const [candidates, setCandidates] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const isOwner = String(conversation.ownerId) === String(user.id);
  const members = Array.isArray(conversation.members) ? conversation.members : [];
  const memberIds = new Set((conversation.memberIds || members.map((member) => member.id)).map(String));

  useEffect(() => {
    setName(conversation.name || 'Yeni Grup');
    setIcon(conversation.icon || '');
  }, [conversation.icon, conversation.name]);

  useEffect(() => {
    if (!isOwner) return undefined;
    let active = true;
    Promise.all([fetchFriends(user.id), fetchUsers()])
      .then(([friends, users]) => {
        if (!active) return;
        const friendIds = new Set((friends || []).map((friend) => String(friend.id)));
        const byId = new Map();
        [...(friends || []), ...(users || [])].forEach((person) => {
          if (!person?.id || String(person.id) === String(user.id)) return;
          byId.set(String(person.id), { ...person, isFriend: friendIds.has(String(person.id)) });
        });
        setCandidates([...byId.values()]);
      })
      .catch(console.error);
    return () => { active = false; };
  }, [isOwner, user.id]);

  const availableCandidates = useMemo(() => candidates
    .filter((candidate) => !memberIds.has(String(candidate.id)))
    .sort((a, b) => Number(b.isFriend) - Number(a.isFriend) || String(a.username).localeCompare(String(b.username), 'tr')),
  [candidates, conversation.memberIds, members]);

  const saveDetails = async () => {
    setSaving(true);
    try {
      const updated = await updateGroupDM(conversation.id, { name: name.trim(), icon: icon.trim() || null });
      onUpdated(updated);
      toast.success('Grup bilgileri güncellendi.');
    } catch (error) {
      toast.error(error.message || 'Grup güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const updated = await addGroupDMMember(conversation.id, selectedUserId);
      onUpdated(updated);
      setSelectedUserId('');
      toast.success('Üye gruba eklendi.');
    } catch (error) {
      toast.error(error.message || 'Üye eklenemedi.');
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`${member.username} gruptan çıkarılsın mı?`)) return;
    try {
      const result = await removeGroupDMMember(conversation.id, member.id);
      if (result.deleted) onLeft();
      else onUpdated(result);
      toast.success('Üye gruptan çıkarıldı.');
    } catch (error) {
      toast.error(error.message || 'Üye çıkarılamadı.');
    }
  };

  const leave = async () => {
    if (!window.confirm('Bu grup mesajından ayrılmak istediğine emin misin?')) return;
    try {
      await leaveGroupDM(conversation.id);
      onLeft();
      toast.success('Grup mesajından ayrıldın.');
    } catch (error) {
      toast.error(error.message || 'Gruptan ayrılamadın.');
    }
  };

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-white/[0.07] bg-[#151b27]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
        <span className="font-semibold text-white">Grup ayrıntıları</span>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#94a3b8] hover:bg-white/[0.08] hover:text-white" aria-label="Kapat"><X className="h-5 w-5" /></button>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center border-b border-white/[0.07] px-4 py-5 text-center">
          <GroupDMAvatar conversation={conversation} size={72} />
          <h2 className="mt-3 max-w-full truncate text-lg font-bold text-white">{conversation.name}</h2>
          <p className="mt-1 text-xs text-[#64748b]">{members.length || conversation.memberIds?.length || 0} üye</p>
        </div>

        {isOwner && (
          <div className="space-y-3 border-b border-white/[0.07] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Grubu düzenle</h3>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Grup adı" className="w-full rounded-lg border border-white/[0.08] bg-[#0f172a] px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]" />
            <input value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="Grup resmi URL’si" className="w-full rounded-lg border border-white/[0.08] bg-[#0f172a] px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]" />
            <button type="button" onClick={saveDetails} disabled={saving || !name.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3b82f6] disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</button>
          </div>
        )}

        {isOwner && conversation.memberIds?.length < 10 && (
          <div className="space-y-2 border-b border-white/[0.07] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Üye ekle</h3>
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-[#0f172a] px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]">
              <option value="">Kullanıcı seç…</option>
              {availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.username}{candidate.isFriend ? ' · arkadaşın' : ''}</option>)}
            </select>
            <button type="button" onClick={addMember} disabled={!selectedUserId || adding} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white hover:bg-white/[0.13] disabled:opacity-50"><UserPlus className="h-4 w-4" />{adding ? 'Ekleniyor…' : 'Gruba ekle'}</button>
          </div>
        )}

        <div className="p-3">
          <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Üyeler — {members.length}</h3>
          <div className="space-y-1">
            {members.map((member) => {
              const owner = String(member.id) === String(conversation.ownerId);
              const self = String(member.id) === String(user.id);
              return (
                <div key={member.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.05]">
                  <MemberAvatar member={member} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium text-[#e2e8f0]">{member.username}{owner && <Crown className="h-3.5 w-3.5 shrink-0 text-[#fbbf24]" />}</span>
                    <span className="block truncate text-[11px] text-[#64748b]">{self ? 'Sen' : owner ? 'Grup sahibi' : member.customStatus || 'Üye'}</span>
                  </span>
                  {isOwner && !self && <button type="button" onClick={() => removeMember(member)} className="rounded-lg p-1.5 text-[#64748b] opacity-0 transition-opacity hover:bg-[#ef4444]/15 hover:text-[#f87171] group-hover:opacity-100" title="Gruptan çıkar"><UserMinus className="h-4 w-4" /></button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.07] p-3">
        <button type="button" onClick={leave} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#f87171] hover:bg-[#ef4444]/12"><LogOut className="h-4 w-4" />Grup mesajından ayrıl</button>
      </div>
    </aside>
  );
}
