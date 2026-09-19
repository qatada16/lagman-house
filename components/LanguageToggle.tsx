import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { useLanguageStore } from '@/store/languageStore';
import { AppText } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { updateOwnProfileLocal } from '@/features/auth/profileRepo';
import type { Language } from '@/lib/types';

export function LanguageToggle({ compact }: { compact?: boolean }) {
  const lang = useLanguageStore((s) => s.lang);
  const setLang = useLanguageStore((s) => s.setLang);
  const profile = useAuthStore((s) => s.profile);

  const choose = (next: Language) => {
    if (next === lang) return;
    setLang(next);
    if (profile) {
      updateOwnProfileLocal(profile.id, { language: next });
      useAuthStore.setState({ profile: { ...profile, language: next } });
    }
  };

  return (
    <View style={[styles.group, compact ? styles.compact : null]}>
      {(['en', 'ur'] as Language[]).map((l) => {
        const active = l === lang;
        return (
          <Pressable key={l} onPress={() => choose(l)} style={[styles.item, active ? styles.active : null]}>
            <AppText variant="small" weight="600" align="center" color={active ? colors.textOnDark : colors.accentDark}>
              {l === 'en' ? 'EN' : 'اردو'}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: 1, borderColor: colors.accentDark, borderRadius: radius.sm, overflow: 'hidden', alignSelf: 'flex-start' },
  compact: { transform: [{ scale: 0.9 }] },
  item: { paddingHorizontal: 12, paddingVertical: 6, minWidth: 48, backgroundColor: colors.white },
  active: { backgroundColor: colors.accentDark },
});
