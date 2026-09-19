import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runSync, loadSyncState } from './syncEngine';
import { useSyncStore } from '@/store/syncStore';

export const BACKGROUND_SYNC_TASK = 'lagman-house-sync';
const FOUR_HOURS_MIN = 240;
const FOREGROUND_INTERVAL_MS = 15 * 60 * 1000;

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await runSync('background');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

let started = false;
let unsubscribeNet: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
let wasOnline = true;

export async function startSyncScheduler() {
  if (started) return;
  started = true;
  loadSyncState();

  unsubscribeNet = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    useSyncStore.getState().set({ online, status: online ? useSyncStore.getState().status : 'offline' });
    if (online && !wasOnline) void runSync('connectivity');
    wasOnline = online;
  });

  appStateSub = AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') void runSync('foreground');
  });

  interval = setInterval(() => void runSync('interval'), FOREGROUND_INTERVAL_MS);

  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Available) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: FOUR_HOURS_MIN });
    }
  } catch (e) {
    console.warn('[sync] background task registration failed', (e as Error).message);
  }

  void runSync('app-open');
}

export function stopSyncScheduler() {
  unsubscribeNet?.();
  appStateSub?.remove();
  if (interval) clearInterval(interval);
  started = false;
}
