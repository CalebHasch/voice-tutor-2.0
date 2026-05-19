"use client";

import { useRef } from "react";
import { splitIntoSentences } from "@/utils/splitIntoSentences";
import { Message } from "@/app/types/tutor";

interface UseMessageDeliveryProps {
  voiceEnabled: boolean;
  prepareSpeech: (text: string) => Promise<{
    durationMs: number;
    play: () => {
      started: Promise<void>;
      finished: Promise<void>;
    };
  } | null>;
  type: (
    text: string,
    onUpdate: (text: string) => void,
    durationMs: number,
  ) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useMessageDelivery({
  voiceEnabled,
  prepareSpeech,
  type,
  setMessages,
  setIsLoading,
}: UseMessageDeliveryProps) {
  const playbackIdRef = useRef(0);

  async function deliverMessage(content: string, score?: Message["score"]) {
    const playbackId = ++playbackIdRef.current;

    const sentences = splitIntoSentences(content);

    let accumulated = "";

    let messageCreated = false;

    let playbackStarted = false;

    let nextSpeechPromise =
      voiceEnabled && sentences.length > 0
        ? prepareSpeech(sentences[0]).catch((err) => {
            console.error("Initial TTS preload failed:", err);

            return null;
          })
        : null;

    if (!voiceEnabled) {
      playbackStarted = true;
      setIsLoading(false);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          score,
        },
      ]);

      messageCreated = true;
    }

    try {
      for (let i = 0; i < sentences.length; i++) {
        if (playbackId !== playbackIdRef.current) {
          return;
        }

        const sentence = sentences[i];

        const cleanSentence = sentence.trim();

        if (!cleanSentence) continue;

        let preparedSpeech = null;

        try {
          preparedSpeech = nextSpeechPromise ? await nextSpeechPromise : null;
        } catch (err) {
          console.error("TTS preload failed:", err);
        }

        if (voiceEnabled && i + 1 < sentences.length) {
          nextSpeechPromise = prepareSpeech(sentences[i + 1]).catch((err) => {
            console.error("Next TTS preload failed:", err);

            return null;
          });
        }

        let speechFinished = Promise.resolve();

        let durationMs = 0;

        if (preparedSpeech) {
          durationMs = preparedSpeech.durationMs;

          const playback = preparedSpeech.play();

          await playback.started;

          if (!messageCreated) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "",
                score,
              },
            ]);

            messageCreated = true;
          }

          if (i === 0) {
            playbackStarted = true;
            setIsLoading(false);
          }

          speechFinished = playback.finished;
        }

        const typingPromise = type(
          sentence,
          (typedSentence) => {
            if (playbackId !== playbackIdRef.current) {
              return;
            }

            setMessages((prev) => {
              const updated = [...prev];

              const last = updated[updated.length - 1];

              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content:
                    accumulated + (accumulated ? " " : "") + typedSentence,
                };
              }

              return updated;
            });
          },
          durationMs,
        );

        await Promise.all([speechFinished, typingPromise]);

        accumulated = accumulated
          ? accumulated + " " + cleanSentence
          : cleanSentence;
      }
    } finally {
      if (!playbackStarted) {
        setIsLoading(false);
      }
    }
  }

  function cancelPlayback() {
    playbackIdRef.current++;
  }

  return {
    deliverMessage,
    cancelPlayback,
  };
}
