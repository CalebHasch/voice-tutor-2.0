import { openai } from "@/lib/openai";
import { TutorState } from "@/lib/tutorState";
import { Command, interrupt } from "@langchain/langgraph";
import { zodResponseFormat } from "openai/helpers/zod";
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

  const questionText = isFollowup
    ? currentQuestion.followups[currentQuestion.followups.length - 1].question
    : currentQuestion.question;
  const userResponse = isFollowup
    ? currentQuestion.followups[currentQuestion.followups.length - 1]
        .userResponse
    : currentQuestion.userResponse;

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

  const { score, feedback } = EvaluationSchema.parse(
    JSON.parse(response.choices[0].message.content ?? "{}"),
  );

  const updatedSubtopics = structuredClone(subtopics);
  const q =
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ];

  if (isFollowup) {
    const lastFollowup = q.followups[q.followups.length - 1];
    lastFollowup.score = score;
    lastFollowup.feedback = feedback;
  } else {
    q.score = score;
    q.feedback = feedback;
  }

  // ── Routing logic ────────────────────────────────────────────────
  const totalSubtopics = updatedSubtopics.length;
  const totalMainQuestions = currentSubtopic.mainQuestions.length;

  function getNextStep(): {
    goto: string;
    nextSubtopicIdx: number;
    nextQuestionIdx: number;
    step: TutorState["step"];
  } {
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
      // Main question evaluation
      if (score === "correct") {
        return advanceQuestion();
      } else {
        // Needs a followup
        return {
          goto: "followupGenerator",
          nextSubtopicIdx: currentSubtopicIndex,
          nextQuestionIdx: currentMainQuestionIndex,
          step: "asking-followup" as const,
        };
      }
    } else {
      // Followup evaluation
      if (score === "correct") {
        return advanceQuestion();
      } else {
        q.consecutiveWrongCount += 1;
        if (q.consecutiveWrongCount >= 2) {
          // 2 wrong in a row — give encouragement and move on
          return advanceQuestion();
        } else {
          return {
            goto: "followupGenerator",
            nextSubtopicIdx: currentSubtopicIndex,
            nextQuestionIdx: currentMainQuestionIndex,
            step: "asking-followup" as const,
          };
        }
      }
    }
  }

  const { goto, nextSubtopicIdx, nextQuestionIdx, step } = getNextStep();

  const isEncouragement =
    isFollowup && score !== "correct" && q.consecutiveWrongCount >= 2;

  interrupt({
    type: "feedback",
    score,
    feedback,
    isEncouragement,
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
