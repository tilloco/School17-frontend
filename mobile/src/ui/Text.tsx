import React from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps } from 'react-native';
import { colors } from '../theme/colors';
import { useFocusScroll } from './KeyboardScroll';

/**
 * Text and TextInput that use the Inter typeface (a close, open-licensed cousin of Apple's San Francisco), with the right file for each weight:
 * Android cannot make bold from one file, so every weight is its own font family. If the fonts are not loaded yet the phone's own font is used.
 */
const FAMILY: Record<string, string> = {
  '100': 'Inter_400Regular', '200': 'Inter_400Regular', '300': 'Inter_400Regular', '400': 'Inter_400Regular', normal: 'Inter_400Regular',
  '500': 'Inter_500Medium', '600': 'Inter_600SemiBold', '700': 'Inter_700Bold', bold: 'Inter_700Bold', '800': 'Inter_800ExtraBold', '900': 'Inter_800ExtraBold',
};

function withFont(style: TextProps['style']): TextProps['style'] {
  const f = StyleSheet.flatten(style) ?? {};
  const fam = FAMILY[String(f.fontWeight ?? '400')] ?? 'Inter_400Regular';
  return [{ color: colors.text }, style, { fontFamily: fam, fontWeight: 'normal' as const }];
}

export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={withFont(style)} />;
}

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, onFocus, ...rest }, ref) {
  const focusScroll = useFocusScroll();
  return <RNTextInput ref={ref} {...rest} onFocus={(e) => { focusScroll?.(e.nativeEvent.target as unknown as number); onFocus?.(e); }} style={withFont(style)} />;
});
