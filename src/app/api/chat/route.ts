import { tutorGraph } from "@/lib/tutorGraph";
import { TutorState } from "@/lib/tutorState";

export async function POST(req: Request) {
  const body = await req.json();

  const inputState: Partial<TutorState> = {
    topic: body.topic,
    step: body.step ?? "subtopic-generation",
    subtopics: body.subtopics ?? [],
    currentSubtopicIndex: body.currentSubtopicIndex ?? 0,
    currentMainQuestionIndex: body.currentMainQuestionIndex ?? 0,
    sessionFeedback: body.sessionFeedback ?? "",
    recommendations: body.recommendations ?? [],
  };

  const result = await tutorGraph.invoke(inputState, {
    configurable: { thread_id: body.threadId },
  });

  return Response.json(result);
}
