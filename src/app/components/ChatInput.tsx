"use client";

import { useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  isLoading: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled,
  isLoading,
  placeholder = "Type your answer…",
}: ChatInputProps) {
  const [typedInput, setTypedInput] = useState("");

  const {
    isRecording,
    transcript,
    toggleRecording,
    error: speechError,
    silenceTimeout,
    setSilenceTimeout,
  } = useSpeechRecognition(async (text) => {
    onSend(text);
  });

  // Show live transcript while recording, otherwise show typed input
  const displayValue = isRecording ? transcript : typedInput;

  function handleSend() {
    const text = displayValue.trim();
    if (!text || disabled) return;
    onSend(text);
    setTypedInput("");
  }

  return (
    <div className="mt-4 space-y-2">
      {/* Voice settings */}
      <div className="flex items-center gap-2 text-xs text-stone-400 px-1">
        <span>Silence timeout:</span>
        <input
          type="range"
          min={1000}
          max={10000}
          step={500}
          value={silenceTimeout}
          onChange={(e) => setSilenceTimeout(Number(e.target.value))}
          className="accent-amber-600"
        />
        <span className="tabular-nums">
          {(silenceTimeout / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          value={displayValue}
          onChange={(e) => {
            if (!isRecording) setTypedInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) handleSend();
          }}
          placeholder={disabled ? "Waiting…" : placeholder}
          disabled={disabled}
          className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-colors disabled:opacity-50"
        />

        <button
          onClick={toggleRecording}
          title={isRecording ? "Stop recording" : "Start recording"}
          className={`rounded-xl px-3.5 text-base transition-all ${
            isRecording
              ? "mic-btn-active text-white"
              : "bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200"
          }`}
        >
          🎤
        </button>

        <button
          onClick={handleSend}
          disabled={isLoading || disabled}
          className="send-btn rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>

      {isRecording && (
        <p className="text-xs text-red-500 px-1 animate-pulse">Listening…</p>
      )}
      {speechError && (
        <p className="text-xs text-red-400 px-1">{speechError}</p>
      )}
    </div>
  );
}
