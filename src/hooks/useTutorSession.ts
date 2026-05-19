import { useCallback, useEffect, useRef, useState } from "react";
import { useTTS } from "@/hooks/useTTS";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMessageDelivery } from "@/hooks/useMessageDelivery";
import { sendTutorMessage } from "@/app/services/sendTutorMessage";
import { InterruptPayload, Message } from "@/app/types/tutor";

interface UseTutorSessionProps {
  topic?: string;
}

export function useTutorSession({ topic }: UseTutorSessionProps) {
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

  const { deliverMessage, cancelPlayback } = useMessageDelivery({
    voiceEnabled,
    prepareSpeech,
    type,
    setMessages,
    setIsLoading,
  });

  const lastInterruptRef = useRef<InterruptPayload | null>(null);

  const shouldClearNextRef = useRef(false);

  const handleContinueRef = useRef<(shouldClear: boolean) => void>(() => {});

  const callApi = useCallback(
    async (resume?: string | string[]) => {
      setIsLoading(true);
      setInterrupt(null);
      cancelTypewriter();
      cancelPlayback();

      const body =
        resume !== undefined ? { threadId, resume } : { topic, threadId };

      let data: any; // eslint-disable-line @typescript-eslint/no-explicit-any

      try {
        data = await sendTutorMessage(body);
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
        setIsLoading(false);

        return;
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
        setIsLoading(false);

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
    },
    [topic, threadId, deliverMessage, cancelTypewriter, cancelPlayback],
  );

  function handleSend(text: string) {
    if (!text.trim()) return;

    cancelTypewriter();
    cancelPlayback();
    stop();

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    callApi(text);
  }

  const handleContinue = useCallback(
    (shouldClear: boolean) => {
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
    },
    [interrupt, callApi],
  );

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

  function resetSession() {
    setMessages([]);
    setInterrupt(null);
    setSessionComplete(false);
    setSelectedSubtopics([]);
    setSubtopicName("");

    lastInterruptRef.current = null;
    shouldClearNextRef.current = false;
    hasSentInitial.current = false;
  }

  const hasSentInitial = useRef(false);

  useEffect(() => {
    if (!topic || hasSentInitial.current) return;

    hasSentInitial.current = true;

    callApi();
  }, [topic, callApi]);

  useEffect(() => {
    handleContinueRef.current = handleContinue;
  }, [handleContinue]);

  return {
    messages,
    interrupt,
    isLoading,

    sessionComplete,
    recommendations,

    selectedSubtopics,

    subtopicName,
    subtopicIndex,
    subtopicTotal,

    questionIndex,
    questionTotal,

    voiceEnabled,
    setVoiceEnabled,

    handleSend,
    handleContinue,
    handleSubtopicToggle,
    handleSubtopicsSubmit,

    resetSession,
  };
}
