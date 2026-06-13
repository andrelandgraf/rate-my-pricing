import type { Agent } from "@mastra/core/agent";
import { mastra } from "../mastra";
import { PRIMARY_MODEL } from "../mastra/agents/pricing";
import { Sentry } from "../instrument";
import { agentOutputSchema, type AgentOutput, type FetchResult } from "./types";

export const MODEL = PRIMARY_MODEL;

const ATTEMPT_TIMEOUT_MS = 70_000;

// Mastra agents, registered on the Mastra instance so their calls are traced/exported.
const ATTEMPTS: { label: string; agent: Agent }[] = [
  { label: PRIMARY_MODEL, agent: mastra.getAgent("pricingPrimary") },
  { label: "claude-haiku-4-5", agent: mastra.getAgent("pricingFallback") },
];

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

function buildPrompt(fetched: FetchResult, url: string): string {
  return [
    `Pricing page URL: ${url}`,
    `Content source: ${fetched.source}`,
    "",
    "--- PAGE CONTENT START ---",
    fetched.content,
    "--- PAGE CONTENT END ---",
  ].join("\n");
}

async function attempt(agent: Agent, fetched: FetchResult, url: string): Promise<AgentOutput> {
  const result = await agent.generate(buildPrompt(fetched, url), {
    // jsonPromptInjection makes the model emit the full schema (incl. `meta`) reliably
    // through the gateway, which doesn't enforce native structured output.
    structuredOutput: { schema: agentOutputSchema, jsonPromptInjection: true },
    abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
  });
  if (!result.object) throw new Error("agent returned no structured object");
  return result.object;
}

export async function parsePricing(fetched: FetchResult, url: string): Promise<AgentOutput> {
  if (!fetched.ok || !fetched.content.trim()) {
    return emptyOutput("The agent could not retrieve readable content from this page.");
  }

  let lastError: unknown;
  for (const { label, agent } of ATTEMPTS) {
    try {
      return await attempt(agent, fetched, url);
    } catch (err) {
      lastError = err;
      console.error(`[parse] model=${label} failed:`, err instanceof Error ? err.message : err);
      Sentry.captureException(err, {
        level: "warning",
        tags: { component: "agent", phase: "parse-attempt", model: label },
        extra: { url, source: fetched.source },
      });
    }
  }

  console.error("[parse] all models failed", lastError);
  Sentry.captureException(
    lastError instanceof Error ? lastError : new Error("all parse models failed"),
    {
      level: "error",
      tags: { component: "agent", phase: "parse-all-failed" },
      extra: { url, source: fetched.source },
    },
  );
  return emptyOutput("The agent retrieved the page but could not reliably parse the pricing.");
}
