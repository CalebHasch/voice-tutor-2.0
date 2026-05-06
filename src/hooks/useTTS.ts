import { useRef, useCallback } from "react";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        stop();

        const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}`);
        audioRef.current = audio;

        audio.onended = () => resolve();
        audio.onerror = () => resolve();

        audio.play().catch(console.error);
      });
    },
    [stop],
  );

  return { speak, stop };
}
