import { mcpClient } from "@/lib/mcp/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const queries = body.queries ?? [];
    const limit = body.limit ?? 10;

    if (!Array.isArray(queries) || queries.length === 0) {
      return Response.json(
        {
          success: false,
          error: "queries array is required",
        },
        { status: 400 },
      );
    }

    const chunks = await mcpClient.searchDocumentChunks(queries, limit);

    return Response.json({
      success: true,
      chunks,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error: "Failed to search chunks",
      },
      { status: 500 },
    );
  }
}
