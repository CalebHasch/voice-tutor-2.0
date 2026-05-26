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

  // ── Coming from clarificationAsker (skip or after clarification answer) ──
  if (state.step === "asking-clarification") {
    if (state.pendingGoto === "followup") {
      return new Command({
        goto: "followupGenerator",
        update: { step: "asking-followup" },
      });
    }

    switch (state.pendingGoto) {
      case "session-end":
        return new Command({
          goto: "sessionEnd",
          update: { step: "session-complete" },
        });

      case "next-subtopic":
        return new Command({
          goto: "sessionRouter",
          update: {
            step: "asking-main",
            currentSubtopicIndex: currentSubtopicIndex + 1,
            currentMainQuestionIndex: 0,
          },
        });

      case "next-question":
      default:
        return new Command({
          goto: "sessionRouter",
          update: {
            step: "asking-main",
            currentSubtopicIndex: currentSubtopicIndex,
            currentMainQuestionIndex: currentMainQuestionIndex + 1,
          },
        });
    }
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
