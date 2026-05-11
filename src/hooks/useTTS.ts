import { useRef, useCallback } from "react";
import { PreparedSpeech } from "@/app/types/tutor";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      // cleanup blob URL
      URL.revokeObjectURL(audioRef.current.src);

      audioRef.current = null;
    }
  }, []);

  const prepareSpeech = useCallback(
    async (text: string) => {
      const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;

      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject();
      });

      const prepared: PreparedSpeech = {
        audio,
        durationMs: audio.duration * 1000,

        play: () => {
          stop();

          audioRef.current = audio;

          const started = new Promise<void>((resolve) => {
            audio.onplaying = () => resolve();
          });

          const finished = new Promise<void>((resolve) => {
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };

            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
          });

          audio.play().catch(console.error);

          return {
            started,
            finished,
          };
        },
      };

      return prepared;
    },
    [stop],
  );

  return {
    prepareSpeech,
    stop,
  };
}
