import { openai } from "@/lib/openai";
import { TutorState, MainQuestion } from "@/lib/tutorState";
import { formatSourceMaterial } from "@/utils/formatSourceMaterial";
import { zodResponseFormat } from "openai/helpers/zod";
import { withRetry } from "@/lib/withRetry";
import { z } from "zod";

const MainQuestionsSchema = z.object({
  questions: z.array(z.string()).length(2),
});

export async function mainQuestionGeneratorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const updatedSubtopics = await Promise.all(
    state.subtopics.map(async (subtopic) => {
      if (subtopic.mainQuestions.length > 0) return subtopic;

      const sourceMaterialText = formatSourceMaterial(
        subtopic.sourceMaterial ?? [],
      );

      const response = await withRetry(async () => {
        const res = await openai.chat.completions.create({
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
            They should cover the most important concepts of the subtopic.
            Each should be able to be answered verbally in 1-3 sentences.
            ${sourceMaterialText ? "Base your questions on the provided source material — focus on concepts actually covered in the course content." : ""}`,
            },
            {
              role: "user",
              content: `Topic: ${state.topic}\nSubtopic: ${subtopic.name}${sourceMaterialText}`,
            },
          ],
        });
        return MainQuestionsSchema.parse(
          JSON.parse(res.choices[0].message.content ?? "{}"),
        );
      });

      const mainQuestions: MainQuestion[] = response.questions.map((q) => ({
        question: q,
        userResponse: "",
        feedback: "",
        score: "incorrect" as const,
        consecutiveWrongCount: 0,
        followups: [],
        clarifications: [],
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
