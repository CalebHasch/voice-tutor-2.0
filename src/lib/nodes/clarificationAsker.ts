import { Command, interrupt } from "@langchain/langgraph";

export async function clarificationAskerNode(): Promise<Command> {
  const userInput: string = interrupt({
    type: "clarification-prompt",
    message: "Do you have any questions about this topic before moving on?",
  });

  if (userInput === "__skip__") {
    return new Command({
      goto: "sessionRouter",
      update: { step: "asking-clarification" },
    });
  }

  return new Command({
    goto: "clarificationResponder",
    update: {
      step: "asking-clarification",
      pendingClarification: userInput,
    },
  });
}
