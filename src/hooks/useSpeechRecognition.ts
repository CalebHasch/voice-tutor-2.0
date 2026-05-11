"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";

declare global {
  interface Window {
    SpeechRecognition: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

type SpeechRecognitionType = typeof window.SpeechRecognition;

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export function useSpeechRecognition(
  handleSend: (text: string) => Promise<void>,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [silenceTimeout, setSilenceTimeout] = useLocalStorage(
    "mentorai_silence_timeout",
    3000,
  ); // default 3s
  const silenceTimeoutRef = useRef(3000);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTranscriptRef = useRef("");
  const isStoppingRef = useRef(false);
  const isRecordingRef = useRef(false);

  function setRecording(val: boolean) {
    isRecordingRef.current = val;
    setIsRecording(val);
  }

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setRecording(true);
      setTranscript("");
      fullTranscriptRef.current = "";
      resetSilenceTimer();
    };

    recognition.onsoundstart = resetSilenceTimer;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          fullTranscriptRef.current += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript((fullTranscriptRef.current + interim).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error);
      stopRecording();
    };

    recognition.onend = async () => {
      isStoppingRef.current = false;
      clearSilenceTimer();

      const finalText = fullTranscriptRef.current.trim();
      setTranscript("");
      fullTranscriptRef.current = "";
      setRecording(false);

      if (finalText) {
        try {
          await handleSendRef.current(finalText);
        } catch (err) {
          console.error("Error sending voice text:", err);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      recognition.stop();
    };
  }, []);

  useEffect(() => {
    const supported =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    if (!supported) {
      setError("Speech recognition not supported in this browser.");
    }
  }, []);

  const handleSendRef = useRef(handleSend);

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    silenceTimeoutRef.current = silenceTimeout;
  }, [silenceTimeout]);

  function resetSilenceTimer() {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      stopRecording();
    }, silenceTimeoutRef.current);
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function startRecording() {
    if (!recognitionRef.current || isRecordingRef.current) return;

    setTranscript("");
    fullTranscriptRef.current = "";
    setError(null);

    try {
      recognitionRef.current.start();
      setRecording(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }

  function stopRecording() {
    if (
      !recognitionRef.current ||
      !isRecordingRef.current ||
      isStoppingRef.current
    )
      return;

    isStoppingRef.current = true;
    setRecording(false);
    clearSilenceTimer();

    try {
      recognitionRef.current.stop();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }

  function toggleRecording() {
    isRecordingRef.current ? stopRecording() : startRecording();
  }

  return {
    isRecording,
    transcript,
    error,
    toggleRecording,
    silenceTimeout,
    setSilenceTimeout,
  };
}
