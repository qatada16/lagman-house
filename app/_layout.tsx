import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { useAuthGate } from '@/features/auth/useAuthGate';
import { useAppServices } from '@/features/app/useAppServices';
import { ToastHost } from '@/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const langHydrated = useLanguageStore((s) => s.hydrated);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      await useLanguageStore.getState().hydrate();
      await useAuthStore.getState().init();
      setBooted(true);
    })().catch((e) => {
      console.warn('[boot] failed', e);
      setBooted(true);
    });
  }, []);

  const ready = booted && langHydrated && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useAuthGate();
  useAppServices();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="(cashier)" />
            <Stack.Screen name="pending" />
            <Stack.Screen name="phone/link" options={{ presentation: 'card' }} />
            <Stack.Screen name="phone/verify" options={{ presentation: 'card' }} />
          </Stack>
          <ToastHost />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
