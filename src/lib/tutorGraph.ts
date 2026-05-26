import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { TutorAnnotation } from "./tutorState";
import {
  subtopicGeneratorNode,
  subtopicSelectorNode,
} from "./nodes/subtopicGenerator";
import { contextFetcherNode } from "./nodes/contextFetcherNode";
import { mainQuestionGeneratorNode } from "./nodes/mainQuestionGenerator";
import {
  responseValidatorNode,
  responseRetryNode,
} from "./nodes/responseValidator";
import { interruptDetectorNode } from "./nodes/interruptDetector";
import { sessionRouterNode } from "./nodes/sessionRouter";
import { evaluatorNode } from "./nodes/evaluator";
import { clarificationAskerNode } from "./nodes/clarificationAsker";
import {
  clarificationResponderNode,
  clarificationLLMNode,
} from "./nodes/clarificationResponder";
import { followupGeneratorNode } from "./nodes/followupGenerator";
import { sessionEndNode } from "./nodes/sessionEnd";

const checkpointer = new MemorySaver();

export const tutorGraph = new StateGraph(TutorAnnotation)
  .addNode("subtopicGenerator", subtopicGeneratorNode)
  .addNode("subtopicSelector", subtopicSelectorNode)
  .addNode("contextFetcher", contextFetcherNode)
  .addNode("mainQuestionGenerator", mainQuestionGeneratorNode)

  // Decision routing nodes
  .addNode("responseValidator", responseValidatorNode, {
    ends: ["interruptDetector", "responseRetry"],
  })
  .addNode("interruptDetector", interruptDetectorNode, {
    ends: ["evaluator", "clarificationLLM"],
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
    ends: ["sessionRouter", "clarificationLLM", "sessionEnd"],
  })
  .addNode("clarificationLLM", clarificationLLMNode)
  .addNode("clarificationResponder", clarificationResponderNode, {
    ends: ["sessionRouter"],
  })

  .addNode("followupGenerator", followupGeneratorNode)
  .addNode("sessionEnd", sessionEndNode)

  // Initial flow
  .addEdge(START, "subtopicGenerator")
  .addEdge("subtopicGenerator", "subtopicSelector")
  .addEdge("subtopicSelector", "contextFetcher")
  .addEdge("contextFetcher", "mainQuestionGenerator")

  // Question flow (handled by sessionRouter)
  .addEdge("mainQuestionGenerator", "sessionRouter")
  .addEdge("followupGenerator", "sessionRouter")
  .addEdge("clarificationLLM", "clarificationResponder")

  // other nodes use Command for dynamic routing (no edges needed)

  .addEdge("sessionEnd", END)
  .compile({ checkpointer });
