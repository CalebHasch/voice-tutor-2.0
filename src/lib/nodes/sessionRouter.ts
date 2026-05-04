import { TutorState } from "@/lib/tutorState";
import { interrupt } from "@langchain/langgraph";
import { Command } from "@langchain/langgraph";

export async function sessionRouterNode(state: TutorState): Promise<Command> {
  const { subtopics, currentSubtopicIndex, currentMainQuestionIndex } = state;
  const currentSubtopic = subtopics[currentSubtopicIndex];
  const currentQuestion =
    currentSubtopic?.mainQuestions[currentMainQuestionIndex];

  if (!currentSubtopic || !currentQuestion) {
    throw new Error(
      `sessionRouter: subtopics[${currentSubtopicIndex}] or mainQuestions[${currentMainQuestionIndex}] is undefined. subtopics length: ${subtopics.length}`,
    );
  }

  // ── Ask main question ────────────────────────────────────────────
  if (state.step === "asking-main") {
    const userResponse: string = interrupt({
      type: "question",
      questionType: "main",
      subtopic: currentSubtopic.name,
      question: currentQuestion.question,
    });

    const updatedSubtopics = structuredClone(subtopics);
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ].userResponse = userResponse;

    return new Command({
      goto: "responseValidator",
      update: {
        subtopics: updatedSubtopics,
        step: "question-feedback",
        pendingStep: state.step,
      },
    });
  }

  // ── Ask followup question ────────────────────────────────────────
  if (state.step === "asking-followup") {
    const followups = currentQuestion.followups;
    const currentFollowup = followups[followups.length - 1];

    const userResponse: string = interrupt({
      type: "question",
      questionType: "followup",
      subtopic: currentSubtopic.name,
      question: currentFollowup.question,
    });

    const updatedSubtopics = structuredClone(subtopics);
    const followupIndex =
      updatedSubtopics[currentSubtopicIndex].mainQuestions[
        currentMainQuestionIndex
      ].followups.length - 1;
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ].followups[followupIndex].userResponse = userResponse;

    return new Command({
      goto: "responseValidator",
      update: {
        subtopics: updatedSubtopics,
        step: "question-feedback",
        pendingStep: state.step,
      },
    });
  }

  // Fallback — should not be reached
  return new Command({ goto: "responseValidator" });
}
