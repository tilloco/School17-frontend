import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * How much of the bottom of the screen the on-screen keyboard covers, so a screen can keep its message box above it.
 * On new Android versions the app draws behind the keyboard (and behind the navigation bar), so the covered height is
 * measured from the top of the keyboard to the bottom of the screen, not taken from the keyboard's own height.
 */
export function useKeyboardPadding(): number {
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
