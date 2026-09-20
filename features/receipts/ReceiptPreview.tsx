import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import type { Order, OrderItem, ReceiptTemplate } from '@/lib/types';
import { buildReceiptNodes, charsForPaper, receiptToLines, type ReceiptContext } from './render';

// Font B on real printers is narrower; mirror that with a smaller preview glyph.
const GLYPH = { A: { size: 12, lineHeight: 16 }, B: { size: 9.5, lineHeight: 13 } } as const;

export function ReceiptPreview({ order, items, template, ctx }: { order: Order; items: OrderItem[]; template: ReceiptTemplate; ctx: ReceiptContext }) {
  const font = template.config.style.font;
  const chars = charsForPaper(template.config.paperWidthMm, font);
  const lines = useMemo(
    () => receiptToLines(buildReceiptNodes(order, items, template, { ...ctx, logoPath: template.config.header.showLogo ? 'preview' : null }), chars),
    [order, items, template, ctx, chars]
  );
  const g = GLYPH[font];
  const paperWidth = Math.round(chars * g.size * 0.62) + spacing.md * 2;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={[styles.paper, { width: paperWidth }]}>
          {lines.map((l, i) => (
            <Text
              key={i}
              numberOfLines={1}
              style={[
                styles.mono,
                { fontSize: l.size === 2 ? g.size * 1.9 : g.size, lineHeight: l.size === 2 ? g.lineHeight * 1.9 : g.lineHeight },
                l.bold ? styles.bold : null,
                l.kind === 'rule' || l.kind === 'cut' ? styles.rule : null,
                l.kind === 'image' ? styles.image : null,
              ]}
            >
              {l.text || ' '}
            </Text>
          ))}
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
  rule: { color: '#777' },
  image: { color: '#999' },
});
