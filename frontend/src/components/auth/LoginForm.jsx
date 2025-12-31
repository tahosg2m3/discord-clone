import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare } from 'lucide-react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      await login(username.trim());
    } catch (err) {
      setError('Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
      <div className="flex items-center justify-center mb-6">
        <MessageSquare className="w-12 h-12 text-blue-500" />
      </div>
      
      <h1 className="text-2xl font-bold text-center text-white mb-2">
        Welcome to ChatApp
      </h1>
      <p className="text-gray-400 text-center mb-6">
        Enter your username to start chatting
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-gray-900 text-white px-4 py-3 rounded 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={20}
            disabled={loading}
            autoFocus
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500 
                         rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                   text-white font-semibold py-3 rounded transition-colors"
        >
          {loading ? 'Logging in...' : 'Continue'}
        </button>
      </form>

      <p className="text-xs text-gray-500 text-center mt-4">
        No password required - this is a demo app
      </p>
    </div>
  );
}
