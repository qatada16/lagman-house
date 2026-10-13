import React, { createContext, useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TopHandled = createContext(false);
const BottomHandled = createContext(false);

export function InsetHandled({ top, bottom, children }: { top?: boolean; bottom?: boolean; children: React.ReactNode }) {
  const parentTop = useContext(TopHandled);
  const parentBottom = useContext(BottomHandled);
  return (
    <TopHandled.Provider value={top ?? parentTop}>
      <BottomHandled.Provider value={bottom ?? parentBottom}>{children}</BottomHandled.Provider>
    </TopHandled.Provider>
  );
}

export function useTopInset() {
  const insets = useSafeAreaInsets();
  return useContext(TopHandled) ? 0 : insets.top;
}

export function useBottomInset() {
  const insets = useSafeAreaInsets();
  return useContext(BottomHandled) ? 0 : insets.bottom;
}
