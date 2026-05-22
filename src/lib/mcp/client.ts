import {
  JsonRpcResponse,
  CanvasCourse,
  CanvasModule,
  MCPToolResponse,
  DocumentChunk,
} from "./types";

class MCPClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.MCP_BASE_URL!;
    this.token = process.env.MCP_ACCESS_TOKEN!;

    if (!this.baseUrl) {
      throw new Error("Missing MCP_BASE_URL");
    }

    if (!this.token) {
      throw new Error("Missing MCP_ACCESS_TOKEN");
    }
  }

  private async request<T>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status}`);
    }

    const rawText = await response.text();

    const dataLine = rawText
      .split("\n")
      .find((line) => line.startsWith("data:"));

    if (!dataLine) {
      throw new Error("No data line found in MCP response");
    }

    const jsonString = dataLine.replace(/^data:\s*/, "");

    const data: JsonRpcResponse<T> = JSON.parse(jsonString);

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result as T;
  }

  async callTool<T>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    return this.request<T>("tools/call", {
      name,
      arguments: args,
    });
  }

  async getCourses(): Promise<CanvasCourse[]> {
    const response = await this.callTool<MCPToolResponse<CanvasCourse[]>>(
      "get_canvas_template_courses",
    );
    const all = response?.structuredContent?.result ?? [];
    // Temporary: only show courses that have been fully processed
    const PROCESSED_COURSE_IDS = ["211"];
    return all.filter((course) => PROCESSED_COURSE_IDS.includes(course.id));
  }

  async getModules(courseId: string): Promise<CanvasModule[]> {
    const response = await this.callTool<MCPToolResponse<CanvasModule[]>>(
      "get_canvas_template_modules",
      {
        course_id: courseId,
        include_item_content: false,
      },
    );

    return response.structuredContent?.result ?? [];
  }

  // This grabs all chunks for a given document
  async getChunksForDocument(documentId: string): Promise<DocumentChunk[]> {
    const response = await this.callTool<MCPToolResponse<DocumentChunk[]>>(
      "get_chunks_for_document",
      { document_id: documentId },
    );
    return response.structuredContent?.result ?? [];
  }

  // This performs a semantic search across all documents and returns the most relevant chunks
  async searchDocumentChunks(
    queries: string[],
    limit = 10,
  ): Promise<DocumentChunk[]> {
    const response = await this.callTool<MCPToolResponse<DocumentChunk[]>>(
      "search_document_chunks",
      {
        queries,
        limit,
      },
    );

    console.log(JSON.stringify(response, null, 2));

    return response.structuredContent?.result ?? [];
  }
}

export const mcpClient = new MCPClient();
