import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppModule, NetworkStatus, SyncStatus } from '../types/common';

interface AppState {
  activeModule: AppModule;
  isFolderPaneVisible: boolean;
  networkStatus: NetworkStatus;
  syncStatus: SyncStatus;
}

interface AppContextValue extends AppState {
  setActiveModule: (module: AppModule) => void;
  toggleFolderPane: () => void;
  setNetworkStatus: (status: NetworkStatus) => void;
  setSyncStatus: (status: SyncStatus) => void;
}

const initialState: AppState = {
  activeModule: 'mail',
  isFolderPaneVisible: true,
  networkStatus: 'online',
  syncStatus: {
    lastSyncTime: null,
    isSyncing: false,
    pendingOperations: 0,
  },
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  const setActiveModule = useCallback((module: AppModule) => {
    setState((prev) => ({ ...prev, activeModule: module }));
  }, []);

  const toggleFolderPane = useCallback(() => {
    setState((prev) => ({ ...prev, isFolderPaneVisible: !prev.isFolderPaneVisible }));
  }, []);

  const setNetworkStatus = useCallback((networkStatus: NetworkStatus) => {
    setState((prev) => ({ ...prev, networkStatus }));
  }, []);

  const setSyncStatus = useCallback((syncStatus: SyncStatus) => {
    setState((prev) => ({ ...prev, syncStatus }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setActiveModule,
        toggleFolderPane,
        setNetworkStatus,
        setSyncStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
