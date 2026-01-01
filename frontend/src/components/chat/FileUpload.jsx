import { Paperclip, Image as ImageIcon, File } from 'lucide-react';
import { useState } from 'react';

export default function FileUpload({ onFileSelect }) {
  const [showMenu, setShowMenu] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/api/upload/file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      onFileSelect(data);
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-0 mb-2 bg-gray-900 rounded-lg shadow-lg p-2 space-y-1">
          <label className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer">
            <ImageIcon className="w-4 h-4 text-blue-500" />
            <span className="text-sm">Upload Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <label className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer">
            <File className="w-4 h-4 text-green-500" />
            <span className="text-sm">Upload File</span>
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