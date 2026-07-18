// Holds global UI state — currently just the sidebar open/close.
import React, { createContext, useContext, useState } from 'react';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <UIContext.Provider value={{
      sidebarOpen,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false),
    }}>
      {children}
    </UIContext.Provider>
  );
}
