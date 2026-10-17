import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One colour and one icon per subject, so Math never looks like English anywhere in the app. */
export const SUBJECT_STYLE: Record<string, { color: string; icon: IconName }> = {
  math: { color: '#1A8CFF', icon: 'calculator' },
  physics: { color: '#7B61FF', icon: 'planet' },
  chemistry: { color: '#20C997', icon: 'flask' },
  biology: { color: '#2F9E44', icon: 'leaf' },
  english: { color: '#FF6B6B', icon: 'chatbubbles' },
  russian: { color: '#FF8A00', icon: 'book' },
  uzbek: { color: '#00B3A4', icon: 'language' },
  history: { color: '#C98A2B', icon: 'hourglass' },
  geography: { color: '#37B24D', icon: 'earth' },
  informatics: { color: '#4C6EF5', icon: 'laptop' },
  law: { color: '#8D6E63', icon: 'scale' },
  economics: { color: '#F59F00', icon: 'trending-up' },
  literature: { color: '#E64980', icon: 'library' },
  exam_prep: { color: '#FA5252', icon: 'trophy' },
  music: { color: '#AE3EC9', icon: 'musical-notes' },
  art: { color: '#F06595', icon: 'color-palette' },
};
const FALLBACK = ['#1A8CFF', '#2ED573', '#FF8A00', '#A55EEA', '#FF6B6B', '#12B886'];

export const subjectStyle = (id: string | null | undefined) => (id && SUBJECT_STYLE[id]) || { color: FALLBACK[0], icon: 'school' as IconName };
/** A stable colour for things that are not a catalogue subject (for example a class title). */
export const colorFor = (text: string): string => { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0; return FALLBACK[h % FALLBACK.length]; };
