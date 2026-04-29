import { openai } from "@/lib/openai";
import { TutorState } from "@/lib/tutorState";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const SessionFeedbackSchema = z.object({
  sessionFeedback: z.string(),
  recommendations: z.array(z.string()).min(1).max(5),
});

export async function sessionEndNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  // Build a full history summary for the LLM
  const historyText = state.subtopics
    .map((subtopic) => {
      const questionsText = subtopic.mainQuestions
        .map((q, qi) => {
          const followupsText =
            q.followups.length > 0
              ? `\n  Followups:\n` +
                q.followups
                  .map(
                    (f, fi) =>
                      `    FQ${fi + 1}: ${f.question}\n    Response: ${f.userResponse}\n    Score: ${f.score} — ${f.feedback}`,
                  )
                  .join("\n")
              : "";
          return `  Q${qi + 1}: ${q.question}\n  Response: ${q.userResponse}\n  Score: ${q.score} — ${q.feedback}${followupsText}`;
        })
        .join("\n\n");
      return `Subtopic: ${subtopic.name}\n${questionsText}`;
    })
    .join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    response_format: zodResponseFormat(
      SessionFeedbackSchema,
      "session_feedback",
    ),
    messages: [
      {
        role: "system",
        content: `You are an expert tutor giving end-of-session feedback.
        Based on the student's full performance history, provide:
        1. sessionFeedback: A warm, encouraging summary (3-5 sentences) covering what they did well and where they struggled.
        2. recommendations: 1-5 specific, actionable things the student should study or practice next.`,
      },
      {
        role: "user",
        content: `Topic: ${state.topic}\n\nFull session history:\n${historyText}`,
      },
    ],
  });

  const { sessionFeedback, recommendations } = SessionFeedbackSchema.parse(
    JSON.parse(response.choices[0].message.content ?? "{}"),
  );

  return {
    sessionFeedback,
    recommendations,
    step: "session-complete",
  };
}
