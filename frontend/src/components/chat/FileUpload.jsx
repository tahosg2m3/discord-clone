import { Paperclip, Image as ImageIcon, File, Loader2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

export default function FileUpload({ onFileSelect, disabled = false }) {
  const [showMenu, setShowMenu] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu en fazla 10 MB olabilir.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);

    try {
      const token = localStorage.getItem('chat_token');
      const response = await fetch(`${API_ORIGIN}/api/upload/file`, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Dosya yüklenemedi.');

      onFileSelect({
        ...data,
        url: data.url?.startsWith('http') ? data.url : `${API_ORIGIN}${data.url}`,
        type: data.mimetype?.startsWith('image/') ? 'image' : 'file',
      });
      setShowMenu(false);
      toast.success('Dosya mesaja eklendi.');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error(error.message || 'Dosya yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu((open) => !open)}
        disabled={disabled || uploading}
        aria-label="Dosya ekle"
        title="Dosya ekle"
        className="rounded-lg p-1.5 text-[#B5BAC1] transition-colors hover:bg-white/[0.08] hover:text-[#DBDEE1] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-0 z-50 mb-3 w-52 rounded-xl border border-white/[0.09] bg-[#1e293b] p-1.5 shadow-2xl shadow-black/40">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[#DBDEE1] transition-colors hover:bg-white/[0.08]">
            <ImageIcon className="h-4 w-4 text-[#60a5fa]" />
            <span>Görsel yükle</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[#DBDEE1] transition-colors hover:bg-white/[0.08]">
            <File className="h-4 w-4 text-[#34d399]" />
            <span>Dosya yükle</span>
            <input
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  );
}
