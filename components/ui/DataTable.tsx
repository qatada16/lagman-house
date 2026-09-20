import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout } from '@/lib/i18n';
import { AppText } from './AppText';

export interface Column<T> {
  key: string;
  title: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode | string;
  sortValue?: (row: T) => string | number;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  onRowPress?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  emptyLabel: string;
}

export function DataTable<T>({ columns, rows, keyOf, onRowPress, initialSort, emptyLabel }: Props<T>) {
  const { isRTL } = useLayout();
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const cols = isRTL ? [...columns].reverse() : columns;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }}>
      <View style={{ minWidth: totalWidth, flex: 1 }}>
        <View style={[styles.head, { flexDirection: 'row' }]}>
          {cols.map((c) => {
            const active = sort?.key === c.key;
            return (
              <Pressable
                key={c.key}
                disabled={!c.sortValue}
                onPress={() => toggleSort(c.key)}
                style={[styles.cell, { width: c.width, flexDirection: 'row', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', gap: 4 }]}
              >
                <AppText variant="label" color={active ? colors.action : colors.surfaceMuted} style={{ textTransform: 'uppercase' }}>
                  {c.title}
                </AppText>
                {c.sortValue ? <Feather name={active ? (sort!.dir === 'asc' ? 'chevron-up' : 'chevron-down') : 'code'} size={12} color={active ? colors.action : colors.disabled} style={active ? null : { transform: [{ rotate: '90deg' }] }} /> : null}
              </Pressable>
            );
          })}
        </View>
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="small" align="center">
              {emptyLabel}
            </AppText>
          </View>
        ) : (
          sorted.map((row, i) => (
            <Pressable
              key={keyOf(row)}
              onPress={onRowPress ? () => onRowPress(row) : undefined}
              style={({ pressed }) => [styles.row, { flexDirection: 'row', backgroundColor: pressed ? colors.surfaceSidebar : i % 2 ? colors.background : colors.white }]}
            >
              {cols.map((c) => {
                const v = c.render(row);
                return (
                  <View key={c.key} style={[styles.cell, { width: c.width, alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start' }]}>
                    {typeof v === 'string' ? (
                      <AppText variant="small" color={colors.textPrimary} numberOfLines={1} align={c.align ?? 'left'}>
                        {v}
                      </AppText>
                    ) : (
                      v
                    )}
                  </View>
                );
              })}
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: colors.surfaceSidebar, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { borderBottomWidth: 1, borderBottomColor: colors.border },
  cell: { paddingVertical: 10, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  empty: { padding: spacing.xl },
});
