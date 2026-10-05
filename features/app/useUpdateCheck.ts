import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { AppRelease } from '@/lib/types';

const DISMISSED_KEY = 'lh.update_dismissed_version';

export function compareVersions(a: string, b: string) {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function currentVersion() {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export function useUpdateCheck() {
  const [release, setRelease] = useState<AppRelease | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('latest_release');
      if (error || !data || cancelled) return;
      const latest = data as AppRelease;
      if (compareVersions(latest.version, currentVersion()) <= 0) return;
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      if (!latest.mandatory && dismissed === latest.version) return;
      if (!cancelled) setRelease(latest);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    if (release) await AsyncStorage.setItem(DISMISSED_KEY, release.version).catch(() => undefined);
    setRelease(null);
  };

  return { release, dismiss };
}
