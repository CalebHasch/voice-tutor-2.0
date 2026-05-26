import { sessionEndNode } from "@/lib/nodes/sessionEnd";
import { TutorState } from "@/lib/tutorState";

export async function POST(req: Request) {
  const body = await req.json();

  // Accept a partial state — fill in required fields with defaults
  const mockState: TutorState = {
    step: "session-complete",
    pendingStep: null,
    topic: body.topic ?? "Introduction to Python",
    moduleItems: [],
    allSubtopics: [],
    subtopics: body.subtopics,
    clarificationSource: "end-of-thread",
    pendingClarification: "",
    pendingGoto: "",
    currentSubtopicIndex: 0,
    currentMainQuestionIndex: 0,
    sessionFeedback: "",
    recommendations: [],
  };

  const result = await sessionEndNode(mockState);

  return Response.json(result);
}
