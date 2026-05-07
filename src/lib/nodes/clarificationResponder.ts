import { openai } from "@/lib/openai";
import { TutorState, ClarificationEntry } from "@/lib/tutorState";
import { withRetry } from "@/lib/withRetry";
import { interrupt } from "@langchain/langgraph/web";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const ClarificationSchema = z.object({ answer: z.string() });

export async function clarificationResponderNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const { subtopics, currentSubtopicIndex, currentMainQuestionIndex } = state;
  const currentSubtopic = subtopics[currentSubtopicIndex];
  const currentQuestion =
    currentSubtopic.mainQuestions[currentMainQuestionIndex];

  // Guard against re-run: if already answered, skip LLM call
  const alreadyAnswered = state.pendingClarification === "";
  let answer: string;

  if (alreadyAnswered) {
    // Read from last clarification entry
    const last =
      currentQuestion.clarifications[currentQuestion.clarifications.length - 1];
    answer = last.answer;
  } else {
    const result = await withRetry(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        response_format: zodResponseFormat(
          ClarificationSchema,
          "clarification",
        ),
        messages: [
          {
            role: "system",
            content: `You are an expert tutor answering a student's clarifying question.
            Give a clear, concise answer (2-4 sentences) targeted at the concept they asked about.
            Be encouraging and try to relate the answer back to the question they were just working on if applicable.`,
          },
          {
            role: "user",
            content: `Topic: ${state.topic}
Subtopic: ${currentSubtopic.name}
Question the student was working on: ${currentQuestion.question}
Student's clarifying question: ${state.pendingClarification}`,
          },
        ],
      });
      return ClarificationSchema.parse(
        JSON.parse(response.choices[0].message.content ?? "{}"),
      );
    });
    answer = result.answer;
  }

  // Save to history
  const updatedSubtopics = structuredClone(subtopics);
  const q =
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ];
  const entry: ClarificationEntry = {
    question: state.pendingClarification,
    answer,
  };
  q.clarifications.push(entry);

  interrupt({
    type: "clarification-answer",
    answer,
  });

  return {
    subtopics: updatedSubtopics,
    pendingClarification: "",
    step: "asking-clarification",
  };
}
