import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/store/authStore';
import { usePrinterStore } from '@/store/printerStore';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { startSyncScheduler, stopSyncScheduler } from '@/features/sync/scheduler';
import { runSync } from '@/features/sync/syncEngine';
import { addNotificationListeners, consumeLaunchResponse, registerForPush, type PushData } from '@/features/notifications/push';
import { toast } from '@/store/toastStore';
import { translate } from '@/lib/i18n';
import { isResetUrl, sessionFromUrl } from '@/features/auth/authApi';
import { beginRecovery } from '@/features/auth/recovery';
import { useLanguageStore } from '@/store/languageStore';
import { useSyncStore } from '@/store/syncStore';
import { requestUpdateCheck } from '@/features/app/useUpdateCheck';

let launchHandled = false;

// Starts background services once the user is signed in; tears them down on sign-out.
export function useAppServices() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const router = useRouter();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    usePrinterStore.getState().init();
  }, []);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (useSyncStore.getState().online !== online) useSyncStore.getState().set({ online });
    });
  }, []);

  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      if (isResetUrl(url)) {
        await beginRecovery(url);
        return;
      }
      const result = await sessionFromUrl(url);
      const lang = useLanguageStore.getState().lang;
      if (result === 'error') toast.error(translate(lang, 'wrongCode'));
      if (result === 'session') toast.success(translate(lang, 'emailConfirmed'));
    };
    Linking.getInitialURL().then(handle).catch(() => undefined);
    const sub = Linking.addEventListener('url', (e) => void handle(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (status !== 'signedIn' || !profile) {
      stopSyncScheduler();
      useCustomerOrderStore.getState().stop();
      registeredFor.current = null;
      return;
    }
    void startSyncScheduler();
    if (registeredFor.current !== profile.id) {
      registeredFor.current = profile.id;
      void registerForPush(profile.id, profile.push_token);
    }
    const tenant = profile.role === 'admin' ? profile.id : profile.admin_id;
    if (profile.status === 'active' && tenant) void useCustomerOrderStore.getState().start(tenant);
    else useCustomerOrderStore.getState().stop();
  }, [status, profile?.id, profile?.role, profile?.status]);

  const handleResponse = useCallback(
    (data: PushData) => {
      const p = useAuthStore.getState().profile;
      if (!p) return;
      if (data.type === 'cashier_request' && p.role === 'admin') router.push('/(admin)/cashiers');
      if (data.type === 'customer_order' && p.status === 'active') {
        const base = p.role === 'admin' ? '/(admin)/queue' : '/(cashier)/queue';
        router.push((data.id ? `${base}/${data.id}` : base) as never);
      }
      if (data.type === 'order_change' && p.role === 'admin') router.push('/(admin)/orders');
      if (data.type === 'app_update') requestUpdateCheck();
    },
    [router]
  );

  useEffect(() => {
    if (status !== 'signedIn' || !profile || launchHandled) return;
    launchHandled = true;
    void consumeLaunchResponse().then((data) => {
      if (data) setTimeout(() => handleResponse(data), 400);
    });
  }, [status, profile, handleResponse]);

  useEffect(() => {
    return addNotificationListeners({
      onReceived: (data, title, body) => {
        const lang = useLanguageStore.getState().lang;
        if (data.type === 'customer_order') void useCustomerOrderStore.getState().refresh();
        if (data.type === 'cashier_request') void runSync('push');
        if (data.type === 'status_change') void useAuthStore.getState().refreshProfile();
        if (data.type === 'order_change') void runSync('push');
        if (data.type === 'app_update') requestUpdateCheck();
        if (data.type === 'customer_order') return;
        toast.info(title && body ? `${title}: ${body}` : title ?? body ?? translate(lang, 'success'));
      },
      onResponse: handleResponse,
    });
  }, [handleResponse]);
}
