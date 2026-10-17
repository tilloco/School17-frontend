import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Colour themes. The palette is picked once when the app starts (a theme change asks the app to restart), so every screen can keep
 * using `colors.x` in its styles. Design choices for people who look at the screen for hours: no pure white page and no pure black
 * text (less glare), softer contrast than the browser default but still well above WCAG AA, and the brand orange only on the main button.
 */
export type ThemeMode = 'auto' | 'light' | 'dark' | 'evening';
export const THEME_KEY = 'school17_theme';

// Palette follows Apple's system colours (iOS): blue tint, grouped grey backgrounds, vivid green / orange / red / purple for status and icons.
const LIGHT = {
  primary: '#1A8CFF', primaryDark: '#0F74E0', primaryLight: '#4DA6FF', primarySoft: '#E0EFFF',
  accent: '#1A8CFF', accentDark: '#0F74E0',
  success: '#2ED573', successSoft: '#DDF8E8', danger: '#FF4757', dangerSoft: '#FFE6E8', warning: '#FF9F1A', warningSoft: '#FFEFD2', warningText: '#8A4B00',
  background: '#FAF6F0', surface: '#FFFFFF', border: '#EBE3D8', text: '#25201A', textMuted: '#7B7167', neutralSoft: '#F1EAE0',
  hero: '#6C4DFF', heroText: '#FFFFFF', white: '#FFFFFF',
};
// Dark: warm charcoal (a hint of brown, never cold blue-black); text warm off-white.
const DARK: typeof LIGHT = {
  primary: '#3DA0FF', primaryDark: '#2A88EA', primaryLight: '#82C0FF', primarySoft: '#1B3050',
  accent: '#3DA0FF', accentDark: '#2A88EA',
  success: '#32D25A', successSoft: '#17351F', danger: '#FF5A4F', dangerSoft: '#40211D', warning: '#FFA21F', warningSoft: '#3D2C12', warningText: '#FFD08A',
  background: '#15120F', surface: '#221E1A', border: '#352F29', text: '#F6F1EA', textMuted: '#A59C92', neutralSoft: '#2D2823',
  hero: '#6347F2', heroText: '#FFFFFF', white: '#FFFFFF',
};
// Evening: paper-like warm tones with the blue taken out, for long evening sessions.
const EVENING: typeof LIGHT = {
  primary: '#2D6672', primaryDark: '#22505A', primaryLight: '#2D6672', primarySoft: '#E8E0CC',
  accent: '#C97A24', accentDark: '#A9631A',
  success: '#4B8A5E', successSoft: '#E3E6CF', danger: '#B5524A', dangerSoft: '#F0DDD0', warning: '#B98532', warningSoft: '#F0E2C2', warningText: '#6E4A12',
  background: '#F1E8D6', surface: '#F9F2E3', border: '#DDD0B6', text: '#3A3126', textMuted: '#74664F', neutralSoft: '#E7DCC4',
  hero: '#2D6672', heroText: '#FBF6EA', white: '#FFFFFF',
};

const read = (): ThemeMode => {
  try {
    const v = SecureStore.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'evening' ? v : 'auto';
  } catch {
    return 'auto';
  }
};
export const themeMode: ThemeMode = read();
const resolved = themeMode === 'auto' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : themeMode;
export const isDarkTheme = resolved === 'dark';

export const colors = resolved === 'dark' ? DARK : resolved === 'evening' ? EVENING : LIGHT;

export function saveThemeMode(m: ThemeMode): void {
  try { SecureStore.setItem(THEME_KEY, m); } catch { /* keeps the old theme */ }
}

export const gradients = {
  hero: [colors.hero, colors.primaryDark] as const,
  mockCard: [colors.primary, colors.primaryLight] as const,
  streak: ['#FF9500', '#FF6A00'] as const,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 12, lg: 18, xl: 24 };

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: isDarkTheme ? 0.3 : 0.06,
  shadowRadius: 12,
  elevation: isDarkTheme ? 0 : 3,
};
