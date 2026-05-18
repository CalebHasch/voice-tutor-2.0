export type Message = {
  role: "user" | "assistant";
  content: string;
  score?: "correct" | "partial" | "incorrect";
};

export type InterruptPayload =
  | { type: "subtopic-selection"; message: string; subtopics: string[] }
  | {
      type: "question";
      questionType: "main" | "followup";
      subtopic: string;
      question: string;
    }
  | {
      type: "feedback";
      score: "correct" | "partial" | "incorrect";
      feedback: string;
      isEncouragement: boolean;
      consecutiveWrongCount: number;
      message: string;
    }
  | { type: "clarification-prompt"; message: string }
  | { type: "clarification-answer"; answer: string }
  | { type: "incomplete-response"; message: string };

export type PreparedSpeech = {
  audio: HTMLAudioElement;
  durationMs: number;
  play: () => {
    started: Promise<void>;
    finished: Promise<void>;
  };
};
