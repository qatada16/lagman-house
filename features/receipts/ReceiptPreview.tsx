import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import type { Order, OrderItem, ReceiptTemplate } from '@/lib/types';
import { buildReceiptNodes, charsForPaper, receiptToText, type ReceiptContext } from './render';

export function ReceiptPreview({ order, items, template, ctx }: { order: Order; items: OrderItem[]; template: ReceiptTemplate; ctx: ReceiptContext }) {
  const text = useMemo(() => receiptToText(buildReceiptNodes(order, items, template, { ...ctx, logoPath: template.config.header.showLogo ? 'preview' : null }), charsForPaper(template.config.paperWidthMm)), [order, items, template, ctx]);
  return (
    <View style={styles.paperWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={[styles.paper, { width: template.config.paperWidthMm === 80 ? 400 : 280 }]}>
          <Text style={styles.mono}>{text}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  paperWrap: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md },
  paper: { backgroundColor: colors.white, padding: spacing.md, borderRadius: 2 },
  mono: { fontFamily: 'monospace', fontSize: 11, lineHeight: 15, color: '#111', writingDirection: 'ltr', textAlign: 'left' },
});
