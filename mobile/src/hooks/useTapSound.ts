import { useAudioPlayer } from 'expo-audio';

const tapSound = require('../assets/sounds/tap.mp3');

export function useTapSound() {
  const player = useAudioPlayer(tapSound);

  const playTap = () => {
    player.seekTo(0);
    player.play();
  };

  return playTap;
}