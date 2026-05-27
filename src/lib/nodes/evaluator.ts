import { openai } from "@/lib/openai";
import { TutorState } from "@/lib/tutorState";
import { formatSourceMaterial } from "@/utils/formatSourceMaterial";
import { Command, interrupt } from "@langchain/langgraph";
import { zodResponseFormat } from "openai/helpers/zod";
import { withRetry } from "@/lib/withRetry";
import { z } from "zod";

const EvaluationSchema = z.object({
  score: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string(),
});

export async function evaluatorLLMNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
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

  // Already evaluated on a previous run — nothing to do
  const alreadyEvaluated = isFollowup
    ? q.followups[q.followups.length - 1].feedback !== ""
    : q.feedback !== "";

  if (alreadyEvaluated) {
    return {};
  }

  const questionText = isFollowup
    ? currentQuestion.followups[currentQuestion.followups.length - 1].question
    : currentQuestion.question;
  const userResponse = isFollowup
    ? currentQuestion.followups[currentQuestion.followups.length - 1]
        .userResponse
    : currentQuestion.userResponse;

  const sourceMaterialText = formatSourceMaterial(
    currentSubtopic.sourceMaterial ?? [],
  );

  const result = await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      temperature: 0.2,
      response_format: zodResponseFormat(EvaluationSchema, "evaluation"),
      messages: [
        {
          role: "system",
          content: `You are an expert tutor evaluating a student's understanding.
${sourceMaterialText ? `Use the provided course source material as your reference for what correct understanding looks like. Evaluate whether the student's response reflects the concepts taught in the course.${sourceMaterialText}` : ""}

Focus primarily on whether the student understands the important underlying concepts rather than exact wording, perfect terminology, or complete detail.

Scoring:
- "correct": the student demonstrates understanding of the core concept
- "partial": the student shows some conceptual understanding but has IMPORTANT gaps or confusion  
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

  if (isFollowup) {
    const lastFollowup = q.followups[q.followups.length - 1];
    lastFollowup.score = result.score;
    lastFollowup.feedback = result.feedback;
  } else {
    q.score = result.score;
    q.feedback = result.feedback;
  }

  return {
    subtopics: updatedSubtopics,
    pendingEvaluation: { score: result.score, feedback: result.feedback },
  };
}

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

  // Read score and feedback written by evaluatorLLMNode
  const { score, feedback } = state.pendingEvaluation!;

  // Need a mutable clone for consecutiveWrongCount update
  const updatedSubtopics = structuredClone(subtopics);
  const mutableQ =
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ];

  function getPendingGoto(): TutorState["pendingGoto"] {
    const totalSubtopics = updatedSubtopics.length;
    const totalMainQuestions =
      updatedSubtopics[currentSubtopicIndex].mainQuestions.length;

    if (isFollowup && score !== "correct") {
      mutableQ.consecutiveWrongCount += 1;
      if (mutableQ.consecutiveWrongCount < 2) return "followup";
    }

    if (!isFollowup && score !== "correct") return "followup";

    if (currentMainQuestionIndex + 1 < totalMainQuestions)
      return "next-question";
    if (currentSubtopicIndex + 1 < totalSubtopics) return "next-subtopic";
    return "session-end";
  }

  const pendingGoto = getPendingGoto();
  const isEncouragement =
    isFollowup && score !== "correct" && mutableQ.consecutiveWrongCount >= 2;

  interrupt({
    type: "feedback",
    score,
    feedback,
    isEncouragement,
    consecutiveWrongCount: mutableQ.consecutiveWrongCount,
    message: isEncouragement
      ? `${feedback}\n\nKeep going — let's move to the next question.`
      : feedback,
  });

  const skipClarification = pendingGoto === "followup";

  return new Command({
    goto: skipClarification ? "sessionRouter" : "clarificationAsker",
    update: {
      subtopics: updatedSubtopics,
      pendingGoto,
      pendingEvaluation: null,
      step: "asking-clarification",
    },
  });
}
