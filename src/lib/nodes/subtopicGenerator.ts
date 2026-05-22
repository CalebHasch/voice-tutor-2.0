import { Subtopic, TutorState } from "@/lib/tutorState";
import { interrupt } from "@langchain/langgraph";

const ALLOWED_CONTENT_TYPES = ["wikipage"];
const EXCLUDED_TITLE_PATTERNS = [
  /^introduction/i,
  /^summary/i,
  /^check for understanding/i,
  /^technical lesson/i,
  /^overview/i,
  /^lab/i,
  /^quiz/i,
  /^discussion/i,
  /^practice/i,
  /^assessments/i,
];

function isSubstantiveLesson(title: string): boolean {
  return !EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()));
}

export async function subtopicGeneratorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const allSubtopics: Subtopic[] = state.moduleItems
    .filter(
      (item) =>
        ALLOWED_CONTENT_TYPES.includes(item.content_type) &&
        isSubstantiveLesson(item.title),
    )
    .map((item) => ({
      name: item.title,
      documentId: item.document_id,
      sourceMaterial: [],
      mainQuestions: [],
    }));

  return {
    allSubtopics,
    step: "subtopic-generation",
  };
}

export async function subtopicSelectorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const subtopicNames = state.allSubtopics.map((s: Subtopic) => s.name);

  const selectedNames: string[] = interrupt({
    type: "subtopic-selection",
    message:
      "Here are the subtopics for this session. Please select 1 to 4 to focus on.",
    subtopics: subtopicNames,
  });

  const selectedSubtopics = state.allSubtopics.filter((s: Subtopic) =>
    selectedNames.includes(s.name),
  );

  return {
    subtopics: selectedSubtopics,
    step: "main-question-generation",
  };
}
