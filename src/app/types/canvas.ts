export interface CanvasModuleItem {
  id: string;
  title: string;
  position: number;
  content_type: string;
  content: string | null;
  document_id: string;
}

export interface CanvasModule {
  id: string;
  title: string;
  position: number;
  module_items: CanvasModuleItem[];
}

export interface CanvasCourse {
  id: string;
  title: string;
  course_code?: string;
}
