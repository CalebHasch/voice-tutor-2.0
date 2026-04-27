"use client";

import { useEffect, useRef, useState } from "react";

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
  const [silenceTimeout, setSilenceTimeout] = useState(3000); // default 3s
  const silenceTimeoutRef = useRef(3000);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript("");
      fullTranscriptRef.current = "";
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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
      resetSilenceTimer();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error);
      stopRecording();
    };

    recognition.onend = async () => {
      clearSilenceTimer();

      const finalText = fullTranscriptRef.current.trim();

      if (finalText) {
        setTranscript("");
        fullTranscriptRef.current = "";
        setIsRecording(false);

        try {
          await handleSend(finalText);
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
    if (!recognitionRef.current || isRecording) return;

    setTranscript("");
    fullTranscriptRef.current = "";
    setError(null);

    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }

  function stopRecording() {
    if (!recognitionRef.current || !isRecording) return;

    setIsRecording(false);
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
    isRecording ? stopRecording() : startRecording();
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
