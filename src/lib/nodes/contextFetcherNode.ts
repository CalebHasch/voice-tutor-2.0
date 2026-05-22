import { TutorState } from "@/lib/tutorState";
import { mcpClient } from "@/lib/mcp/client";
import { DocumentChunk } from "@/lib/mcp/types";

const CHUNKS_PER_SUBTOPIC = 5;

function getChunkId(chunk: DocumentChunk): string {
  return chunk.chunk_id ?? chunk.id ?? "";
}

export async function contextFetcherNode(
  state: TutorState,
): Promise<Partial<TutorState>> {
  if (state.subtopics.length === 0) {
    return { subtopics: state.subtopics };
  }

  const claimedChunkIds = new Set<string>();
  const subtopicsWithMaterial: typeof state.subtopics = [];

  for (const subtopic of state.subtopics) {
    let chunks: DocumentChunk[] = [];

    if (subtopic.documentId) {
      const allChunks = await mcpClient.getChunksForDocument(
        subtopic.documentId,
      );

      if (allChunks.length > 0) {
        const available = allChunks.filter(
          (chunk) => !claimedChunkIds.has(getChunkId(chunk)),
        );
        chunks = available.slice(0, CHUNKS_PER_SUBTOPIC);
        chunks.forEach((chunk) => claimedChunkIds.add(getChunkId(chunk)));
      } else {
        // Document exists but has no chunks yet — fall back to search
        console.warn(
          `[contextFetcher] No chunks for doc ${subtopic.documentId}, falling back to search for "${subtopic.name}"`,
        );
        const results = await mcpClient.searchDocumentChunks(
          [subtopic.name],
          CHUNKS_PER_SUBTOPIC * 2,
        );
        const available = results.filter(
          (chunk) => !claimedChunkIds.has(getChunkId(chunk)),
        );
        chunks = available.slice(0, CHUNKS_PER_SUBTOPIC);
        chunks.forEach((chunk) => claimedChunkIds.add(getChunkId(chunk)));
      }
    }
    console.log(
      `[contextFetcher] "${subtopic.name}" => ${chunks.length} chunks`,
    );
    subtopicsWithMaterial.push({ ...subtopic, sourceMaterial: chunks });
  }

  return { subtopics: subtopicsWithMaterial };
}
