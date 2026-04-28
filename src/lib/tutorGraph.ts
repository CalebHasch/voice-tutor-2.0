import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { TutorAnnotation, TutorState } from "./tutorState";
import { openai } from "@/lib/openai";

const checkpointer = new MemorySaver();

async function subtopicGeneratorNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert tutor. Given a topic, return a JSON object with a 
        "subtopics" array of 4-8 subtopic name strings that comprehensively cover the topic.
        Example: { "subtopics": ["Variables and Types", "Control Flow", ...] }`,
      },
      {
        role: "user",
        content: `Topic: ${state.topic}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content ?? "{}");

  const subtopics = (parsed.subtopics as string[]).map((name) => ({
    name,
    mainQuestions: [],
  }));

  return {
    subtopics,
    step: "subtopic-generation",
  };
}

export const tutorGraph = new StateGraph(TutorAnnotation)
  .addNode("subtopicGenerator", subtopicGeneratorNode)
  .addEdge(START, "subtopicGenerator")
  .addEdge("subtopicGenerator", END)
  .compile({ checkpointer });
