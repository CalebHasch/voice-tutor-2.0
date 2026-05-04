import { tutorGraph } from "@/lib/tutorGraph";
import { TutorState } from "@/lib/tutorState";
import { Command } from "@langchain/langgraph";

export async function POST(req: Request) {
  const body = await req.json();
  const config = { configurable: { thread_id: body.threadId } };

  let result;

  try {
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
  } catch (err) {
    console.error("Graph error:", err);
    return Response.json(
      { error: true, message: "Something went wrong" },
      { status: 200 },
    );
    // Note: return 200 so the frontend gets JSON, not an HTML error page
  }

  console.log("\n===== TUTOR GRAPH STATE =====");
  console.log("step:", result.step);
  console.log("currentSubtopicIndex:", result.currentSubtopicIndex);
  console.log("currentMainQuestionIndex:", result.currentMainQuestionIndex);
  console.log("subtopics:", JSON.stringify(result.subtopics, null, 2));

  // If the graph hit an interrupt, surface it to the frontend
  const interrupted = (result as any).__interrupt__; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (interrupted?.length > 0) {
    console.log("interrupt:", JSON.stringify(interrupted[0].value, null, 2));
  }
  console.log("=============================\n");

  if (interrupted?.length > 0) {
    return Response.json({
      interrupted: true,
      interrupt: interrupted[0].value,
      step: result.step,
      subtopics: result.subtopics,
      currentSubtopicIndex: result.currentSubtopicIndex,
      currentMainQuestionIndex: result.currentMainQuestionIndex,
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
