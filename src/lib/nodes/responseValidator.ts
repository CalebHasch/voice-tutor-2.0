import { openai } from "@/lib/openai";
import { TutorState } from "@/lib/tutorState";
import { Command, interrupt } from "@langchain/langgraph";
import { withRetry } from "@/lib/withRetry";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const ValidationSchema = z.object({
  isComplete: z.boolean(),
});

export async function responseValidatorNode(
  state: TutorState,
): Promise<Command> {
  const { subtopics, currentSubtopicIndex, currentMainQuestionIndex } = state;
  const currentQuestion =
    subtopics[currentSubtopicIndex].mainQuestions[currentMainQuestionIndex];

  // Get the response that needs validation — could be a main or followup answer
  const isFollowup =
    currentQuestion.followups.length > 0 &&
    currentQuestion.followups[currentQuestion.followups.length - 1]
      .userResponse !== "" &&
    currentQuestion.followups[currentQuestion.followups.length - 1].feedback ===
      "";

  const pendingResponse = isFollowup
    ? currentQuestion.followups[currentQuestion.followups.length - 1]
        .userResponse
    : currentQuestion.userResponse;

  const { isComplete } = await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: zodResponseFormat(ValidationSchema, "validation"),
      messages: [
        {
          role: "system",
          content: `You are checking whether a student's spoken response appears complete 
          or whether it was likely cut off mid-sentence. 
          Return isComplete: true if the response forms a complete thought, 
          even if brief or imperfect.
          Return isComplete: false only if it clearly ends mid-sentence or mid-word,
          like "I think the reason is because the com" or "it works by using a".
          Err on the side of true — short answers are usually complete, not cut off.`,
        },
        {
          role: "user",
          content: `Student response: "${pendingResponse}"`,
        },
      ],
    });

    return ValidationSchema.parse(
      JSON.parse(response.choices[0].message.content ?? "{}"),
    );
  });

  if (isComplete) {
    return new Command({ goto: "evaluator" });
  }

  interrupt({
    type: "incomplete-response",
    message:
      "Your response seemed to get cut off! Try answering again — you can increase the silence timeout in the settings, or type your answer instead.",
  });

  const newResponse: string = interrupt({
    type: "question",
    questionType: isFollowup ? "followup" : "main",
    subtopic: subtopics[currentSubtopicIndex].name,
    question: isFollowup
      ? currentQuestion.followups[currentQuestion.followups.length - 1].question
      : currentQuestion.question,
  });

  // Write the new response to state
  const updatedSubtopics = structuredClone(subtopics);
  const q =
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ];

  if (isFollowup) {
    q.followups[q.followups.length - 1].userResponse = newResponse;
  } else {
    q.userResponse = newResponse;
  }

  // After the user acknowledges, go back to sessionRouter to re-ask
  return new Command({
    goto: "evaluator",
    update: { step: state.pendingStep },
  });
}
