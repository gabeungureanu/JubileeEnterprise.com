import React from 'react';
import { useAppContext } from '../../../context/AppContext';
import './StatusBar.css';

const StatusBar: React.FC = () => {
  const { networkStatus, syncStatus } = useAppContext();

  const getStatusIcon = () => {
    switch (networkStatus) {
      case 'online':
        return 'cloud_done';
      case 'offline':
        return 'cloud_off';
      case 'checking':
        return 'cloud_sync';
    }
  };

  const getStatusText = () => {
    if (syncStatus.isSyncing) return 'Syncing...';
    if (networkStatus === 'offline') return 'Offline';
    if (syncStatus.pendingOperations > 0)
      return `${syncStatus.pendingOperations} pending`;
    return 'Connected';
  };

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span className={`status-bar__indicator status-bar__indicator--${networkStatus}`}>
          <span className="material-symbols-outlined">{getStatusIcon()}</span>
        </span>
        <span className="status-bar__text">{getStatusText()}</span>
      </div>
      <div className="status-bar__right">
        {syncStatus.lastSyncTime && (
          <span className="status-bar__text">
            Last sync: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
          </span>
        )}
      </div>
    </footer>
  );
};

export default StatusBar;
