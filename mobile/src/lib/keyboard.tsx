import React, { createContext, createElement, useContext, useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, View } from 'react-native';

/** How much of the bottom of the screen the on-screen keyboard covers (measured from the keyboard's top edge to the screen's bottom: Android draws behind the navigation bar). */
function useRawKeyboardHeight(): number {
  const [covered, setCovered] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const c = e.endCoordinates;
      const fromTop = c?.screenY ? Dimensions.get('screen').height - c.screenY : 0;
      setCovered(Math.max(fromTop, c?.height ?? 0));
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setCovered(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return covered;
}

const KeyboardContext = createContext(0);

/**
 * One place that makes EVERY screen keyboard-safe: the whole app shrinks above the keyboard, so what you type is never hidden.
 * Screens do not add their own keyboard padding (useKeyboardPadding returns 0 for them). Pop-ups (Modal) are separate windows:
 * they ask for the real height with useKeyboardPadding({ modal: true }).
 */
export function KeyboardRoot({ children }: { children: React.ReactNode }) {
  const kb = useRawKeyboardHeight();
  return createElement(KeyboardContext.Provider, { value: kb }, createElement(View, { style: { flex: 1, paddingBottom: kb } }, children));
}

/** Padding a screen should add for the keyboard: 0 inside the app root (it is already handled), the real height inside a Modal. */
export function useKeyboardPadding(opts?: { modal?: boolean }): number {
  const kb = useContext(KeyboardContext);
  return opts?.modal ? kb : 0;
}

/** True while the keyboard is open. */
export function useKeyboardOpen(): boolean {
  return useContext(KeyboardContext) > 0;
}
