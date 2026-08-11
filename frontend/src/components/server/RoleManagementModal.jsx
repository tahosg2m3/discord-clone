import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Crown,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createServerRole,
  deleteServerRole,
  reorderServerRoles,
  updateServerRole,
  unwrapRoles,
} from './serverManagementApi';

const PERMISSION_GROUPS = [
  {
    title: 'GENEL SUNUCU İZİNLERİ',
    items: [
      ['ADMINISTRATOR', 'Yönetici', 'Tüm izinleri verir. Bu rolü dikkatli kullanın.'],
      ['MANAGE_SERVER', 'Sunucuyu Yönet', 'Sunucu adını ve genel ayarlarını düzenleyebilir.'],
      ['MANAGE_ROLES', 'Rolleri Yönet', 'Roller oluşturabilir, düzenleyebilir ve üyelere verebilir.'],
      ['MANAGE_CHANNELS', 'Kanalları Yönet', 'Metin ve ses kanallarını oluşturabilir veya silebilir.'],
      ['CREATE_INSTANT_INVITE', 'Davet Oluştur', 'Sunucu için davet bağlantısı oluşturabilir.'],
      ['VIEW_AUDIT_LOG', 'Denetim Kaydını Gör', 'Sunucudaki yönetim işlemlerini inceleyebilir.'],
      ['MANAGE_EVENTS', 'Etkinlikleri Yönet', 'Etkinlik oluşturabilir ve düzenleyebilir.'],
      ['MANAGE_WEBHOOKS', 'Webhook’ları Yönet', 'Webhook ve entegrasyonları yönetebilir.'],
      ['MANAGE_EMOJIS_AND_STICKERS', 'Emoji ve Sticker Yönet', 'Sunucu emoji ve sticker’larını yönetebilir.'],
    ],
  },
  {
    title: 'ÜYE YÖNETİMİ',
    items: [
      ['KICK_MEMBERS', 'Üyeleri At', 'Üyeleri sunucudan çıkarabilir.'],
      ['BAN_MEMBERS', 'Üyeleri Yasakla', 'Üyeleri sunucudan kalıcı olarak yasaklayabilir.'],
      ['MODERATE_MEMBERS', 'Üyeleri Sustur', 'Üyelerin metin kanallarına yazmasını geçici olarak engelleyebilir.'],
      ['MANAGE_MESSAGES', 'Mesajları Yönet', 'Başkalarının mesajlarını silebilir.'],
    ],
  },
  {
    title: 'METİN KANALI İZİNLERİ',
    items: [
      ['VIEW_CHANNEL', 'Kanalı Gör', 'İzin verilen kanalları görüntüleyebilir.'],
      ['SEND_MESSAGES', 'Mesaj Gönder', 'Metin kanallarına mesaj gönderebilir.'],
      ['MENTION_EVERYONE', '@everyone Kullan', '@everyone ve rolleri etiketleyebilir.'],
      ['CREATE_PUBLIC_THREADS', 'Mesaj Dizisi Aç', 'Kanallarda herkese açık mesaj dizileri oluşturabilir.'],
      ['SEND_MESSAGES_IN_THREADS', 'Dizilerde Yaz', 'Mesaj dizilerinde mesaj gönderebilir.'],
    ],
  },
  {
    title: 'SESLİ KANAL İZİNLERİ',
    items: [
      ['CONNECT', 'Bağlan', 'Ses kanallarına katılabilir.'],
      ['SPEAK', 'Konuş', 'Ses kanallarında konuşabilir.'],
      ['STREAM', 'Yayın Aç', 'Ses kanalında ekran paylaşımı yapabilir.'],
      ['MUTE_MEMBERS', 'Üyeleri Sustur', 'Ses kanalındaki üyelerin mikrofonunu kapatabilir.'],
      ['DEAFEN_MEMBERS', 'Üyeleri Sağırlaştır', 'Ses kanalındaki üyelerin sesini kapatabilir.'],
      ['MOVE_MEMBERS', 'Üyeleri Kanaldan Çıkar', 'Üyeleri ses kanalından çıkarabilir.'],
    ],
  },
];

const ROLE_COLORS = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#00A8FC', '#9B59B6', '#95A5A6'];

function normalizePermissions(permissions) {
  if (Array.isArray(permissions)) return permissions;
  if (permissions && typeof permissions === 'object') {
    return Object.entries(permissions).filter(([, allowed]) => allowed).map(([permission]) => permission);
  }
  return [];
}

function normalizeRole(response) {
  if (response?.role) return response.role;
  if (Array.isArray(response?.roles)) return response.roles[0];
  return response;
}

function roleInitial(role) {
  return role?.name?.replace('@', '').trim().slice(0, 1).toUpperCase() || 'R';
}

export default function RoleManagementModal({ serverId, actorId, roles = [], onRolesChange, isOwner }) {
  const normalizedRoles = useMemo(() => unwrapRoles(roles), [roles]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stillExists = normalizedRoles.some((role) => role.id === selectedRoleId);
    const nextRole = normalizedRoles.find((role) => role.id === (stillExists ? selectedRoleId : normalizedRoles[0]?.id));
    setSelectedRoleId(nextRole?.id || null);
    setDraft(nextRole ? {
      ...nextRole,
      permissions: normalizePermissions(nextRole.permissions),
    } : null);
  }, [normalizedRoles, selectedRoleId]);

  const selectRole = (role) => {
    setSelectedRoleId(role.id);
    setDraft({ ...role, permissions: normalizePermissions(role.permissions) });
  };

  const replaceRole = (updatedRole) => {
    const nextRoles = normalizedRoles.map((role) => (role.id === updatedRole.id ? updatedRole : role));
    onRolesChange(nextRoles);
    selectRole(updatedRole);
  };

  const handleCreate = async () => {
    if (!isOwner) return;

    setIsSaving(true);
    try {
      const response = await createServerRole(serverId, {
        actorId,
        name: 'yeni-rol',
        color: '#5865F2',
        permissions: [],
        icon: '',
        hoist: false,
        mentionable: false,
      });
      const role = normalizeRole(response);
      if (!role?.id) throw new Error('Rol oluşturulamadı.');

      onRolesChange([...normalizedRoles, role]);
      selectRole(role);
      toast.success('Yeni rol oluşturuldu.');
    } catch (error) {
      toast.error(error.message || 'Rol oluşturulamadı.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !isOwner || !draft.name?.trim()) return;

    setIsSaving(true);
    try {
      const response = await updateServerRole(serverId, draft.id, {
        actorId,
        name: draft.name.trim(),
        color: draft.color || '#99AAB5',
        permissions: normalizePermissions(draft.permissions),
        icon: draft.icon || '',
        hoist: Boolean(draft.hoist),
        mentionable: Boolean(draft.mentionable),
      });
      const updatedRole = normalizeRole(response) || draft;
      replaceRole({ ...draft, ...updatedRole, permissions: normalizePermissions(updatedRole.permissions || draft.permissions) });
      toast.success('Rol kaydedildi.');
    } catch (error) {
      toast.error(error.message || 'Rol kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft || !isOwner || draft.isDefault || draft.managed) return;
    if (!window.confirm(`“${draft.name}” rolünü silmek istediğine emin misin?`)) return;

    setIsSaving(true);
    try {
      await deleteServerRole(serverId, draft.id, actorId);
      const nextRoles = normalizedRoles.filter((role) => role.id !== draft.id);
      onRolesChange(nextRoles);
      setSelectedRoleId(nextRoles[0]?.id || null);
      toast.success('Rol silindi.');
    } catch (error) {
      toast.error(error.message || 'Rol silinemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (key) => {
    setDraft((current) => ({
      ...current,
      permissions: current?.permissions?.includes(key)
        ? current.permissions.filter((permission) => permission !== key)
        : [...(current?.permissions || []), key],
    }));
  };

  const handleMoveRole = async (direction) => {
    if (!draft || !isOwner) return;
    const currentIndex = normalizedRoles.findIndex((role) => role.id === draft.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= normalizedRoles.length) return;

    const nextRoles = [...normalizedRoles];
    [nextRoles[currentIndex], nextRoles[targetIndex]] = [nextRoles[targetIndex], nextRoles[currentIndex]];
    onRolesChange(nextRoles);
    setIsSaving(true);
    try {
      const response = await reorderServerRoles(serverId, nextRoles.map((role) => role.id));
      if (Array.isArray(response?.roles)) onRolesChange(response.roles);
      toast.success('Rol sırası güncellendi.');
    } catch (error) {
      onRolesChange(normalizedRoles);
      toast.error(error.message || 'Rol sırası güncellenemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center text-[#949BA4]">
        <div>
          <Shield className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>Bu sunucuda henüz düzenlenebilir bir rol yok.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-black/30 bg-[#2B2D31] px-2 py-4 custom-scrollbar">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#949BA4]">Roller</span>
          {isOwner && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving}
              title="Rol oluştur"
              className="rounded p-1 text-[#B5BAC1] transition hover:bg-[#404249] hover:text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {normalizedRoles.map((role) => {
            const active = role.id === selectedRoleId;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition ${active ? 'bg-[#404249] text-white' : 'text-[#B5BAC1] hover:bg-[#35373C] hover:text-[#DBDEE1]'}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: role.color || '#99AAB5' }}>
                  {roleInitial(role)}
                </span>
                <span className="min-w-0 flex-1 truncate">{role.name}</span>
                {role.isOwner && <Crown className="h-3.5 w-3.5 shrink-0 text-[#FEE75C]" />}
                {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#949BA4]" />}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto bg-[#313338] px-6 py-7 custom-scrollbar md:px-9">
        <div className="mx-auto max-w-[680px] pb-24">
          <h2 className="text-xl font-bold text-[#F2F3F5]">Rolü Düzenle</h2>
          <p className="mt-1 text-sm text-[#B5BAC1]">Bu rolün adını, rengini ve sunucudaki yetkilerini belirle.</p>

          {isOwner && (
            <div className="mt-5 flex items-center justify-between rounded-lg border border-black/25 bg-[#2B2D31] px-4 py-3">
              <div>
                <span className="block text-sm font-medium text-[#F2F3F5]">Rol sırası</span>
                <span className="mt-0.5 block text-xs text-[#949BA4]">Üstteki roller üyelik listesinde önce görünür.</span>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => handleMoveRole(-1)} disabled={isSaving || normalizedRoles.findIndex((role) => role.id === draft.id) <= 0} title="Rolü yukarı taşı" className="rounded bg-[#1E1F22] p-2 text-[#B5BAC1] transition hover:bg-[#404249] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => handleMoveRole(1)} disabled={isSaving || normalizedRoles.findIndex((role) => role.id === draft.id) >= normalizedRoles.length - 1} title="Rolü aşağı taşı" className="rounded bg-[#1E1F22] p-2 text-[#B5BAC1] transition hover:bg-[#404249] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><ArrowDown className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          <div className="mt-7 rounded-lg border border-black/25 bg-[#2B2D31] p-4">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full border-4 border-[#2B2D31] text-2xl font-bold text-white shadow-lg" style={{ backgroundColor: draft.color || '#99AAB5' }}>
                {draft.icon ? <img src={draft.icon} alt="" className="h-full w-full rounded-full object-cover" /> : roleInitial(draft)}
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-[#B5BAC1]">Rol Adı</label>
                <input
                  value={draft.name || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  disabled={!isOwner || draft.managed}
                  maxLength={32}
                  className="w-full rounded-[3px] border border-transparent bg-[#1E1F22] px-3 py-2.5 text-sm text-[#F2F3F5] outline-none transition focus:border-[#00A8FC] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div className="mt-5">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-[#B5BAC1]">Rol Rengi</span>
              <div className="flex flex-wrap items-center gap-2">
                {ROLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={!isOwner || draft.managed}
                    onClick={() => setDraft((current) => ({ ...current, color }))}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110 disabled:cursor-not-allowed ${draft.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2B2D31]' : ''}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {draft.color === color && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                  </button>
                ))}
                <label className="relative ml-1 flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[#4E5058] bg-[#1E1F22] text-xs text-[#B5BAC1]" title="Özel renk">
                  <span>+</span>
                  <input
                    type="color"
                    value={draft.color || '#99AAB5'}
                    disabled={!isOwner || draft.managed}
                    onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
            <label className="mt-5 block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-[#B5BAC1]">Rol ikonu bağlantısı</span><input value={draft.icon || ''} onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))} disabled={!isOwner || draft.managed} placeholder="https://ornek.com/rol-ikonu.png" className="w-full rounded-[3px] border border-transparent bg-[#1E1F22] px-3 py-2.5 text-sm text-[#F2F3F5] outline-none transition focus:border-[#00A8FC] disabled:opacity-60" /></label>
            <div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="flex items-center justify-between rounded-lg bg-[#1E1F22] px-3 py-2.5 text-sm text-[#B5BAC1]"><span>Üyeleri ayrı göster</span><input type="checkbox" checked={Boolean(draft.hoist)} onChange={(event) => setDraft((current) => ({ ...current, hoist: event.target.checked }))} disabled={!isOwner || draft.managed} /></label><label className="flex items-center justify-between rounded-lg bg-[#1E1F22] px-3 py-2.5 text-sm text-[#B5BAC1]"><span>Herkes bu rolü etiketleyebilir</span><input type="checkbox" checked={Boolean(draft.mentionable)} onChange={(event) => setDraft((current) => ({ ...current, mentionable: event.target.checked }))} disabled={!isOwner || draft.managed} /></label></div>
          </div>

          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="mt-8">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#F2F3F5]">{group.title}</h3>
              <div className="overflow-hidden rounded-lg border border-black/25 bg-[#2B2D31]">
                {group.items.map(([key, label, description], index) => {
                  const enabled = draft.permissions?.includes(key);
                  const disabled = !isOwner || draft.managed;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => togglePermission(key)}
                      className={`flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-[#35373C] disabled:cursor-not-allowed disabled:hover:bg-transparent ${index ? 'border-t border-black/20' : ''}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${enabled ? 'bg-[#5865F2]/20 text-[#8EA1E1]' : 'bg-[#1E1F22] text-[#949BA4]'}`}>
                        {['CONNECT', 'SPEAK', 'STREAM', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS'].includes(key) ? <Users className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[#F2F3F5]">{label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[#949BA4]">{description}</span>
                      </span>
                      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-[#5865F2]' : 'bg-[#4E5058]'}`}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between border-t border-black/30 bg-[#232428] px-5 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.18)]">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving || draft.isDefault || draft.managed}
            className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-[#F23F42] transition hover:bg-[#F23F42]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Rolü Sil
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !draft.name?.trim()}
            className="rounded bg-[#23A559] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D8046] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
