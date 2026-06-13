import { mastra } from "../mastra";
import { categorizationSchema, type Category } from "./types";

/** Classify a product into a single category via the Mastra categorizer agent. */
export async function categorize(input: {
  title: string;
  host: string;
  summary: string;
}): Promise<Category> {
  try {
    const agent = mastra.getAgent("categorizer");
    const result = await agent.generate(
      [
        `Product: ${input.title}`,
        `Domain: ${input.host}`,
        `Pricing summary: ${input.summary || "(none)"}`,
        "",
        "Classify this product into exactly one category.",
      ].join("\n"),
      {
        structuredOutput: { schema: categorizationSchema, jsonPromptInjection: true },
        abortSignal: AbortSignal.timeout(30_000),
      },
    );
    return result.object?.category ?? "other";
  } catch {
    return "other";
  }
}
