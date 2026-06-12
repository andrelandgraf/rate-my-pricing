import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { agentOutputSchema, type AgentOutput, type FetchResult } from "./types";

export const MODEL = "gpt-5-mini";
const FALLBACK_MODEL = "claude-haiku-4-5";

// The injected OPENAI_BASE_URL points at the Responses dialect; @ai-sdk/openai uses it by default.
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? process.env.NEON_AI_GATEWAY_TOKEN,
  baseURL: process.env.OPENAI_BASE_URL,
});

const SYSTEM = [
  "You are a meticulous pricing analyst.",
  "You are given the text content of a company's pricing page (markdown or stripped HTML).",
  "Extract a faithful, standardized pricing tree. Capture every tier, every notable feature/limit,",
  "and every add-on or additional package. Do not invent prices that are not present.",
  "Flag anything that makes the pricing genuinely hard to predict (usage overages, metered dimensions,",
  "annual-only discounts, contact-sales gates, calculators) in hiddenCostSignals — be conservative,",
  "only list real complexity, not normal feature differences between tiers.",
  "Set foundPricing=false only if the page exposes no concrete pricing at all.",
  "Set requiresInteraction=true if the real price is gated behind a calculator, login, or sales call.",
].join(" ");

function emptyOutput(note: string): AgentOutput {
  return {
    tree: {
      productName: "Unknown",
      currency: "",
      billingModel: "unknown",
      tiers: [],
      addOns: [],
      hiddenCostSignals: [note],
      notes: note,
    },
    meta: { parseConfidence: 0, requiresInteraction: false, foundPricing: false },
  };
}

const ATTEMPT_TIMEOUT_MS = 70_000;

async function attempt(model: string, fetched: FetchResult, url: string): Promise<AgentOutput> {
  const { object } = await generateObject({
    model: openai(model),
    schema: agentOutputSchema,
    system: SYSTEM,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    prompt: [
      `Pricing page URL: ${url}`,
      `Content source: ${fetched.source}`,
      "",
      "--- PAGE CONTENT START ---",
      fetched.content,
      "--- PAGE CONTENT END ---",
    ].join("\n"),
  });
  return object;
}

export async function parsePricing(fetched: FetchResult, url: string): Promise<AgentOutput> {
  if (!fetched.ok || !fetched.content.trim()) {
    return emptyOutput("The agent could not retrieve readable content from this page.");
  }

  const models = [MODEL, FALLBACK_MODEL];
  let lastError: unknown;
  for (const model of models) {
    try {
      return await attempt(model, fetched, url);
    } catch (err) {
      lastError = err;
      console.error(`[parse] model=${model} failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.error("[parse] all models failed", lastError);
  return emptyOutput("The agent retrieved the page but could not reliably parse the pricing.");
}
