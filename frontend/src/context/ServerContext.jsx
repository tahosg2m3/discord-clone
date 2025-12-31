import { createContext, useContext, useState } from 'react';

const ServerContext = createContext(null);

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) throw new Error('useServer must be used within ServerProvider');
  return context;
};

export const ServerProvider = ({ children }) => {
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [currentChannel, setCurrentChannel] = useState(null);

  return (
    <ServerContext.Provider
      value={{
        servers,
        setServers,
        currentServer,
        setCurrentServer,
        currentChannel,
        setCurrentChannel,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};