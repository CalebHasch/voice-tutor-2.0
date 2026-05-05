import { openai } from "@/lib/openai";
import { TutorState } from "@/lib/tutorState";
import { Command, interrupt } from "@langchain/langgraph";
import { zodResponseFormat } from "openai/helpers/zod";
import { withRetry } from "@/lib/withRetry";
import { z } from "zod";

const EvaluationSchema = z.object({
  score: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string(),
});

export async function evaluatorNode(state: TutorState): Promise<Command> {
  const { subtopics, currentSubtopicIndex, currentMainQuestionIndex } = state;
  const currentSubtopic = subtopics[currentSubtopicIndex];
  const currentQuestion =
    currentSubtopic.mainQuestions[currentMainQuestionIndex];

  const isFollowup =
    currentQuestion.followups.length > 0 &&
    currentQuestion.followups[currentQuestion.followups.length - 1]
      .userResponse !== "" &&
    currentQuestion.followups[currentQuestion.followups.length - 1].feedback ===
      "";

  const updatedSubtopics = structuredClone(subtopics);
  const q =
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ];

  // ── Check if we already evaluated
  const alreadyEvaluated = isFollowup
    ? q.followups[q.followups.length - 1].feedback !== ""
    : q.feedback !== "";

  let score: "correct" | "partial" | "incorrect";
  let feedback: string;

  if (alreadyEvaluated) {
    // Re-running after resume — read saved values from state, skip LLM call
    if (isFollowup) {
      const lastFollowup = q.followups[q.followups.length - 1];
      score = lastFollowup.score;
      feedback = lastFollowup.feedback;
    } else {
      score = q.score;
      feedback = q.feedback;
    }
  } else {
    // First run — call LLM and save result to state
    const questionText = isFollowup
      ? currentQuestion.followups[currentQuestion.followups.length - 1].question
      : currentQuestion.question;
    const userResponse = isFollowup
      ? currentQuestion.followups[currentQuestion.followups.length - 1]
          .userResponse
      : currentQuestion.userResponse;

    const result = await withRetry(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        response_format: zodResponseFormat(EvaluationSchema, "evaluation"),
        messages: [
          {
            role: "system",
            content: `You are an expert tutor evaluating a student's response.
            Score as:
            - "correct": student demonstrates solid understanding
            - "partial": student shows some understanding but misses key concepts
            - "incorrect": student misunderstands or doesn't know the material
            Provide concise, constructive feedback (2-3 sentences).`,
          },
          {
            role: "user",
            content: `Topic: ${state.topic}
Subtopic: ${currentSubtopic.name}
Question: ${questionText}
Student's response: ${userResponse}`,
          },
        ],
      });
      return EvaluationSchema.parse(
        JSON.parse(response.choices[0].message.content ?? "{}"),
      );
    });

    score = result.score;
    feedback = result.feedback;

    // Write to state immediately so re-run can detect it
    if (isFollowup) {
      const lastFollowup = q.followups[q.followups.length - 1];
      lastFollowup.score = score;
      lastFollowup.feedback = feedback;
    } else {
      q.score = score;
      q.feedback = feedback;
    }
  }

  function getNextStep(): {
    goto: string;
    nextSubtopicIdx: number;
    nextQuestionIdx: number;
    step: TutorState["step"];
  } {
    const totalSubtopics = updatedSubtopics.length;
    const totalMainQuestions =
      updatedSubtopics[currentSubtopicIndex].mainQuestions.length;

    const advanceQuestion = () => {
      if (currentMainQuestionIndex + 1 < totalMainQuestions) {
        return {
          goto: "sessionRouter",
          nextSubtopicIdx: currentSubtopicIndex,
          nextQuestionIdx: currentMainQuestionIndex + 1,
          step: "asking-main" as const,
        };
      } else if (currentSubtopicIndex + 1 < totalSubtopics) {
        return {
          goto: "sessionRouter",
          nextSubtopicIdx: currentSubtopicIndex + 1,
          nextQuestionIdx: 0,
          step: "asking-main" as const,
        };
      } else {
        return {
          goto: "sessionEnd",
          nextSubtopicIdx: currentSubtopicIndex,
          nextQuestionIdx: currentMainQuestionIndex,
          step: "session-complete" as const,
        };
      }
    };

    if (!isFollowup) {
      if (score === "correct") return advanceQuestion();
      return {
        goto: "followupGenerator",
        nextSubtopicIdx: currentSubtopicIndex,
        nextQuestionIdx: currentMainQuestionIndex,
        step: "asking-followup" as const,
      };
    } else {
      if (score === "correct") return advanceQuestion();
      q.consecutiveWrongCount += 1;
      if (q.consecutiveWrongCount >= 2) return advanceQuestion();
      return {
        goto: "followupGenerator",
        nextSubtopicIdx: currentSubtopicIndex,
        nextQuestionIdx: currentMainQuestionIndex,
        step: "asking-followup" as const,
      };
    }
  }

  // ── Routing logic (unchanged) ────────────────────────────────────
  const { goto, nextSubtopicIdx, nextQuestionIdx, step } = getNextStep();
  const isEncouragement =
    isFollowup && score !== "correct" && q.consecutiveWrongCount >= 2;

  interrupt({
    type: "feedback",
    score,
    feedback,
    isEncouragement,
    consecutiveWrongCount: q.consecutiveWrongCount,
    message: isEncouragement
      ? `${feedback}\n\nKeep going — let's move to the next question.`
      : feedback,
  });

  return new Command({
    goto,
    update: {
      subtopics: updatedSubtopics,
      currentSubtopicIndex: nextSubtopicIdx,
      currentMainQuestionIndex: nextQuestionIdx,
      step,
    },
  });
}
