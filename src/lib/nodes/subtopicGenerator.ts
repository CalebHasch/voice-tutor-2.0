import { openai } from "@/lib/openai";
import { Subtopic, TutorState } from "@/lib/tutorState";
import { interrupt } from "@langchain/langgraph";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const SubtopicResponseSchema = z.object({
  subtopics: z.array(z.string()).min(4).max(8),
});

export async function subtopicGeneratorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    response_format: zodResponseFormat(
      SubtopicResponseSchema,
      "subtopic_response",
    ),
    messages: [
      {
        role: "system",
        content: `You are an expert tutor. Given a topic, return 4-8 subtopic names 
        that comprehensively cover the topic for a learner.`,
      },
      { role: "user", content: `Topic: ${state.topic}` },
    ],
  });

  const parsed = SubtopicResponseSchema.parse(
    JSON.parse(response.choices[0].message.content ?? "{}"),
  );

  const allSubtopics = parsed.subtopics.map((name) => ({
    name,
    mainQuestions: [],
  }));

  return {
    allSubtopics,
    step: "subtopic-generation",
  };
}

export async function subtopicSelectorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const subtopicNames = state.allSubtopics.map((s: Subtopic) => s.name);

  const selectedNames: string[] = interrupt({
    type: "subtopic-selection",
    message:
      "Here are the subtopics for this session. Please select 1–4 to focus on.",
    subtopics: subtopicNames,
  });

  const selectedSubtopics = state.allSubtopics.filter((s: Subtopic) =>
    selectedNames.includes(s.name),
  );

  return {
    subtopics: selectedSubtopics,
    step: "main-question-generation",
  };
}
