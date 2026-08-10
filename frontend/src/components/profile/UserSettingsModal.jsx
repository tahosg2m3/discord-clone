import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Lock, Mail, RotateCcw, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getColorForString } from '../../utils/colors';

const API_URL = 'http://localhost:3001/api';

async function authenticatedRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('chat_token')}`,
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || 'İşlem gerçekleştirilemedi.');
  return payload;
}

export default function UserSettingsModal({ onClose }) {
  const { user, updateUserData } = useAuth();
  const initialAvatar = user.avatar && !user.avatar.includes('ui-avatars') ? user.avatar : '';
  const [username, setUsername] = useState(user.username || '');
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [isSaving, setIsSaving] = useState(false);
  const [newEmail, setNewEmail] = useState(user.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailChangeTicket, setEmailChangeTicket] = useState(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const avatarColor = getColorForString(username || user.username || 'U');
  const initial = (username || user.username || '?').slice(0, 1).toUpperCase();
  const isVerifyingEmail = Boolean(emailChangeTicket);

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      toast.error('Kullanıcı adı boş olamaz.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await authenticatedRequest(`/auth/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ username: username.trim(), avatar: avatarUrl.trim() }),
      });
      updateUserData(updatedUser);
      toast.success('Profilin güncellendi.');
    } catch (error) {
      toast.error(error.message || 'Profil güncellenirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestEmailChange = async (event) => {
    event.preventDefault();
    if (!newEmail.trim() || !currentPassword) {
      toast.error('Yeni e-posta adresini ve mevcut şifreni gir.');
      return;
    }

    setIsEmailLoading(true);
    try {
      const result = await authenticatedRequest('/auth/request-email-change', {
        method: 'POST',
        body: JSON.stringify({ newEmail: newEmail.trim(), currentPassword }),
      });
      setEmailChangeTicket(result.emailChangeTicket);
      setEmailCode('');
      toast.success('Doğrulama kodu yeni e-posta adresine gönderildi.');
    } catch (error) {
      toast.error(error.message || 'Doğrulama e-postası gönderilemedi.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleConfirmEmailChange = async (event) => {
    event.preventDefault();
    if (emailCode.trim().length !== 6) {
      toast.error('E-postandaki 6 haneli kodu gir.');
      return;
    }

    setIsEmailLoading(true);
    try {
      const result = await authenticatedRequest('/auth/confirm-email-change', {
        method: 'POST',
        body: JSON.stringify({ emailChangeTicket, code: emailCode.trim() }),
      });
      updateUserData(result.user);
      setNewEmail(result.user.email);
      setCurrentPassword('');
      setEmailCode('');
      setEmailChangeTicket(null);
      toast.success('E-posta adresin güncellendi.');
    } catch (error) {
      toast.error(error.message || 'Kod doğrulanamadı.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleResendEmailCode = async () => {
    setIsEmailLoading(true);
    try {
      await authenticatedRequest('/auth/resend-email-change', {
        method: 'POST',
        body: JSON.stringify({ emailChangeTicket }),
      });
      toast.success('Yeni doğrulama kodu gönderildi.');
    } catch (error) {
      toast.error(error.message || 'Kod tekrar gönderilemedi.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const cancelEmailChange = () => {
    setEmailChangeTicket(null);
    setEmailCode('');
    setCurrentPassword('');
    setNewEmail(user.email || '');
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[#1E1F22] bg-[#313338] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#1E1F22] bg-[#2B2D31] px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-[#F2F3F5]">Hesabım</h2>
            <p className="mt-0.5 text-xs text-[#949BA4]">Profilini ve giriş bilgilerini yönet.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full p-1 text-[#949BA4] transition hover:bg-[#1E1F22] hover:text-[#DBDEE1]"><X className="h-6 w-6" /></button>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[#313338] p-6">
          <section className="relative mb-8 mt-12 overflow-visible rounded-lg border border-[#1E1F22] bg-[#2B2D31]">
            <div className="h-[60px] rounded-t-lg bg-gradient-to-r from-[#5865F2] to-[#9256EA]" />
            <div className="absolute left-4 top-4 flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-full border-[6px] border-[#2B2D31] text-4xl font-bold text-white shadow-sm" style={{ backgroundColor: avatarUrl ? 'transparent' : avatarColor }}>
              {avatarUrl ? <img src={avatarUrl} alt="Profil resmi" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : initial}
            </div>
            <div className="px-6 pb-6 pt-16">
              <h3 className="text-[20px] font-bold text-[#F2F3F5]">{username || user.username}</h3>
              <p className="text-[14px] text-[#949BA4]">{user.email}</p>
            </div>
          </section>

          <section className="rounded-lg border border-[#1E1F22] bg-[#2B2D31] p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#F2F3F5]">Profil</h3>
            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-[#B5BAC1]">Kullanıcı adı <span className="text-[#DA373C]">*</span></span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={50} className="w-full rounded-[3px] border border-transparent bg-[#1E1F22] px-3 py-2.5 text-sm text-[#DBDEE1] outline-none transition focus:border-[#00A8FC]" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-[#B5BAC1]">Profil resmi bağlantısı</span>
                <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://ornek.com/resim.jpg" className="w-full rounded-[3px] border border-transparent bg-[#1E1F22] px-3 py-2.5 text-sm text-[#DBDEE1] outline-none transition placeholder:text-[#5C5E66] focus:border-[#00A8FC]" />
                <span className="mt-2 block text-xs leading-5 text-[#949BA4]">İstersen internetteki bir resmin URL’sini yapıştırabilirsin.</span>
              </label>
              <div className="flex justify-end"><button type="button" onClick={handleSaveProfile} disabled={isSaving} className="rounded bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Kaydediliyor…' : 'Profili Kaydet'}</button></div>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-[#1E1F22] bg-[#2B2D31] p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/15 text-[#8EA1E1]"><Mail className="h-4 w-4" /></span>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#F2F3F5]">E-posta Adresi</h3>
                <p className="mt-1 text-xs leading-5 text-[#949BA4]">E-posta değişikliği yeni adresine gönderilen 6 haneli kodla doğrulanır.</p>
              </div>
            </div>

            {!isVerifyingEmail ? (
              <form className="mt-5 space-y-4" onSubmit={handleRequestEmailChange}>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase text-[#B5BAC1]">Yeni e-posta adresi</span>
                  <input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} autoComplete="email" placeholder="ornek@mail.com" className="w-full rounded-[3px] border border-transparent bg-[#1E1F22] px-3 py-2.5 text-sm text-[#DBDEE1] outline-none transition placeholder:text-[#5C5E66] focus:border-[#00A8FC]" />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-[#B5BAC1]"><Lock className="h-3.5 w-3.5" /> Mevcut şifre</span>
                  <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder="Şifreni doğrulamak için gir" className="w-full rounded-[3px] border border-transparent bg-[#1E1F22] px-3 py-2.5 text-sm text-[#DBDEE1] outline-none transition placeholder:text-[#5C5E66] focus:border-[#00A8FC]" />
                </label>
                <div className="flex justify-end"><button type="submit" disabled={isEmailLoading || !newEmail.trim() || !currentPassword} className="rounded bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-50">{isEmailLoading ? 'Kod gönderiliyor…' : 'Doğrulama Kodu Gönder'}</button></div>
              </form>
            ) : (
              <form className="mt-5" onSubmit={handleConfirmEmailChange}>
                <div className="rounded-md border border-[#23A559]/30 bg-[#23A559]/10 p-3 text-sm text-[#C4F1D1]">
                  <Shield className="mr-2 inline h-4 w-4" /> Kod <strong>{newEmail}</strong> adresine gönderildi. Kod 10 dakika geçerlidir.
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-bold uppercase text-[#B5BAC1]">6 haneli doğrulama kodu</span>
                  <input value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="w-full rounded-[3px] border border-transparent bg-[#1E1F22] px-3 py-3 text-center font-mono text-lg tracking-[0.35em] text-[#F2F3F5] outline-none transition placeholder:tracking-[0.25em] placeholder:text-[#5C5E66] focus:border-[#00A8FC]" />
                </label>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <button type="button" onClick={cancelEmailChange} disabled={isEmailLoading} className="flex items-center gap-1.5 rounded px-2 py-2 text-sm text-[#B5BAC1] transition hover:bg-[#35373C] hover:text-white"><ArrowLeft className="h-4 w-4" /> Vazgeç</button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleResendEmailCode} disabled={isEmailLoading} className="flex items-center gap-1.5 rounded px-2 py-2 text-sm text-[#B5BAC1] transition hover:bg-[#35373C] hover:text-white disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> Tekrar gönder</button>
                    <button type="submit" disabled={isEmailLoading || emailCode.length !== 6} className="flex items-center gap-1.5 rounded bg-[#23A559] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1D8046] disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" /> {isEmailLoading ? 'Doğrulanıyor…' : 'Doğrula'}</button>
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>

        <footer className="flex justify-end border-t border-[#1E1F22] bg-[#2B2D31] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm font-medium text-[#F2F3F5] transition hover:bg-[#35373C]">Kapat</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
