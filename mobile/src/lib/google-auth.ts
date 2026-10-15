// Google sign-in needs a native module that Expo Go does not contain. It is loaded only when the user taps the Google button,
// never at app start: a top-level import (or configure call) crashes Expo Go and any build made without the module.
let configured = false;

function google() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  if (!configured) {
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!, offlineAccess: false });
    configured = true;
  }
  return GoogleSignin;
}

export async function signInWithGoogle() {
  let G;
  try {
    G = google();
  } catch {
    throw new Error('Google sign-in is not available in this build (Expo Go). Use phone sign-in or a development build.');
  }
  await G.hasPlayServices();
  const userInfo = await G.signIn();
  const idToken = userInfo.data?.idToken;
  const name = userInfo.data?.user?.name ?? '';
  if (!idToken) throw new Error('No idToken received');
  return { idToken, name };
}
