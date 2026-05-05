import { useRef } from "react";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function speak(text: string) {
    stop(); // interrupt previous audio

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.play().catch(console.error);
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }

  return { speak, stop };
}
