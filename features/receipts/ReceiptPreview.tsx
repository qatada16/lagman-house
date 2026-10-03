import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import type { Order, OrderItem, ReceiptTemplate } from '@/lib/types';
import { layoutReceipt, type ReceiptContext } from './render';

const GLYPH = {
  large: { size: 12, height: 17, scaleY: 1 },
  medium: { size: 9.5, height: 22, scaleY: 1.75 },
  small: { size: 9.5, height: 13, scaleY: 1 },
} as const;
const CHAR_RATIO = 0.6;

export function ReceiptPreview({ order, items, template, ctx }: { order: Order; items: OrderItem[]; template: ReceiptTemplate; ctx: ReceiptContext }) {
  const layout = useMemo(
    () => layoutReceipt(order, items, template, { ...ctx, logoPath: template.config.header.showLogo ? 'preview' : null }),
    [order, items, template, ctx]
  );
  const g = GLYPH[layout.textSize];
  const paperWidth = Math.ceil(layout.width * g.size * CHAR_RATIO) + spacing.md * 2;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={[styles.paper, { width: paperWidth }]}>
          {layout.lines.map((l, i) => {
            if (l.kind === 'logo') {
              return (
                <View key={i} style={styles.logo}>
                  <Text style={styles.logoText}>LOGO</Text>
                </View>
              );
            }
            const size = l.big ? g.size * 2 : g.size;
            const height = l.big ? 17 * 2 : g.height;
            const scaleY = l.big ? 1 : g.scaleY;
            return (
              <View key={i} style={{ height, justifyContent: 'center' }}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.mono,
                    { fontSize: size, lineHeight: size * 1.2, transform: [{ scaleY }] },
                    l.bold ? styles.bold : null,
                    l.kind === 'rule' ? styles.rule : null,
                  ]}
                >
                  {l.text || ' '}
                </Text>
              </View>
            );
          })}
          {Array.from({ length: layout.feedLines }).map((_, i) => (
            <View key={`feed-${i}`} style={{ height: g.height }} />
          ))}
          {layout.cut ? <View style={styles.cut} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md },
  paper: { backgroundColor: colors.white, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 2 },
  mono: { fontFamily: 'monospace', color: '#111', letterSpacing: 0, writingDirection: 'ltr', textAlign: 'left', includeFontPadding: false },
  bold: { fontWeight: '700' },
  rule: { color: '#666' },
  logo: { alignItems: 'center', justifyContent: 'center', height: 48, marginVertical: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#bbb' },
  logoText: { color: '#999', fontSize: 11, letterSpacing: 2 },
  cut: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#999', marginTop: spacing.sm },
});
