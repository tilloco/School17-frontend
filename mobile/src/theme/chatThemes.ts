import { isDarkTheme } from './colors';

/**
 * Colour themes for a class channel (Telegram sells these; here they are free). The teacher picks one, everybody in the class sees it.
 * `accent` colours the teacher's own bubbles, the pinned strip and the channel page; `wallLight` / `wallDark` tint the chat wall.
 */
export interface ChatTheme { key: string; name: string; accent: string; accent2: string; wallLight: string; wallDark: string; mineText: string }

export const CHAT_THEMES: ChatTheme[] = [
  { key: 'ocean', name: 'Ocean', accent: '#1A8CFF', accent2: '#0F6FE0', wallLight: '#EAF4FF', wallDark: '#0F1B2B', mineText: '#FFFFFF' },
  { key: 'sunset', name: 'Sunset', accent: '#FF7A3D', accent2: '#E5484D', wallLight: '#FFF1E8', wallDark: '#2B1A14', mineText: '#FFFFFF' },
  { key: 'forest', name: 'Forest', accent: '#1FA971', accent2: '#0E7A53', wallLight: '#E8F7EF', wallDark: '#10241B', mineText: '#FFFFFF' },
  { key: 'lavender', name: 'Lavender', accent: '#7B61FF', accent2: '#5B3FE0', wallLight: '#F0ECFF', wallDark: '#1B1830', mineText: '#FFFFFF' },
  { key: 'rose', name: 'Rose', accent: '#E8498A', accent2: '#C42B6B', wallLight: '#FFEAF2', wallDark: '#2B141F', mineText: '#FFFFFF' },
  { key: 'midnight', name: 'Midnight', accent: '#3F51B5', accent2: '#283593', wallLight: '#E8EAF6', wallDark: '#12142B', mineText: '#FFFFFF' },
  { key: 'mint', name: 'Mint', accent: '#14B8A6', accent2: '#0D8F81', wallLight: '#E6F9F6', wallDark: '#0E2422', mineText: '#FFFFFF' },
  { key: 'gold', name: 'Gold', accent: '#E0A100', accent2: '#B47F00', wallLight: '#FFF7DC', wallDark: '#2A2410', mineText: '#FFFFFF' },
  { key: 'slate', name: 'Slate', accent: '#546E7A', accent2: '#37474F', wallLight: '#ECEFF1', wallDark: '#171C1F', mineText: '#FFFFFF' },
  { key: 'candy', name: 'Candy', accent: '#C026D3', accent2: '#9D1BB0', wallLight: '#FAE9FD', wallDark: '#26122A', mineText: '#FFFFFF' },
];

export const themeOf = (key?: string | null): ChatTheme => CHAT_THEMES.find((x) => x.key === key) ?? CHAT_THEMES[0];
export const wallOf = (th: ChatTheme) => (isDarkTheme ? th.wallDark : th.wallLight);
