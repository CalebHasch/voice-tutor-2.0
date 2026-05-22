export type JsonRpcResponse<T = unknown> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export interface MCPToolResponse<T> {
  _meta?: unknown;
  content?: unknown[];
  structuredContent?: {
    result: T;
  };
}

export type CanvasCourse = {
  id: string;
  name?: string;
  course_code?: string;
  [key: string]: unknown;
};

export type CanvasModule = {
  id: string;
  name?: string;
  items?: unknown[];
  [key: string]: unknown;
};
export interface DocumentChunk {
  id?: string;
  chunk_id?: string;
  document_id: string;
  import_id: string;
  content: string;
  summary: string;
  keywords: string[];
  document_title: string;
  file_name: string;
  file_type: string;
  document_type: string;
  similarity: number;
  rrf_score: number;
}

export interface SearchChunksResponse {
  result: DocumentChunk[];
}
