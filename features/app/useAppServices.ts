import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuthStore } from '@/store/authStore';
import { usePrinterStore } from '@/store/printerStore';
import { useCustomerOrderStore } from '@/store/customerOrderStore';
import { startSyncScheduler, stopSyncScheduler } from '@/features/sync/scheduler';
import { runSync } from '@/features/sync/syncEngine';
import { addNotificationListeners, registerForPush } from '@/features/notifications/push';
import { toast } from '@/store/toastStore';
import { translate } from '@/lib/i18n';
import { sessionFromUrl } from '@/features/auth/authApi';
import { useLanguageStore } from '@/store/languageStore';

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
    const handle = async (url: string | null) => {
      if (!url) return;
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
    if (profile.role === 'cashier' && profile.status === 'active' && profile.admin_id) void useCustomerOrderStore.getState().start(profile.admin_id);
    else useCustomerOrderStore.getState().stop();
  }, [status, profile?.id, profile?.role, profile?.status]);

  useEffect(() => {
    return addNotificationListeners({
      onReceived: (data, title, body) => {
        const lang = useLanguageStore.getState().lang;
        if (data.type === 'customer_order') void useCustomerOrderStore.getState().refresh();
        if (data.type === 'cashier_request') void runSync('push');
        if (data.type === 'status_change') void useAuthStore.getState().refreshProfile();
        toast.info(title && body ? `${title}: ${body}` : title ?? body ?? translate(lang, 'success'));
      },
      onResponse: (data) => {
        const p = useAuthStore.getState().profile;
        if (!p) return;
        if (data.type === 'cashier_request' && p.role === 'admin') router.push('/(admin)/cashiers');
        if (data.type === 'customer_order' && p.role === 'cashier') router.push('/(cashier)/queue');
      },
    });
  }, [router]);
}
