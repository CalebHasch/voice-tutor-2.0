"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = async (overrideText?: string) => {
    const messageText = overrideText ?? input;

    if (!messageText.trim()) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: messageText },
    ];

    setMessages(newMessages);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: newMessages }),
    });

    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.content },
    ]);
  };

  const {
    isRecording,
    transcript,
    toggleRecording,
    error: speechError,
    silenceTimeout,
    setSilenceTimeout,
  } = useSpeechRecognition(async (text) => {
    await sendMessage(text);
  });

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4 text-xl font-semibold shadow-sm">
        MentorAI
      </header>

      {/* Chat container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`
                  max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow
                  ${
                    m.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-900 border"
                  }
                `}
              >
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {isRecording && (
        <div className="text-xs text-red-500 px-1">Listening...</div>
      )}

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="mx-auto max-w-3xl space-y-2">
          {/* Voice Settings */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Pause:</span>
            <input
              type="range"
              min={1000}
              max={10000}
              step={500}
              value={silenceTimeout}
              onChange={(e) => setSilenceTimeout(Number(e.target.value))}
            />
            <span>{(silenceTimeout / 1000).toFixed(1)}s</span>
          </div>

          {/* Input Row */}
          <div className="flex gap-2">
            <input
              value={transcript || input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask MentorAI anything..."
              className="flex-1 rounded-xl border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />

            {/* Mic Button */}
            <button
              onClick={toggleRecording}
              className={`rounded-xl px-3 text-lg ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-gray-200"
              }`}
            >
              🎤
            </button>

            <button
              onClick={() => sendMessage()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white"
            >
              Send
            </button>
          </div>

          {speechError && (
            <div className="text-sm text-red-500">{speechError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
