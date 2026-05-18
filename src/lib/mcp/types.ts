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
