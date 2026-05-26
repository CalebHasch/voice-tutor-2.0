import { openai } from "@/lib/openai";
import { TutorState, ClarificationEntry } from "@/lib/tutorState";
import { Command, interrupt } from "@langchain/langgraph";
import { withRetry } from "@/lib/withRetry";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const ClarificationSchema = z.object({ answer: z.string() });

export async function clarificationLLMNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const { subtopics, currentSubtopicIndex, currentMainQuestionIndex } = state;
  const currentSubtopic = subtopics[currentSubtopicIndex];
  const currentQuestion =
    currentSubtopic.mainQuestions[currentMainQuestionIndex];

  console.log(
    "Running clarificationLLMNode with pendingClarification:",
    state.pendingClarification,
  );

  // Already ran — answer is saved in the last clarification entry
  if (state.pendingClarification === "") {
    const last =
      currentQuestion.clarifications[currentQuestion.clarifications.length - 1];
    return {
      pendingClarificationAnswer: last?.answer ?? "",
    };
  }

  const result = await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      response_format: zodResponseFormat(ClarificationSchema, "clarification"),
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

  // Save to clarification history and clear pendingClarification
  const updatedSubtopics = structuredClone(subtopics);
  const q =
    updatedSubtopics[currentSubtopicIndex].mainQuestions[
      currentMainQuestionIndex
    ];
  const entry: ClarificationEntry = {
    question: state.pendingClarification,
    answer: result.answer,
  };
  q.clarifications.push(entry);

  return {
    subtopics: updatedSubtopics,
    pendingClarification: "",
    pendingClarificationAnswer: result.answer,
  };
}

export async function clarificationResponderNode(
  state: TutorState,
): Promise<Command> {
  interrupt({
    type: "clarification-answer",
    answer: state.pendingClarificationAnswer,
  });

  if (state.clarificationSource === "mid-question") {
    // Student asked mid-question — re-ask the same question after answering
    return new Command({
      goto: "sessionRouter",
      update: {
        pendingClarificationAnswer: "",
        step: state.pendingStep ?? "asking-main",
      },
    });
  }

  // End-of-thread — proceed normally through sessionRouter
  return new Command({
    goto: "sessionRouter",
    update: {
      pendingClarificationAnswer: "",
      step: "asking-clarification",
    },
  });
}
