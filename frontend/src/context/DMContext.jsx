import { createContext, useContext, useState } from 'react';

const DMContext = createContext(null);

export const useDM = () => useContext(DMContext);

export const DMProvider = ({ children }) => {
  // Yeni sistemde DM'leri tamamen activeDM state'i üzerinden yönetiyoruz
  const [activeDM, setActiveDM] = useState(null);

  return (
    <DMContext.Provider value={{ activeDM, setActiveDM }}>
      {children}
    </DMContext.Provider>
  );
};