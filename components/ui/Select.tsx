import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout, useT } from '@/lib/i18n';
import { AppText } from './AppText';
import { Input } from './Input';
import { Sheet } from './Sheet';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  label?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  error?: string | null;
}

export function Select<T extends string>({ label, value, options, onChange, placeholder, searchable, disabled, error }: Props<T>) {
  const t = useT();
  const { row } = useLayout();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="label" style={{ textTransform: 'uppercase' }}>
          {label}
        </AppText>
      ) : null}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, row, error ? { borderColor: colors.danger } : null, disabled ? styles.disabled : null]}
      >
        <AppText color={selected ? colors.textPrimary : colors.disabled} style={{ flex: 1 }}>
          {selected?.label ?? placeholder ?? t('none')}
        </AppText>
        <Feather name="chevron-down" size={18} color={colors.surfaceMuted} />
      </Pressable>
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} scroll={false}>
        {searchable ? <Input placeholder={t('search')} value={query} onChangeText={setQuery} autoFocus /> : null}
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.value}
          style={{ maxHeight: 420 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const active = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setQuery('');
                }}
                style={[styles.option, row, active ? styles.optionActive : null]}
              >
                <View style={{ flex: 1 }}>
                  <AppText weight={active ? '600' : '400'}>{item.label}</AppText>
                  {item.hint ? <AppText variant="small">{item.hint}</AppText> : null}
                </View>
                {active ? <Feather name="check" size={18} color={colors.action} /> : null}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    gap: spacing.sm,
  },
  disabled: { backgroundColor: colors.surfaceSidebar },
  option: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  optionActive: { backgroundColor: colors.surfaceSidebar },
});
