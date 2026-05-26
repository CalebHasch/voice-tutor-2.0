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
  content: string;
  chunk_index?: number;
  summary?: string | null;
  keywords?: string[] | null;

  // search results only
  document_title?: string;
  file_name?: string;
  file_type?: string;
  document_type?: string;
  similarity?: number;
  rrf_score?: number;
  import_id?: string;

  metadata?: {
    document_title?: string;
    has_embedding?: boolean;
    char_count?: number;
    [key: string]: unknown; // Header 2/3/4 keys are dynamic
  };
}

export interface SearchChunksResponse {
  result: DocumentChunk[];
}
