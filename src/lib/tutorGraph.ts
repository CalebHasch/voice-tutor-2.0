import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { TutorAnnotation } from "./tutorState";
import { subtopicGeneratorNode } from "./nodes/subtopicGenerator";
import { mainQuestionGeneratorNode } from "./nodes/mainQuestionGenerator";
import { sessionRouterNode } from "./nodes/sessionRouter";
import { evaluatorNode } from "./nodes/evaluator";
import { followupGeneratorNode } from "./nodes/followupGenerator";
import { sessionEndNode } from "./nodes/sessionEnd";

const checkpointer = new MemorySaver();

export const tutorGraph = new StateGraph(TutorAnnotation)
  .addNode("subtopicGenerator", subtopicGeneratorNode)
  .addNode("mainQuestionGenerator", mainQuestionGeneratorNode)
  .addNode("sessionRouter", sessionRouterNode, { ends: ["evaluator"] })
  .addNode("evaluator", evaluatorNode, {
    ends: ["sessionRouter", "followupGenerator", "sessionEnd"],
  })
  .addNode("followupGenerator", followupGeneratorNode)
  .addNode("sessionEnd", sessionEndNode)

  // Initial flow
  .addEdge(START, "subtopicGenerator")
  .addEdge("subtopicGenerator", "mainQuestionGenerator")
  .addEdge("mainQuestionGenerator", "sessionRouter")

  // After generating a followup, go back to router to ask it
  .addEdge("followupGenerator", "sessionRouter")

  // evaluator and sessionFeedback use Command for dynamic routing (no edges needed)

  .addEdge("sessionEnd", END)
  .compile({ checkpointer });
