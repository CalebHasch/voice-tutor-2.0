import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { TutorAnnotation } from "./tutorState";
import {
  subtopicGeneratorNode,
  subtopicSelectorNode,
} from "./nodes/subtopicGenerator";
import { mainQuestionGeneratorNode } from "./nodes/mainQuestionGenerator";
import { responseValidatorNode } from "./nodes/responseValidator";
import { sessionRouterNode } from "./nodes/sessionRouter";
import { evaluatorNode } from "./nodes/evaluator";
import { followupGeneratorNode } from "./nodes/followupGenerator";
import { sessionEndNode } from "./nodes/sessionEnd";

const checkpointer = new MemorySaver();

export const tutorGraph = new StateGraph(TutorAnnotation)
  .addNode("subtopicGenerator", subtopicGeneratorNode)
  .addNode("subtopicSelector", subtopicSelectorNode)
  .addNode("mainQuestionGenerator", mainQuestionGeneratorNode)
  .addNode("responseValidator", responseValidatorNode, {
    ends: ["evaluator", "sessionRouter"],
  })
  .addNode("sessionRouter", sessionRouterNode, { ends: ["responseValidator"] })
  .addNode("evaluator", evaluatorNode, {
    ends: ["sessionRouter", "followupGenerator", "sessionEnd"],
  })
  .addNode("followupGenerator", followupGeneratorNode)
  .addNode("sessionEnd", sessionEndNode)

  // Initial flow
  .addEdge(START, "subtopicGenerator")
  .addEdge("subtopicGenerator", "subtopicSelector")
  .addEdge("subtopicSelector", "mainQuestionGenerator")

  // Question flow (handled by sessionRouter)
  .addEdge("mainQuestionGenerator", "sessionRouter")
  .addEdge("followupGenerator", "sessionRouter")

  // evaluator and sessionFeedback use Command for dynamic routing (no edges needed)

  .addEdge("sessionEnd", END)
  .compile({ checkpointer });
