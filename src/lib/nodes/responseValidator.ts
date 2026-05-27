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
          Return isComplete: true if the response forms a complete thought, even if brief or imperfect.
          Return isComplete: false only if it clearly ends mid-sentence or mid-word.
          Err on the side of true — short answers are usually complete, not cut off.`,
        },
        { role: "user", content: `Student response: "${pendingResponse}"` },
      ],
    });
    return ValidationSchema.parse(
      JSON.parse(response.choices[0].message.content ?? "{}"),
    );
  });

  if (isComplete) {
    return new Command({ goto: "interruptDetector" });
  }

  // Incomplete — notify user then hand off to retry node
  interrupt({
    type: "incomplete-response",
    message:
      "Your response seemed to get cut off! Try answering again — you can increase the silence timeout in the settings, turn off auto-send mode, or type your answer instead.",
  });

  return new Command({
    goto: "responseRetry",
    update: { validationPending: false },
  });
}

export async function responseRetryNode(state: TutorState): Promise<Command> {
  const { subtopics, currentSubtopicIndex, currentMainQuestionIndex } = state;
  const currentQuestion =
    subtopics[currentSubtopicIndex].mainQuestions[currentMainQuestionIndex];

  const isFollowup =
    currentQuestion.followups.length > 0 &&
    currentQuestion.followups[currentQuestion.followups.length - 1].feedback ===
      "";

  const newResponse: string = interrupt({
    type: "question",
    questionType: isFollowup ? "followup" : "main",
    subtopic: subtopics[currentSubtopicIndex].name,
    question: isFollowup
      ? currentQuestion.followups[currentQuestion.followups.length - 1].question
      : currentQuestion.question,
  });

  // Write fresh answer — this node owns the write so no stale checkpoint issue
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

  return new Command({
    goto: "evaluatorLLM",
    update: { subtopics: updatedSubtopics },
  });
}
