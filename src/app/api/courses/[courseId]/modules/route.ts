import { mcpClient } from "@/lib/mcp/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;

    const modules = await mcpClient.getModules(courseId);

    return Response.json({
      success: true,
      modules,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error: "Failed to fetch modules",
      },
      { status: 500 },
    );
  }
}
