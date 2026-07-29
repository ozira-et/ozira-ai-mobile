// Holds global UI state — currently just the sidebar open/close.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar = useCallback(() => {
    Keyboard.dismiss();
    setSidebarOpen(true);
  }, []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const value = useMemo(() => ({
    sidebarOpen,
    openSidebar,
    closeSidebar,
  }), [sidebarOpen, openSidebar, closeSidebar]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}
