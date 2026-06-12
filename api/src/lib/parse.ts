import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { agentOutputSchema, type AgentOutput, type FetchResult } from "./types";

export const MODEL = "gpt-5-mini";

const apiKey = process.env.OPENAI_API_KEY ?? process.env.NEON_AI_GATEWAY_TOKEN;

// Two dialects on the same gateway:
//  - OPENAI_BASE_URL is the OpenAI *Responses* dialect (/ai-gateway/openai/v1) — OpenAI models only.
//  - the *MLflow* chat-completions dialect (/ai-gateway/mlflow/v1) serves every provider (incl. Claude).
const openai = createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL });
const gateway = createOpenAI({
  apiKey,
  baseURL: (process.env.OPENAI_BASE_URL ?? "").replace("/openai/v1", "/mlflow/v1"),
});

// Primary uses the Responses API (great structured outputs); fallbacks use the
// unified chat-completions dialect so a different provider can recover transient failures.
const MODELS: { label: string; model: LanguageModel }[] = [
  { label: "gpt-5-mini (responses)", model: openai("gpt-5-mini") },
  { label: "claude-haiku-4-5 (mlflow)", model: gateway.chat("claude-haiku-4-5") },
  { label: "gpt-5-mini (mlflow)", model: gateway.chat("gpt-5-mini") },
];

const SYSTEM = [
  "You are a meticulous pricing analyst.",
  "You are given the text content of a company's pricing page (markdown or stripped HTML).",
  "Extract a faithful, standardized pricing tree. Capture every tier, every notable feature/limit,",
  "and every add-on or additional package. Do not invent prices that are not present.",
  "Flag anything that makes the pricing genuinely hard to predict (usage overages, metered dimensions,",
  "annual-only discounts, contact-sales gates, calculators) in hiddenCostSignals — be conservative,",
  "only list real complexity, not normal feature differences between tiers.",
  "Set foundPricing=false only if the page exposes no concrete pricing at all.",
  "Set requiresInteraction=true only if the real price is gated behind a calculator, login, or sales call.",
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
    meta: { requiresInteraction: false, foundPricing: false },
  };
}

const ATTEMPT_TIMEOUT_MS = 70_000;

async function attempt(model: LanguageModel, fetched: FetchResult, url: string): Promise<AgentOutput> {
  const { object } = await generateObject({
    model,
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

  let lastError: unknown;
  for (const { label, model } of MODELS) {
    try {
      return await attempt(model, fetched, url);
    } catch (err) {
      lastError = err;
      console.error(`[parse] model=${label} failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.error("[parse] all models failed", lastError);
  return emptyOutput("The agent retrieved the page but could not reliably parse the pricing.");
}
