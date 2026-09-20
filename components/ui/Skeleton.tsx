import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/constants/theme';

export function Skeleton({ width = '100%', height = 16, style }: { width?: number | `${number}%`; height?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.block, { width, height }, animated, style]} />;
}

// Generic "dashboard-shaped" placeholder used while auth resolves after login.
export function SkeletonScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <Skeleton width={44} height={44} style={{ borderRadius: 22 }} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton width="55%" height={20} />
          <Skeleton width="35%" height={12} />
        </View>
      </View>
      <View style={styles.row}>
        <Skeleton height={84} style={{ flex: 1 }} />
        <Skeleton height={84} style={{ flex: 1 }} />
      </View>
      <View style={styles.row}>
        <Skeleton height={84} style={{ flex: 1 }} />
        <Skeleton height={84} style={{ flex: 1 }} />
      </View>
      <Skeleton height={180} />
      <Skeleton height={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceHighlight, borderRadius: radius.md },
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.xxl * 2, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
