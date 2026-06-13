import { Agent } from "@mastra/core/agent";
import { parseEnv } from "@neondatabase/env/v1";
import config from "../../../neon";

const env = parseEnv(config);
// The unified chat-completions (MLflow) dialect serves every provider (OpenAI + Claude).
const gatewayUrl = env.aiGateway.baseUrl.replace("/openai/v1", "/mlflow/v1");

const INSTRUCTIONS = [
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

function makePricingAgent(id: string, modelId: string): Agent {
  return new Agent({
    id,
    name: id,
    instructions: INSTRUCTIONS,
    model: {
      id: `neon/${modelId}`,
      url: gatewayUrl,
      apiKey: env.aiGateway.apiKey,
    },
  });
}

export const PRIMARY_MODEL = "gpt-5-mini";
export const FALLBACK_MODEL = "claude-haiku-4-5";

export const pricingPrimary = makePricingAgent("pricing-analyst", PRIMARY_MODEL);
export const pricingFallback = makePricingAgent("pricing-analyst-fallback", FALLBACK_MODEL);
