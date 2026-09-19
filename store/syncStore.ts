import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  online: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  lastError: string | null;
  set: (patch: Partial<SyncState>) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  online: true,
  lastSyncAt: null,
  pendingCount: 0,
  lastError: null,
  set: (patch) => set(patch),
}));
