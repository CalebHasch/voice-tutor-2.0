import { DocumentChunk } from "@/lib/mcp/types";

export function formatSourceMaterial(chunks: DocumentChunk[]): string {
  if (!chunks.length) return "";
  const formatted = chunks
    .map((c, i) => {
      const text = c.summary ?? c.content;
      return `[${i + 1}] ${text.trim()}`;
    })
    .join("\n\n");
  return `\n\nCourse source material for this subtopic:\n${formatted}`;
}
