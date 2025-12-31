import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

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
    const gifUrl = gif.media_formats.gif.url;
    onSelectGif(gifUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Select a GIF</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for GIFs..."
              className="w-full bg-gray-900 text-white pl-10 pr-4 py-2 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleSelectGif(gif)}
                  className="relative aspect-square rounded-lg overflow-hidden 
                           hover:ring-2 hover:ring-blue-500 transition-all group"
                >
                  <img
                    src={gif.media_formats.tinygif.url}
                    alt={gif.content_description}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                               transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Select</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && gifs.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No GIFs found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 text-center">
          <p className="text-xs text-gray-500">Powered by Tenor</p>
        </div>
      </div>
    </div>
  );
}