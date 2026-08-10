import { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';

const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public test key

export default function GifPicker({ onClose, onSelectGif }) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTrendingGifs();
  }, []);

  useEffect(() => {
    if (search) {
      const timer = setTimeout(() => {
        searchGifs(search);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      loadTrendingGifs();
    }
  }, [search]);

  const loadTrendingGifs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20`
      );
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Failed to load trending GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`
      );
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Failed to search GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGif = (gif) => {
    const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url;
    if (!gifUrl) return;
    onSelectGif({
      url: gifUrl,
      previewUrl: gif.media_formats?.tinygif?.url || gifUrl,
      filename: gif.content_description || 'GIF',
      mimetype: 'image/gif',
      type: 'gif',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="GIF seçici">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#1e293b] shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <h2 className="text-lg font-semibold text-[#f8fafc]">GIF seç</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#94a3b8] transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="GIF ara..."
              className="w-full rounded-xl border border-white/[0.07] bg-[#111827] py-2.5 pl-10 pr-4 text-[#f8fafc] outline-none transition-colors placeholder:text-[#64748b] focus:border-[#3b82f6]"
              autoFocus
            />
          </div>
        </div>

        {/* GIF Grid */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-44 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#60a5fa]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleSelectGif(gif)}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-[#111827] transition-all hover:ring-2 hover:ring-[#60a5fa]"
                >
                  <img
                    src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url}
                    alt={gif.content_description}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-sm font-medium text-white">Seç</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && gifs.length === 0 && (
            <div className="flex h-44 items-center justify-center text-[#94a3b8]">
              <p>GIF bulunamadı.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] p-3 text-center">
          <p className="text-xs text-[#64748b]">Tenor tarafından sağlanır</p>
        </div>
      </div>
    </div>
  );
}
