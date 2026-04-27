import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages,
  });

  return Response.json(response.choices[0].message);
}
