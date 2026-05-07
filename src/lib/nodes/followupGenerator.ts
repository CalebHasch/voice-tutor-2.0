import { openai } from "@/lib/openai";
import { TutorState, FollowUp } from "@/lib/tutorState";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const FollowupSchema = z.object({
  question: z.string(),
});

export async function followupGeneratorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const { subtopics, currentSubtopicIndex, currentMainQuestionIndex } = state;
  const currentSubtopic = subtopics[currentSubtopicIndex];
  const currentQuestion =
    currentSubtopic.mainQuestions[currentMainQuestionIndex];

  // Build context from prior attempts for a targeted followup
  const priorAttempts = [
    {
      question: currentQuestion.question,
      response: currentQuestion.userResponse,
      feedback: currentQuestion.feedback,
    },
    ...currentQuestion.followups.map((f) => ({
      question: f.question,
      response: f.userResponse,
      feedback: f.feedback,
    })),
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    response_format: zodResponseFormat(FollowupSchema, "followup"),
    messages: [
      {
        role: "system",
        content: `You are an expert tutor. The student struggled with a question. 
        Generate a follow-up question that targets the specific concept they misunderstood.
        The followup should be simpler and more targeted than the original question.
        Do not repeat a question they already answered. 
        They should be able to answer it in 1-2 sentences if they understood the concept correctly.`,
      },
      {
        role: "user",
        content: `Topic: ${state.topic}
Subtopic: ${currentSubtopic.name}
Prior attempts:
${priorAttempts.map((a, i) => `Q${i + 1}: ${a.question}\nResponse: ${a.response}\nFeedback: ${a.feedback}`).join("\n\n")}`,
      },
    ],
  });

  const { question } = FollowupSchema.parse(
    JSON.parse(response.choices[0].message.content ?? "{}"),
  );

  const newFollowup: FollowUp = {
    question,
    userResponse: "",
    feedback: "",
    score: "incorrect",
  };

  const updatedSubtopics = structuredClone(subtopics);
  updatedSubtopics[currentSubtopicIndex].mainQuestions[
    currentMainQuestionIndex
  ].followups.push(newFollowup);

  return {
    subtopics: updatedSubtopics,
    step: "asking-followup",
  };
}
