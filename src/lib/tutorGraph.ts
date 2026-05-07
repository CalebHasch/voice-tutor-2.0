import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { TutorAnnotation } from "./tutorState";
import {
  subtopicGeneratorNode,
  subtopicSelectorNode,
} from "./nodes/subtopicGenerator";
import { mainQuestionGeneratorNode } from "./nodes/mainQuestionGenerator";
import {
  responseValidatorNode,
  responseRetryNode,
} from "./nodes/responseValidator";
import { sessionRouterNode } from "./nodes/sessionRouter";
import { evaluatorNode } from "./nodes/evaluator";
import { clarificationAskerNode } from "./nodes/clarificationAsker";
import { clarificationResponderNode } from "./nodes/clarificationResponder";
import { followupGeneratorNode } from "./nodes/followupGenerator";
import { sessionEndNode } from "./nodes/sessionEnd";

const checkpointer = new MemorySaver();

export const tutorGraph = new StateGraph(TutorAnnotation)
  .addNode("subtopicGenerator", subtopicGeneratorNode)
  .addNode("subtopicSelector", subtopicSelectorNode)
  .addNode("mainQuestionGenerator", mainQuestionGeneratorNode)

  // Decision routing nodes
  .addNode("responseValidator", responseValidatorNode, {
    ends: ["evaluator", "responseRetry"],
  })
  .addNode("responseRetry", responseRetryNode, { ends: ["evaluator"] })
  .addNode("sessionRouter", sessionRouterNode, {
    ends: [
      "responseValidator",
      "followupGenerator",
      "sessionEnd",
      "sessionRouter",
    ],
  })
  .addNode("evaluator", evaluatorNode, { ends: ["clarificationAsker"] })
  .addNode("clarificationAsker", clarificationAskerNode, {
    ends: ["sessionRouter", "clarificationResponder"],
  })
  .addNode("clarificationResponder", clarificationResponderNode)

  .addNode("followupGenerator", followupGeneratorNode)
  .addNode("sessionEnd", sessionEndNode)

  // Initial flow
  .addEdge(START, "subtopicGenerator")
  .addEdge("subtopicGenerator", "subtopicSelector")
  .addEdge("subtopicSelector", "mainQuestionGenerator")

  // Question flow (handled by sessionRouter)
  .addEdge("mainQuestionGenerator", "sessionRouter")
  .addEdge("followupGenerator", "sessionRouter")
  .addEdge("clarificationResponder", "sessionRouter")

  // evaluator and sessionFeedback use Command for dynamic routing (no edges needed)

  .addEdge("sessionEnd", END)
  .compile({ checkpointer });
