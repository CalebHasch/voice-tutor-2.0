"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import TopicSelector from "@/app/components/TopicSelector";
import ChatWindow from "@/app/components/ChatWindow";
import { useTTS } from "@/hooks/useTTS";
import { Message, InterruptPayload, TOPICS } from "@/app/types/tutor";

export default function Home() {
  const [topic, setTopic] = useState<string | null>(null);
  const [threadId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interrupt, setInterrupt] = useState<InterruptPayload | null>(null);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [subtopicName, setSubtopicName] = useState("");
  const [subtopicIndex, setSubtopicIndex] = useState(0);
  const [subtopicTotal, setSubtopicTotal] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { speak, stop } = useTTS();
  const lastSpokenIndexRef = useRef<number | null>(null);
  const lastInterruptRef = useRef<InterruptPayload | null>(null);

  const callApi = useCallback(
    async (resume?: string | string[]) => {
      setIsLoading(true);
      setInterrupt(null);

      const body =
        resume !== undefined ? { threadId, resume } : { topic, threadId };

      let data: any; // eslint-disable-line @typescript-eslint/no-explicit-any

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        data = await res.json();
      } catch (err) {
        console.error("Fetch error:", err);
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, a network error occurred. Please try again.",
          },
        ]);
        setInterrupt(lastInterruptRef.current);
        return;
      }

      setIsLoading(false);

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Sorry, something went wrong. Please try sending your message again.",
          },
        ]);
        setInterrupt(lastInterruptRef.current);
        return;
      }

      if (data.interrupted) {
        const payload = data.interrupt as InterruptPayload;
        lastInterruptRef.current = payload;
        setInterrupt(payload);

        // Update progress info from graph state
        if (data.subtopics?.length > 0) {
          const sidx = data.currentSubtopicIndex ?? 0;
          const qidx = data.currentMainQuestionIndex ?? 0;
          setSubtopicIndex(sidx);
          setSubtopicTotal(data.subtopics.length);
          setSubtopicName(data.subtopics[sidx]?.name ?? "");
          setQuestionIndex(qidx);
          setQuestionTotal(data.subtopics[sidx]?.mainQuestions?.length ?? 0);
        }

        if (payload.type === "question") {
          if (payload.questionType === "main") {
            // Incoming main question — start a fresh thread
            setMessages([{ role: "assistant", content: payload.question }]);
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: payload.question },
            ]);
          }
        } else if (payload.type === "subtopic-selection") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: payload.message },
          ]);
        } else if (payload.type === "feedback") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: payload.message,
              score: payload.score,
            },
          ]);
        } else if (payload.type === "incomplete-response") {
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

  function handleSend(text: string) {
    if (!text.trim()) return;

    stop();

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    callApi(text);
  }

  function handleContinue(shouldClear: boolean) {
    if (shouldClear) setMessages([]);
    callApi("continue");
  }

  function handleSubtopicToggle(name: string) {
    setSelectedSubtopics((prev) =>
      prev.includes(name)
        ? prev.filter((x) => x !== name)
        : prev.length < 4
          ? [...prev, name]
          : prev,
    );
  }

  function handleSubtopicsSubmit() {
    if (selectedSubtopics.length === 0) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Selected: ${selectedSubtopics.join(", ")}` },
    ]);
    setSelectedSubtopics([]);
    setMessages([]);
    callApi(selectedSubtopics);
  }

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

  useEffect(() => {
    if (!voiceEnabled) {
      stop();
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const lastIndex = messages.length - 1;

    if (lastMessage.role !== "assistant") return;
    if (lastSpokenIndexRef.current === lastIndex) return;

    lastSpokenIndexRef.current = lastIndex;

    const cleanText = lastMessage.content.replace(/[#*_`]/g, "");

    speak(cleanText);
  }, [messages, voiceEnabled, speak, stop]);

  if (!topic) return <TopicSelector onSelect={setTopic} />;

  const topicLabel = TOPICS.find((t) => t.id === topic)?.label ?? topic;

  return (
    <div
      className="min-h-screen bg-stone-50 flex flex-col"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .font-display { font-family: 'Lora', Georgia, serif; }
        .send-btn { background: #c2784a; transition: background 0.15s ease, transform 0.1s ease; }
        .send-btn:hover { background: #a8633c; }
        .send-btn:active { transform: scale(0.97); }
        .mic-btn-active { background: #dc2626; animation: micpulse 1.5s infinite; }
        @keyframes micpulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
        }
      `}</style>

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
              setSubtopicName("");
              hasSentInitial.current = false;
            }}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors border border-stone-200 rounded-full px-3 py-1"
          >
            Change topic
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6 min-h-0">
        <ChatWindow
          messages={messages}
          interrupt={interrupt}
          isLoading={isLoading}
          sessionComplete={sessionComplete}
          recommendations={recommendations}
          selectedSubtopics={selectedSubtopics}
          onSend={handleSend}
          onSubtopicToggle={handleSubtopicToggle}
          onSubtopicsSubmit={handleSubtopicsSubmit}
          onContinue={handleContinue}
          subtopicName={subtopicName}
          subtopicIndex={subtopicIndex}
          subtopicTotal={subtopicTotal}
          questionIndex={questionIndex}
          questionTotal={questionTotal}
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={setVoiceEnabled}
        />
      </div>
    </div>
  );
}
