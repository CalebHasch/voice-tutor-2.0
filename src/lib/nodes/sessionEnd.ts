import { openai } from "@/lib/openai";
import { TutorState, Subtopic, MainQuestion } from "@/lib/tutorState";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const SessionFeedbackSchema = z.object({
  sessionFeedback: z.string(),
  recommendations: z.array(z.string()).min(1).max(5),
});

type WeakArea = {
  subtopic: string;
  lessonTitle: string;
  conceptsStruggled: string[];
};

function extractWeakAreas(subtopics: Subtopic[]): WeakArea[] {
  return subtopics
    .map((subtopic) => {
      const conceptsStruggled: string[] = [];

      subtopic.mainQuestions.forEach((q: MainQuestion) => {
        if (q.score !== "correct") {
          conceptsStruggled.push(
            `Question: ${q.question} | Student response: ${q.userResponse} | Feedback: ${q.feedback}`,
          );
        }
        q.followups.forEach((f) => {
          if (f.score !== "correct") {
            conceptsStruggled.push(
              `Follow-up: ${f.question} | Student response: ${f.userResponse} | Feedback: ${f.feedback}`,
            );
          }
        });
      });

      const lessonTitle =
        subtopic.sourceMaterial?.[0]?.document_title ??
        (subtopic.sourceMaterial?.[0]?.metadata?.document_title as string) ??
        subtopic.name;

      return { subtopic: subtopic.name, lessonTitle, conceptsStruggled };
    })
    .filter((area) => area.conceptsStruggled.length > 0);
}

function buildCorrectSummary(subtopics: Subtopic[]): string {
  const correct: string[] = [];
  subtopics.forEach((subtopic) => {
    subtopic.mainQuestions.forEach((q: MainQuestion) => {
      if (q.score === "correct")
        correct.push(`${subtopic.name}: ${q.question}`);
    });
  });
  return correct.length
    ? `Concepts answered correctly:\n${correct.map((c) => `- ${c}`).join("\n")}`
    : "";
}

export async function sessionEndNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const weakAreas = extractWeakAreas(state.subtopics);
  const correctSummary = buildCorrectSummary(state.subtopics);

  const weakAreasText =
    weakAreas.length > 0
      ? `Areas where the student struggled:\n${weakAreas
          .map(
            (area) =>
              `Subtopic: ${area.subtopic} (lesson: "${area.lessonTitle}")\n${area.conceptsStruggled.map((c) => `  - ${c}`).join("\n")}`,
          )
          .join("\n\n")}`
      : "The student answered all questions correctly.";

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

Analyze the student's performance and provide:

1. sessionFeedback: A warm, encouraging 3-5 sentence summary. Acknowledge what they did well if applicable, then address the common threads or patterns in what they struggled with — not a list of every mistake, but a honest synthesis.

2. recommendations: Specific, actionable study recommendations based ONLY on what the student got wrong or partially correct. 
   - Make the list as short and efficient as possible - the student has limited time and should focus on what is most important to work on for them.  
   - Identify the common underlying concepts or themes across their mistakes
   - Give at MOST 2 recommendations per distinct concept or common thread
   - Point back to specific lessons if applicable ("Review the lesson X where you struggled with Y concept")
   - If the student got everything correct, return 1 recommendation telling what concept(s) they should move onto.
   `,
      },
      {
        role: "user",
        content: `Topic: ${state.topic}\n\n${correctSummary}\n\n${weakAreasText}`,
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
