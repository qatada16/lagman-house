import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useSyncStore } from '@/store/syncStore';
import type { AppRelease } from '@/lib/types';

const RECHECK_MS = 30 * 60 * 1000;
const SNOOZE_MS = 6 * 60 * 60 * 1000;

export function compareVersions(a: string, b: string) {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface InstalledVersion {
  version: string;
  build: number;
}

export function installedVersion(): InstalledVersion {
  const version = Application.nativeApplicationVersion || Constants.expoConfig?.version || '0.0.0';
  const build = parseInt(Application.nativeBuildVersion ?? '', 10);
  return { version, build: Number.isFinite(build) ? build : 0 };
}

export function formatInstalledVersion(v: InstalledVersion = installedVersion()) {
  return v.build > 0 ? `${v.version} (${v.build})` : v.version;
}

export function isNewer(release: Pick<AppRelease, 'version' | 'build_number'>, installed: InstalledVersion) {
  const byVersion = compareVersions(release.version, installed.version);
  if (byVersion !== 0) return byVersion > 0;
  return installed.build > 0 && (release.build_number ?? 0) > installed.build;
}

export function isSafeDownloadUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\/[^\s]+$/i.test(url);
}

const releaseKey = (r: AppRelease) => `${r.version}+${r.build_number}`;
let snoozed: { key: string; until: number } | null = null;

export function useUpdateCheck() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const lastCheck = useRef(0);
  const checking = useRef(false);
  const online = useSyncStore((s) => s.online);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const installed = installedVersion();
      const { data, error } = await supabase.rpc('latest_release', { p_version: installed.version, p_build: installed.build });
      if (error) return;
      lastCheck.current = Date.now();
      const latest = (data ?? null) as AppRelease | null;
      if (!latest || !isNewer(latest, installed) || !isSafeDownloadUrl(latest.apk_url)) {
        setRelease(null);
        return;
      }
      if (!latest.mandatory && snoozed && snoozed.key === releaseKey(latest) && snoozed.until > Date.now()) return;
      setRelease(latest);
    } catch {
      return;
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheck.current >= RECHECK_MS) void check();
    });
    return () => sub.remove();
  }, [check]);

  useEffect(() => {
    if (online && lastCheck.current === 0) void check();
  }, [online, check]);

  const dismiss = useCallback(() => {
    setRelease((current) => {
      if (current && !current.mandatory) snoozed = { key: releaseKey(current), until: Date.now() + SNOOZE_MS };
      return current?.mandatory ? current : null;
    });
  }, []);

  const opened = useCallback(() => {
    setRelease((current) => (current?.mandatory ? current : null));
  }, []);

  return { release, dismiss, opened };
}
