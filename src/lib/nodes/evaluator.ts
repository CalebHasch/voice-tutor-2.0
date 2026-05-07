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
            content: `You are an expert tutor evaluating a student's understanding.

Focus primarily on whether the student understands the important underlying concepts rather than exact wording, perfect terminology, or complete detail.

Scoring:
- "correct": the student demonstrates understanding of the core concept, even if the explanation is incomplete or informal
- "partial": the student shows some conceptual understanding but has important gaps or confusion
- "incorrect": the student fundamentally misunderstands the concept or provides an unrelated answer

Favor conceptual understanding over precision.
Do not penalize minor mistakes, awkward phrasing, or missing secondary details if the main idea is correct.

Provide concise constructive feedback in 2-3 sentences written directly to the student in second person.`,
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

  function getPendingGoto(): TutorState["pendingGoto"] {
    const totalSubtopics = updatedSubtopics.length;
    const totalMainQuestions =
      updatedSubtopics[currentSubtopicIndex].mainQuestions.length;

    // Followup that was wrong — check consecutive count
    if (isFollowup && score !== "correct") {
      q.consecutiveWrongCount += 1;
      if (q.consecutiveWrongCount < 2) return "followup";
      // >= 2 wrong in a row — force advance (fall through)
    }

    // Main question that was wrong/partial — needs a followup
    if (!isFollowup && score !== "correct") {
      return "followup";
    }

    // Advance: next question, next subtopic, or end
    if (currentMainQuestionIndex + 1 < totalMainQuestions)
      return "next-question";
    if (currentSubtopicIndex + 1 < totalSubtopics) return "next-subtopic";
    return "session-end";
  }

  const pendingGoto = getPendingGoto();
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

  // Always route to clarificationAsker — sessionRouter handles onward routing
  return new Command({
    goto: "clarificationAsker",
    update: {
      subtopics: updatedSubtopics,
      pendingGoto,
      step: "question-feedback",
    },
  });
}
