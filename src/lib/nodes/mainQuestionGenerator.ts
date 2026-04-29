import { openai } from "@/lib/openai";
import { TutorState, MainQuestion } from "@/lib/tutorState";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const MainQuestionsSchema = z.object({
  questions: z.array(z.string()).length(2),
});

export async function mainQuestionGeneratorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  // Generate 2 main questions for each subtopic that doesn't have them yet
  const updatedSubtopics = await Promise.all(
    state.subtopics.map(async (subtopic) => {
      if (subtopic.mainQuestions.length > 0) return subtopic;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        response_format: zodResponseFormat(
          MainQuestionsSchema,
          "main_questions",
        ),
        messages: [
          {
            role: "system",
            content: `You are an expert tutor. Generate exactly 2 comprehensive questions 
            to test a student's understanding of the given subtopic. 
            Questions should require explanation, not just yes/no answers.
            They should cover the most important concepts of the subtopic.`,
          },
          {
            role: "user",
            content: `Topic: ${state.topic}\nSubtopic: ${subtopic.name}`,
          },
        ],
      });

      const parsed = MainQuestionsSchema.parse(
        JSON.parse(response.choices[0].message.content ?? "{}"),
      );

      const mainQuestions: MainQuestion[] = parsed.questions.map((q) => ({
        question: q,
        userResponse: "",
        feedback: "",
        score: "incorrect" as const,
        consecutiveWrongCount: 0,
        followups: [],
      }));

      return { ...subtopic, mainQuestions };
    }),
  );

  return {
    subtopics: updatedSubtopics,
    step: "asking-main",
    currentSubtopicIndex: 0,
    currentMainQuestionIndex: 0,
  };
}
