import { Annotation } from "@langchain/langgraph";
import { DocumentChunk } from "./mcp/types";
import { CanvasModuleItem } from "@/app/types/canvas";

export type FollowUp = {
  question: string;
  userResponse: string;
  feedback: string;
  score: "correct" | "partial" | "incorrect";
};

export type ClarificationEntry = {
  question: string;
  answer: string;
};

export type MainQuestion = FollowUp & {
  consecutiveWrongCount: number;
  followups: FollowUp[];
  clarifications: ClarificationEntry[];
};

export type Subtopic = {
  name: string;
  documentId: string;
  sourceMaterial: DocumentChunk[];
  mainQuestions: MainQuestion[];
};

export type TutorStep =
  | "subtopic-generation"
  | "main-question-generation"
  | "asking-main"
  | "asking-followup"
  | "question-feedback"
  | "asking-clarification"
  | "session-complete";

export const TutorAnnotation = Annotation.Root({
  step: Annotation<TutorStep>,
  pendingStep: Annotation<TutorStep | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  topic: Annotation<string>,
  // Pre selection subtopics
  allSubtopics: Annotation<Subtopic[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  subtopics: Annotation<Subtopic[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  moduleItems: Annotation<CanvasModuleItem[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  clarificationSource: Annotation<"mid-question" | "end-of-thread">({
    reducer: (_, next) => next,
    default: () => "end-of-thread",
  }),
  pendingClarification: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  pendingClarificationAnswer: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  pendingEvaluation: Annotation<{
    score: "correct" | "partial" | "incorrect";
    feedback: string;
  } | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  pendingGoto: Annotation<
    "next-question" | "next-subtopic" | "session-end" | "followup" | ""
  >({
    reducer: (_, next) => next,
    default: () => "",
  }),
  currentSubtopicIndex: Annotation<number>,
  currentMainQuestionIndex: Annotation<number>,
  sessionFeedback: Annotation<string>,
  recommendations: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
});

export type TutorState = typeof TutorAnnotation.State;
