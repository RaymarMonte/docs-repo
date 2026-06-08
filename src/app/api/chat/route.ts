import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

// Allow streaming responses up to 30 seconds.
export const maxDuration = 30;

/**
 * Example chat Route Handler using the Vercel AI SDK + Anthropic provider.
 * Requires `ANTHROPIC_API_KEY` in the environment.
 *
 * Swap the provider package (e.g. `@ai-sdk/openai`) and model id to use a
 * different model. Model ids: claude-opus-4-8, claude-sonnet-4-6,
 * claude-haiku-4-5-20251001.
 */
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
