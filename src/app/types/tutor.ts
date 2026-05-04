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
      message: string;
    }
  | { type: "incomplete-response"; message: string };

export const TOPICS = [
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
  {
    id: "1st-grade-math",
    label: "1st Grade Math",
    description: "Basic arithmetic & problem-solving",
  },
];
