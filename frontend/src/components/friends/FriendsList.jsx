import { useState } from 'react';
import { useFriends } from '../../context/FriendsContext';
import { useDM } from '../../context/DMContext';
import { Users, UserPlus, MessageCircle, UserMinus, Check, X } from 'lucide-react';
import { getColorForString } from '../../utils/colors';

export default function FriendsList() {
  const { friends, pendingRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend } = useFriends();
  const { startConversation } = useDM();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all, pending, add

  const handleSearchUser = async () => {
    if (!searchUsername.trim()) return;

    try {
      const response = await fetch('http://localhost:3001/api/users');
      const users = await response.json();
      const found = users.find(u => u.username.toLowerCase() === searchUsername.toLowerCase());
      
      if (found) {
        setSearchResult(found);
      } else {
        setSearchResult({ notFound: true });
      }
    } catch (error) {
      console.error('Failed to search user:', error);
    }
  };

  const handleAddFriend = async () => {
    if (!searchResult || searchResult.notFound) return;

    try {
      await sendFriendRequest(searchResult.id);
      alert('Friend request sent!');
      setSearchUsername('');
      setSearchResult(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleStartDM = async (friendId) => {
    await startConversation(friendId);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-700">
      <div className="border-b border-gray-800">
        <div className="flex items-center space-x-4 px-4 py-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded ${activeTab === 'all' ? 'bg-gray-600' : 'hover:bg-gray-650'}`}
          >
            All Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1 rounded ${activeTab === 'pending' ? 'bg-gray-600' : 'hover:bg-gray-650'}`}
          >
            Pending ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-1 rounded bg-green-600 hover:bg-green-700 flex items-center space-x-2`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Friend</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'all' && (
          <div className="space-y-2">
            {friends.map(friend => {
              const color = getColorForString(friend.username);
              const initial = friend.username[0].toUpperCase();

              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: color }}
                      >
                        {initial}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-gray-800 ${
                        friend.status === 'online' ? 'bg-green-500' :
                        friend.status === 'dnd' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`} />
                    </div>
                    <div>
                      <div className="text-white font-medium">{friend.username}</div>
                      <div className="text-sm text-gray-400 capitalize">{friend.status || 'Offline'}</div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStartDM(friend.id)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      title="Send Message"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => removeFriend(friend.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      title="Remove Friend"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {friends.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No friends yet. Add some friends to get started!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-2">
            {pendingRequests.map(request => {
              const color = getColorForString(request.fromUser.username);
              const initial = request.fromUser.username[0].toUpperCase();

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: color }}
                    >
                      {initial}
                    </div>
                    <div className="text-white font-medium">{request.fromUser.username}</div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => acceptFriendRequest(request.id)}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      title="Accept"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => rejectFriendRequest(request.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      title="Reject"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {pendingRequests.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <p>No pending friend requests</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-white font-semibold mb-4">Add Friend</h3>
              
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  placeholder="Enter username"
                  className="flex-1 bg-gray-900 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                />
                <button
                  onClick={handleSearchUser}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Search
                </button>
              </div>

              {searchResult && (
                <div className="mt-4">
                  {searchResult.notFound ? (
                    <p className="text-red-500">User not found</p>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                      <span className="text-white">{searchResult.username}</span>
                      <button
                        onClick={handleAddFriend}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        Add Friend
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
