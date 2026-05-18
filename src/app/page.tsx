"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import CourseSelector from "./components/CourseSelector";
import ModuleSelector from "@/app/components/ModuleSelector";
import ChatWindow from "@/app/components/ChatWindow";
import { useTTS } from "@/hooks/useTTS";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Message, InterruptPayload } from "@/app/types/tutor";
import { CanvasCourse, CanvasModule } from "./types/canvas";

export default function Home() {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [modules, setModules] = useState<CanvasModule[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CanvasCourse | null>(
    null,
  );
  const [selectedModule, setSelectedModule] = useState<CanvasModule | null>(
    null,
  );
  const [coursesLoading, setCoursesLoading] = useState(true);
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
  const [voiceEnabled, setVoiceEnabled] = useLocalStorage(
    "mentorai_voice_enabled",
    true,
  );
  const { prepareSpeech, stop } = useTTS();
  const { type, cancel: cancelTypewriter } = useTypewriter();
  const lastInterruptRef = useRef<InterruptPayload | null>(null);
  const shouldClearNextRef = useRef(false);
  const handleContinueRef = useRef<(shouldClear: boolean) => void>(() => {});
  const playbackIdRef = useRef(0);

  const callApi = useCallback(
    async (resume?: string | string[]) => {
      setIsLoading(true);
      setInterrupt(null);
      cancelTypewriter();

      const playbackId = ++playbackIdRef.current;

      let playbackStarted = false;

      try {
        function splitIntoSentences(text: string): string[] {
          const normalized = text.replace(/\s+/g, " ").trim();

          const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/g) || [];

          const chunks: string[] = [];

          let current = "";

          for (const rawSentence of sentences) {
            const sentence = rawSentence.trim();

            if (!sentence) continue;

            const next = current ? `${current} ${sentence}` : sentence;

            if (next.split(" ").length > 18) {
              if (current) {
                chunks.push(current);
              }

              current = sentence;
            } else {
              current = next;
            }
          }

          if (current) {
            chunks.push(current);
          }

          return chunks;
        }

        const body =
          resume !== undefined
            ? { threadId, resume }
            : { topic: selectedModule?.title, threadId };

        let data: any; // eslint-disable-line @typescript-eslint/no-explicit-any

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          }

          data = await res.json();
        } catch (err) {
          console.error("Fetch error:", err);

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

        async function deliverMessage(
          content: string,
          score?: Message["score"],
        ) {
          const sentences = splitIntoSentences(content);

          let accumulated = "";

          let messageCreated = false;

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
          }

          if (!voiceEnabled && !messageCreated) {
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

          for (let i = 0; i < sentences.length; i++) {
            if (playbackId !== playbackIdRef.current) {
              return;
            }

            const sentence = sentences[i];

            const cleanSentence = sentence.trim();

            if (!cleanSentence) continue;

            // get already preloaded speech
            let preparedSpeech = null;

            try {
              preparedSpeech = nextSpeechPromise
                ? await nextSpeechPromise
                : null;
            } catch (err) {
              console.error("TTS preload failed:", err);
            }

            // preload NEXT speech immediately
            if (voiceEnabled && i + 1 < sentences.length) {
              nextSpeechPromise = prepareSpeech(sentences[i + 1]).catch(
                (err) => {
                  console.error("Next TTS preload failed:", err);

                  return null;
                },
              );
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
        }

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
              setMessages([]);
            }

            await deliverMessage(payload.question);
          } else if (payload.type === "subtopic-selection") {
            await deliverMessage(payload.message);
          } else if (payload.type === "feedback") {
            shouldClearNextRef.current =
              payload.score === "correct" || payload.consecutiveWrongCount >= 2;

            await deliverMessage(payload.message, payload.score);

            handleContinueRef.current(false);

            return;
          } else if (payload.type === "clarification-prompt") {
            await deliverMessage(payload.message);
          } else if (payload.type === "clarification-answer") {
            await deliverMessage(payload.answer ?? (payload as any).answer); // eslint-disable-line @typescript-eslint/no-explicit-any
          } else if (payload.type === "incomplete-response") {
            await deliverMessage(payload.message);
          }

          setInterrupt(payload);
        } else if (data.step === "session-complete") {
          setMessages([]);

          setSessionComplete(true);

          setRecommendations(data.recommendations ?? []);

          await deliverMessage(data.sessionFeedback);
        }
      } finally {
        if (!playbackStarted) {
          setIsLoading(false);
        }
      }
    },
    [
      selectedModule?.title,
      threadId,
      voiceEnabled,
      prepareSpeech,
      cancelTypewriter,
      type,
    ],
  );

  function handleSend(text: string) {
    if (!text.trim()) return;

    cancelTypewriter();
    stop();

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    callApi(text);
  }

  function handleContinue(shouldClear: boolean) {
    if (interrupt?.type === "clarification-prompt") {
      callApi("__skip__");
      return;
    } else if (interrupt?.type === "clarification-answer") {
      if (shouldClearNextRef.current) setMessages([]);
      callApi("continue");
      return;
    }

    if (shouldClear) setMessages([]);
    callApi("continue");
  }

  async function handleCourseSelect(course: CanvasCourse) {
    setSelectedCourse(course);
    setModules([]);

    try {
      const res = await fetch(`/api/courses/${course.id}/modules`);

      if (!res.ok) {
        console.error("Failed to load modules");
        return;
      }

      const data = await res.json();

      console.log("Modules data:", data);

      if (data.success) {
        setModules(data.modules);
      }
    } catch (err) {
      console.error(err);
    }
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
    handleContinueRef.current = handleContinue;
  });

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch("/api/courses");
        const data = await res.json();

        if (data.success) {
          setCourses(data.courses);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCoursesLoading(false);
      }
    }

    loadCourses();
  }, []);

  const hasSentInitial = useRef(false);
  useEffect(() => {
    if (!selectedModule || hasSentInitial.current) return;
    hasSentInitial.current = true;
    callApiRef.current();
  }, [selectedModule]);

  if (!selectedCourse) {
    return (
      <CourseSelector
        courses={courses}
        loading={coursesLoading}
        onSelect={handleCourseSelect}
      />
    );
  }

  if (!selectedModule) {
    return (
      <ModuleSelector
        course={selectedCourse}
        modules={modules}
        onBack={() => {
          setSelectedCourse(null);
          setModules([]);
        }}
        onSelect={setSelectedModule}
      />
    );
  }
  const topicLabel = `${selectedCourse.title} · ${selectedModule.title}`;

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
              setSelectedCourse(null);
              setSelectedModule(null);
              setModules([]);

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
