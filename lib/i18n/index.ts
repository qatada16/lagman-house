import { useCallback } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { en, type StringKey } from './strings.en';
import { ur } from './strings.ur';
import { useLanguageStore } from '@/store/languageStore';
import type { Language } from '@/lib/types';

const dictionaries: Record<Language, Record<StringKey, string>> = { en, ur };

export type { StringKey };

export function translate(lang: Language, key: StringKey, params?: Record<string, string | number>) {
  let value = dictionaries[lang][key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) value = value.split(`{${k}}`).join(String(v));
  }
  return value;
}

export function useT() {
  const lang = useLanguageStore((s) => s.lang);
  return useCallback(
    (key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );
}

export interface LayoutHelpers {
  isRTL: boolean;
  lang: Language;
  row: ViewStyle;
  rowReverse: ViewStyle;
  textAlign: TextStyle;
  alignStart: ViewStyle;
  alignEnd: ViewStyle;
  writingDirection: TextStyle;
  flip: ViewStyle;
}

// Components read these instead of relying on I18nManager, so the switch is instant.
export function useLayout(): LayoutHelpers {
  const lang = useLanguageStore((s) => s.lang);
  const isRTL = lang === 'ur';
  return {
    isRTL,
    lang,
    row: { flexDirection: isRTL ? 'row-reverse' : 'row' },
    rowReverse: { flexDirection: isRTL ? 'row' : 'row-reverse' },
    textAlign: { textAlign: isRTL ? 'right' : 'left' },
    alignStart: { alignItems: isRTL ? 'flex-end' : 'flex-start' },
    alignEnd: { alignItems: isRTL ? 'flex-start' : 'flex-end' },
    writingDirection: { writingDirection: isRTL ? 'rtl' : 'ltr' },
    flip: { transform: [{ scaleX: isRTL ? -1 : 1 }] },
  };
}

export function localizedName(lang: Language, name: string, nameUr?: string | null) {
  return lang === 'ur' && nameUr ? nameUr : name;
}
