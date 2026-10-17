import React, { useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that sinks slightly under the finger and springs back, like iOS controls, with a very light tap feel. The style goes on the pressable itself, so layout is unchanged. */
export function PressScale({ children, style, onPress, scaleTo = 0.97, haptic = true, ...rest }: Omit<PressableProps, 'style' | 'children'> & { children: React.ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean }) {
  const v = useRef(new Animated.Value(1)).current;
  const last = useRef(0);
  const to = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { to(scaleTo); rest.onPressIn?.(e); }}
      onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}
      onPress={onPress ? (e: GestureResponderEvent) => { const now = Date.now(); if (now - last.current < 350) return; last.current = now; if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); onPress(e); } : undefined}
      style={[style, { transform: [{ scale: v }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
