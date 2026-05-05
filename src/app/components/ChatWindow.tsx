"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Message, InterruptPayload } from "@/app/types/tutor";
import ChatInput from "./ChatInput";

interface ChatWindowProps {
  messages: Message[];
  interrupt: InterruptPayload | null;
  isLoading: boolean;
  sessionComplete: boolean;
  recommendations: string[];
  selectedSubtopics: string[];
  voiceEnabled: boolean;
  setVoiceEnabled: (val: boolean) => void;
  onSend: (text: string) => void;
  onSubtopicToggle: (name: string) => void;
  onSubtopicsSubmit: () => void;
  onContinue: (shouldClear: boolean) => void;
  subtopicName: string;
  subtopicIndex: number;
  subtopicTotal: number;
  questionIndex: number;
  questionTotal: number;
}

const SCORE_CONFIG = {
  correct: {
    icon: "✓",
    label: "Correct",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  partial: {
    icon: "◐",
    label: "Partial",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  incorrect: {
    icon: "✗",
    label: "Incorrect",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
  },
};

export default function ChatWindow({
  messages,
  interrupt,
  isLoading,
  sessionComplete,
  recommendations,
  selectedSubtopics,
  voiceEnabled,
  setVoiceEnabled,
  onSend,
  onSubtopicToggle,
  onSubtopicsSubmit,
  onContinue,
  subtopicName,
  subtopicIndex,
  subtopicTotal,
  questionIndex,
  questionTotal,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [fading, setFading] = useState(false);

  const isSubtopicSelection = interrupt?.type === "subtopic-selection";
  const isQuestion = interrupt?.type === "question";
  const isFeedback = interrupt?.type === "feedback";
  const isIncomplete = interrupt?.type === "incomplete-response";
  const needsContinue = isFeedback || isIncomplete;
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interrupt]);

  useEffect(() => {
    if (messages.length === 1 && prevMessageCountRef.current > 1) {
      setFading(false);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  // Fade out then call onContinue for feedback that ends a main question thread
  function handleContinue() {
    const shouldClear =
      isFeedback &&
      ((interrupt as Extract<InterruptPayload, { type: "feedback" }>).score ===
        "correct" ||
        (interrupt as Extract<InterruptPayload, { type: "feedback" }>)
          .consecutiveWrongCount >= 2);

    if (shouldClear) {
      setFading(true);
      setTimeout(() => {
        setFading(false);
        onContinue(true);
      }, 350);
    } else {
      onContinue(false);
    }
  }
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .font-display { font-family: 'Lora', Georgia, serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        .send-btn { background: #c2784a; transition: background 0.15s ease, transform 0.1s ease; }
        .send-btn:hover { background: #a8633c; }
        .send-btn:active { transform: scale(0.97); }
        .mic-btn-active { background: #dc2626; animation: micpulse 1.5s infinite; }
        @keyframes micpulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
        }
        .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #c2784a; display: inline-block; animation: tbounce 1.2s infinite ease-in-out; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes tbounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        .message-appear { animation: fadeUp 0.25s ease forwards; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .chat-fade-out { animation: fadeOut 0.35s ease forwards; }
        @keyframes fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-8px); } }
        .subtopic-chip { border: 1.5px solid #e5e0d8; background: #fffefb; transition: all 0.15s ease; cursor: pointer; }
        .subtopic-chip:hover { border-color: #c2784a; }
        .subtopic-chip.selected { border-color: #c2784a; background: #fdf3ec; color: #a8633c; }
        .rec-item { border-left: 2px solid #c2784a; }
        .progress-pip { width: 6px; height: 6px; border-radius: 50%; background: #e5e0d8; transition: background 0.2s; }
        .progress-pip.active { background: #c2784a; }
        .progress-pip.done { background: #a8633c; }
      `}</style>

      {/* Subtopic header — shown once a session is underway */}
      {subtopicName && !isSubtopicSelection && !sessionComplete && (
        <div className="mb-3 px-1 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 font-body">
              Subtopic {subtopicIndex + 1} of {subtopicTotal}
            </p>
            <p className="font-display text-base text-stone-700 mt-0.5">
              {subtopicName}
            </p>
          </div>
          {/* Question progress pips */}
          {questionTotal > 0 && (
            <div className="flex gap-1.5 items-center">
              {Array.from({ length: questionTotal }).map((_, i) => (
                <div
                  key={i}
                  className={`progress-pip ${
                    i < questionIndex
                      ? "done"
                      : i === questionIndex
                        ? "active"
                        : ""
                  }`}
                />
              ))}
              <span className="text-xs text-stone-400 ml-1 font-body">
                Q{questionIndex + 1}/{questionTotal}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chat window */}
      <div
        className="flex-1 overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-sm p-6 space-y-5"
        style={{ minHeight: "60vh" }}
      >
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex items-center justify-center text-stone-300 text-sm font-display italic">
            {isSubtopicSelection
              ? "Choose your subtopics below to begin…"
              : "Your session is starting…"}
          </div>
        )}

        <div className={fading ? "chat-fade-out" : ""}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex mb-5 message-appear ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0 font-display text-amber-700">
                  M
                </div>
              )}
              <div className="flex flex-col gap-1 max-w-[78%]">
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-stone-800 text-stone-100 rounded-br-sm"
                      : "bg-stone-50 border border-stone-200 text-stone-800 rounded-bl-sm"
                  }`}
                >
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>

                {/* Score badge on feedback messages */}
                {m.role === "assistant" && m.score && (
                  <div
                    className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: SCORE_CONFIG[m.score].bg,
                      border: `1px solid ${SCORE_CONFIG[m.score].border}`,
                      color: SCORE_CONFIG[m.score].color,
                    }}
                  >
                    <span>{SCORE_CONFIG[m.score].icon}</span>
                    <span>{SCORE_CONFIG[m.score].label}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-start items-end gap-2 message-appear">
            <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs font-display text-amber-700 shrink-0">
              M
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        {/* Subtopic chips */}
        {isSubtopicSelection && !isLoading && (
          <div className="message-appear space-y-3 pl-9">
            <p className="text-xs text-stone-400">
              Select 1–4 subtopics to focus on
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                interrupt as Extract<
                  InterruptPayload,
                  { type: "subtopic-selection" }
                >
              ).subtopics.map((s) => (
                <button
                  key={s}
                  onClick={() => onSubtopicToggle(s)}
                  className={`subtopic-chip rounded-xl px-3 py-1.5 text-sm ${
                    selectedSubtopics.includes(s)
                      ? "selected"
                      : "text-stone-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={onSubtopicsSubmit}
              disabled={selectedSubtopics.length === 0}
              className="send-btn rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start session ({selectedSubtopics.length} selected)
            </button>
          </div>
        )}

        {/* Continue / Try again button */}
        {needsContinue && !isLoading && (
          <div className="message-appear pl-9 pt-1">
            {isIncomplete ? (
              <button
                onClick={() => onContinue(false)}
                className="send-btn rounded-xl px-4 py-2 text-sm font-medium text-white"
              >
                Try again →
              </button>
            ) : (
              <button
                onClick={handleContinue}
                className="send-btn rounded-xl px-4 py-2 text-sm font-medium text-white"
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {/* Session complete — recommendations */}
        {sessionComplete && recommendations.length > 0 && (
          <div className="message-appear pl-9 space-y-2 pt-2">
            <p className="text-xs uppercase tracking-widest text-stone-400">
              Recommendations
            </p>
            {recommendations.map((r, i) => (
              <div
                key={i}
                className="rec-item pl-3 py-0.5 text-sm text-stone-600"
              >
                {r}
              </div>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — hidden during selection, feedback, incomplete, or session end */}
      {!isSubtopicSelection &&
        !isFeedback &&
        !isIncomplete &&
        !sessionComplete && (
          <ChatInput
            onSend={onSend}
            disabled={!isQuestion}
            isLoading={isLoading}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
          />
        )}
    </>
  );
}
