import React, { createContext, useCallback, useContext, useRef } from 'react';
import { findNodeHandle, ScrollView, ScrollViewProps, UIManager, View } from 'react-native';
import { useKeyboardPadding } from '../lib/keyboard';
import { spacing } from '../theme/colors';

export const FocusScrollContext = createContext<((target: number) => void) | null>(null);
export const useFocusScroll = () => useContext(FocusScrollContext);

/** A form scroller: it leaves room for the keyboard and scrolls the field you tap above it, so you always see what you type. */
export function KeyboardScroll({ children, contentContainerStyle, ...rest }: ScrollViewProps) {
  const kb = useKeyboardPadding();
  const scroll = useRef<ScrollView>(null);
  const inner = useRef<View>(null);
  const toField = useCallback((target: number) => {
    setTimeout(() => {
      const node = findNodeHandle(inner.current);
      if (!node || !target) return;
      UIManager.measureLayout(target, node, () => undefined, (_x: number, y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - 140), animated: true }));
    }, 280);
  }, []);
  return (
    <FocusScrollContext.Provider value={toField}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" {...rest} contentContainerStyle={[contentContainerStyle, { paddingBottom: kb + spacing.xl }]}>
        <View ref={inner} collapsable={false}>{children}</View>
      </ScrollView>
    </FocusScrollContext.Provider>
  );
}
