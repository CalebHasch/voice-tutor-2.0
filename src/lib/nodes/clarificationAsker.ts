import { Command, interrupt } from "@langchain/langgraph";

export async function clarificationAskerNode(): Promise<Command> {
  const userInput: string = interrupt({
    type: "clarification-prompt",
    message:
      "Do you have any questions about this concept or should we move on?",
  });

  if (userInput === "__skip__") {
    return new Command({
      goto: "sessionRouter",
      update: { step: "asking-clarification" },
    });
  }

  return new Command({
    goto: "clarificationLLM",
    update: {
      step: "asking-clarification",

      pendingClarification: userInput,
      clarificationSource: "end-of-thread",
    },
  });
}
