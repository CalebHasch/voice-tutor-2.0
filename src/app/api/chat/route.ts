import { tutorGraph } from "@/lib/tutorGraph";
import { TutorState } from "@/lib/tutorState";
import { Command, isInterrupted } from "@langchain/langgraph";

export async function POST(req: Request) {
  const body = await req.json();
  const config = { configurable: { thread_id: body.threadId } };

  let result;

  if (body.resume !== undefined) {
    // Resuming from an interrupt — user provided input
    result = await tutorGraph.invoke(
      new Command({ resume: body.resume }),
      config,
    );
  } else {
    // Initial invocation — start a new session
    const inputState: Partial<TutorState> = {
      topic: body.topic,
      step: "subtopic-generation",
      subtopics: [],
      currentSubtopicIndex: 0,
      currentMainQuestionIndex: 0,
      sessionFeedback: "",
      recommendations: [],
    };
    result = await tutorGraph.invoke(inputState, config);
  }

  // If the graph hit an interrupt, surface it to the frontend
  const interrupted = (result as any).__interrupt__;
  if (interrupted?.length > 0) {
    return Response.json({
      interrupted: true,
      interrupt: interrupted[0].value,
      step: result.step,
    });
  }

  // Session complete
  return Response.json({
    interrupted: false,
    step: result.step,
    sessionFeedback: result.sessionFeedback,
    recommendations: result.recommendations,
    subtopics: result.subtopics,
  });
}
