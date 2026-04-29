import { Annotation } from "@langchain/langgraph";

export type FollowUp = {
  question: string;
  userResponse: string;
  feedback: string;
  score: "correct" | "partial" | "incorrect";
};

export type MainQuestion = {
  question: string;
  userResponse: string;
  feedback: string;
  score: "correct" | "partial" | "incorrect";
  consecutiveWrongCount: number;
  followups: FollowUp[];
};

export type Subtopic = {
  name: string;
  mainQuestions: MainQuestion[];
};

export type TutorStep =
  | "subtopic-generation"
  | "main-question-generation"
  | "asking-main"
  | "asking-followup"
  | "question-feedback"
  | "session-complete";

export const TutorAnnotation = Annotation.Root({
  step: Annotation<TutorStep>,
  topic: Annotation<string>,
  subtopics: Annotation<Subtopic[]>({
    reducer: (_, next) => next,
    default: () => [],
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
