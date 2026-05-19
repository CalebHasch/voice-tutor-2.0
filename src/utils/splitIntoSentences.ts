export function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/g) || [];

  const chunks: string[] = [];

  let current = "";

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();

    if (!sentence) continue;

    const next = current ? `${current} ${sentence}` : sentence;

    if (next.split(" ").length > 18) {
      if (current) {
        chunks.push(current);
      }

      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
