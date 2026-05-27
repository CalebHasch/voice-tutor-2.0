import { openai } from "@/lib/openai";
import { TutorState } from "@/lib/tutorState";
import { Command } from "@langchain/langgraph";
import { withRetry } from "@/lib/withRetry";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const DetectionSchema = z.object({
  isClarification: z.boolean(),
});

export async function interruptDetectorNode(
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

  const { isClarification } = await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: zodResponseFormat(DetectionSchema, "detection"),
      messages: [
        {
          role: "system",
          content: `You are checking whether a student's spoken response is either a clarifying question or a statement.
          Return isClarification: true if the response is asking a question or for help
          Return isClarification: false if the response is a direct answer or a statement.
          Err on the side of false if the response is unclear.`,
        },
        { role: "user", content: `Student response: "${pendingResponse}"` },
      ],
    });
    return DetectionSchema.parse(
      JSON.parse(response.choices[0].message.content ?? "{}"),
    );
  });

  if (!isClarification) {
    return new Command({ goto: "evaluatorLLM" });
  } else {
    return new Command({
      goto: "clarificationLLM",
      update: {
        validationPending: false,
        pendingClarification: pendingResponse,
        clarificationSource: "mid-question",
      },
    });
  }
}
