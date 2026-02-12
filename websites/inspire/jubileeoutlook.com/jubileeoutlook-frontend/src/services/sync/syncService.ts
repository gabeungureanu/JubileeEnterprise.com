import { SyncStatus } from '../../types/common';

type SyncListener = (status: SyncStatus) => void;

class SyncService {
  private listeners: SyncListener[] = [];
  private status: SyncStatus = {
    lastSyncTime: null,
    isSyncing: false,
    pendingOperations: 0,
  };

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.getStatus()));
  }

  async startSync(): Promise<void> {
    this.status.isSyncing = true;
    this.notify();

    try {
      // Sync operations will be implemented per module
      this.status.lastSyncTime = new Date();
      this.status.pendingOperations = 0;
    } finally {
      this.status.isSyncing = false;
      this.notify();
    }
  }

  addPendingOperation(): void {
    this.status.pendingOperations++;
    this.notify();
  }
}

export const syncService = new SyncService();
