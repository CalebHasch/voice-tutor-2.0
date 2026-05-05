import { NextRequest } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "nova",
    input: text,
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  return new Response(buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}
