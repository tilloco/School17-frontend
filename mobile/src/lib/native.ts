import { Alert } from 'react-native';
import { t } from '../i18n';

/**
 * Optional native modules. They are loaded only when a feature is used, never at app start, so an installed dev build that was made
 * BEFORE a module was added still starts (expo-router loads every screen file at launch; a top-level import of a missing native module crashes the whole app).
 * If the module is missing the user sees a clear message instead of a crash; the fix is to rebuild the development build.
 */
function load<T>(get: () => T): T | null {
  try {
    return get();
  } catch {
    Alert.alert(t('native.missing'));
    return null;
  }
}

export const imagePicker = () => load(() => require('expo-image-picker') as typeof import('expo-image-picker'));
export const documentPicker = () => load(() => require('expo-document-picker') as typeof import('expo-document-picker'));
export const clipboard = () => load(() => require('expo-clipboard') as typeof import('expo-clipboard'));
export const audioModule = () => load(() => (require('expo-audio') as typeof import('expo-audio')).AudioModule);
