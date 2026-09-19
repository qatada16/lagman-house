import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '@/lib/types';

const KEY = 'lh.language';

interface LanguageState {
  lang: Language;
  hydrated: boolean;
  setLang: (lang: Language) => void;
  hydrate: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  lang: 'en',
  hydrated: false,
  setLang: (lang) => {
    set({ lang });
    AsyncStorage.setItem(KEY, lang).catch(() => undefined);
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(KEY);
      if (stored === 'en' || stored === 'ur') set({ lang: stored });
    } finally {
      set({ hydrated: true });
    }
  },
}));
