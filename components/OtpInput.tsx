import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { AppText } from '@/components/ui';

// Six boxes backed by one hidden input so paste and autofill work.
export function OtpInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value.length === 6) onComplete?.(value);
  }, [value, onComplete]);

  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.wrap}>
      <View style={styles.boxes}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.box, focused && i === value.length ? styles.boxActive : null]}>
            <AppText variant="title" align="center">
              {value[i] ?? ''}
            </AppText>
          </View>
        ))}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
        autoFocus
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  boxes: { flexDirection: 'row', gap: 8 },
  box: {
    width: 44,
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.action, borderWidth: 2 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
