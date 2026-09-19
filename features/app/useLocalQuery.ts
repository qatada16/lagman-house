import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSyncStore } from '@/store/syncStore';

// Re-runs a synchronous SQLite query when the screen gains focus or a sync pass lands.
export function useLocalQuery<T>(query: () => T, deps: unknown[] = []): [T, () => void] {
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const [value, setValue] = useState<T>(query);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((x) => x + 1), []);

  useEffect(() => {
    setValue(query());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncAt, pendingCount, tick, ...deps]);

  useFocusEffect(
    useCallback(() => {
      setValue(query());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
  );

  return [value, refresh];
}
