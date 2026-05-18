import { mcpClient } from "@/lib/mcp/client";

export async function GET() {
  try {
    const courses = await mcpClient.getCourses();

    return Response.json({
      success: true,
      courses,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error: "Failed to fetch courses",
      },
      { status: 500 },
    );
  }
}
