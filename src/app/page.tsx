"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type InterruptPayload =
  | { type: "subtopic-selection"; message: string; subtopics: string[] }
  | {
      type: "question";
      questionType: "main" | "followup";
      subtopic: string;
      question: string;
    };

const TOPICS = [
  {
    id: "react",
    label: "React",
    description: "Hooks, state, components & modern patterns",
  },
  {
    id: "human-anatomy",
    label: "Human Anatomy",
    description: "Systems, structures & physiological function",
  },
];

export default function Home() {
  const [topic, setTopic] = useState<string | null>(null);
  const [threadId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [interrupt, setInterrupt] = useState<InterruptPayload | null>(null);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const callApi = useCallback(
    async (resume?: string | string[]) => {
      setIsLoading(true);
      setInterrupt(null);

      const body =
        resume !== undefined ? { threadId, resume } : { topic, threadId };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error("API error:", await res.text());
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setIsLoading(false);

      if (data.interrupted) {
        const payload = data.interrupt as InterruptPayload;
        setInterrupt(payload);

        if (payload.type === "question") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `**${payload.subtopic}**\n\n${payload.question}`,
            },
          ]);
        } else if (payload.type === "subtopic-selection") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: payload.message },
          ]);
        }
      } else if (data.step === "session-complete") {
        setSessionComplete(true);
        setRecommendations(data.recommendations ?? []);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.sessionFeedback },
        ]);
      }
    },
    [topic, threadId],
  );

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = overrideText ?? input;
      if (!text.trim()) return;
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      await callApi(text);
    },
    [input, callApi],
  );

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

  // Submit selected subtopics
  const submitSubtopics = useCallback(async () => {
    if (selectedSubtopics.length === 0) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Selected: ${selectedSubtopics.join(", ")}` },
    ]);
    setSelectedSubtopics([]);
    await callApi(selectedSubtopics);
  }, [selectedSubtopics, callApi]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interrupt]);

  const sendMessageRef = useRef(sendMessage);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  const callApiRef = useRef(callApi);
  useEffect(() => {
    callApiRef.current = callApi;
  });

  const hasSentInitial = useRef(false);
  useEffect(() => {
    if (!topic || hasSentInitial.current) return;
    hasSentInitial.current = true;
    callApiRef.current();
  }, [topic]);

  // const hasSentInitial = useRef(false);

  // useEffect(() => {
  //   if (!topic || hasSentInitial.current) return;
  //   hasSentInitial.current = true;
  //   sendMessageRef.current(undefined, true);
  // }, [topic]);

  // ── Topic Selector ──────────────────────────────────────────────
  if (!topic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
          .font-display { font-family: 'Lora', Georgia, serif; }
          .font-body { font-family: 'DM Sans', sans-serif; }
          .topic-card { transition: all 0.2s ease; border: 1.5px solid #e5e0d8; background: #fffefb; }
          .topic-card:hover { border-color: #c2784a; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(194,120,74,0.12); }
        `}</style>
        <div className="w-full max-w-lg text-center space-y-10 font-body">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
              AI Tutor
            </p>
            <h1 className="font-display text-4xl text-stone-800 leading-tight">
              What would you like
              <br />
              <em>to learn today?</em>
            </h1>
            <p className="text-stone-500 text-sm leading-relaxed">
              Select a topic and your tutor will guide you through it with
              questions, feedback, and encouragement.
            </p>
          </div>
          <div className="space-y-3">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                className="topic-card w-full rounded-2xl px-6 py-5 text-left cursor-pointer"
              >
                <div className="font-display text-lg text-stone-800">
                  {t.label}
                </div>
                <div className="text-stone-400 text-sm mt-0.5">
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const topicLabel = TOPICS.find((t) => t.id === topic)?.label ?? topic;
  const isSubtopicSelection = interrupt?.type === "subtopic-selection";
  const isQuestion = interrupt?.type === "question";

  // ── Chat Interface ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-body">
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
        .subtopic-chip { border: 1.5px solid #e5e0d8; background: #fffefb; transition: all 0.15s ease; cursor: pointer; }
        .subtopic-chip:hover { border-color: #c2784a; }
        .subtopic-chip.selected { border-color: #c2784a; background: #fdf3ec; color: #a8633c; }
        .rec-item { border-left: 2px solid #c2784a; }
      `}</style>

      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-display text-lg text-stone-800">
              MentorAI
            </span>
            <span className="mx-2 text-stone-300">·</span>
            <span className="text-sm text-stone-500">{topicLabel}</span>
          </div>
          <button
            onClick={() => {
              setTopic(null);
              setMessages([]);
              setInterrupt(null);
              setSessionComplete(false);
              setSelectedSubtopics([]);
              hasSentInitial.current = false;
            }}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors border border-stone-200 rounded-full px-3 py-1"
          >
            Change topic
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6 min-h-0">
        {/* Chat window */}
        <div
          className="flex-1 overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-sm p-6 space-y-5"
          style={{ minHeight: "60vh" }}
        >
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex items-center justify-center text-stone-300 text-sm font-display italic">
              Your session is starting…
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex message-appear ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0 font-display text-amber-700">
                  M
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-stone-800 text-stone-100 rounded-br-sm"
                    : "bg-stone-50 border border-stone-200 text-stone-800 rounded-bl-sm"
                }`}
              >
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}

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

          {/* Subtopic chips — shown inline after the assistant's selection prompt */}
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
                    onClick={() =>
                      setSelectedSubtopics((prev) =>
                        prev.includes(s)
                          ? prev.filter((x) => x !== s)
                          : prev.length < 4
                            ? [...prev, s]
                            : prev,
                      )
                    }
                    className={`subtopic-chip rounded-xl px-3 py-1.5 text-sm ${selectedSubtopics.includes(s) ? "selected" : "text-stone-700"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={submitSubtopics}
                disabled={selectedSubtopics.length === 0}
                className="send-btn rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start session ({selectedSubtopics.length} selected)
              </button>
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

        {/* Input — hidden during subtopic selection or after session ends */}
        {!isSubtopicSelection && !sessionComplete && (
          <div className="mt-4 space-y-2">
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
            <div className="flex gap-2">
              <input
                value={transcript || input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isQuestion ? "Type your answer…" : "Waiting…"}
                disabled={!isQuestion}
                className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-colors disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) sendMessage();
                }}
              />
              <button
                onClick={toggleRecording}
                className={`rounded-xl px-3.5 text-base transition-all ${isRecording ? "mic-btn-active text-white" : "bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200"}`}
              >
                🎤
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !isQuestion}
                className="send-btn rounded-xl px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            {isRecording && (
              <p className="text-xs text-red-500 px-1 animate-pulse">
                Listening…
              </p>
            )}
            {speechError && (
              <p className="text-xs text-red-400 px-1">{speechError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
