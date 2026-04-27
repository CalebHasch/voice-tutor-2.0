import { StateGraph } from "@langchain/langgraph";

type State = {
  messages: any[];
};

export const graph = new StateGraph<State>();

graph.addNode("model", async (state) => {
  // later: call OpenAI here
  return state;
});

graph.setEntryPoint("model");
graph.setFinishPoint("model");

export const app = graph.compile();
