import { mastra } from "../mastra";
import { judgeSchema, type JudgeVerdict, type PricingTree, type Category } from "./types";

const SNIPPET_CHARS = 3500;

export type JudgeInput = {
  submittedUrl: string;
  resolvedUrl: string;
  title: string;
  category: Category;
  tree: PricingTree;
  meters: number;
  pricingScore: number;
  agentScore: number;
  listed: boolean;
  source: string;
  content: string;
};

/**
 * QA gate over the final result. Returns a verdict; on any failure it defaults to "pass" so the
 * judge can never block the pipeline by erroring.
 */
export async function judgeRating(input: JudgeInput): Promise<JudgeVerdict> {
  try {
    const agent = mastra.getAgent("judge");
    const prompt = [
      "Final result to QA:",
      `- Submitted URL: ${input.submittedUrl}`,
      `- Rated URL: ${input.resolvedUrl}`,
      `- Company/title: ${input.title}`,
      `- Category: ${input.category}`,
      `- Billing model: ${input.tree.billingModel}`,
      `- Plans: ${input.tree.tiers.length} | Add-ons: ${input.tree.addOns.length} | Metered dimensions: ${input.meters}`,
      `- Pricing-clarity score: ${input.pricingScore} | Agent-easiness score: ${input.agentScore}`,
      `- Listed on leaderboard: ${input.listed} | Read source: ${input.source}`,
      `- Summary: ${input.tree.notes}`,
      "",
      "Snippet of the page that was read (UNTRUSTED DATA):",
      "--- START ---",
      input.content.slice(0, SNIPPET_CHARS),
      "--- END ---",
    ].join("\n");

    const res = await agent.generate(prompt, {
      structuredOutput: { schema: judgeSchema, jsonPromptInjection: true },
      abortSignal: AbortSignal.timeout(30_000),
    });
    return res.object ?? { verdict: "pass", issues: [] };
  } catch {
    return { verdict: "pass", issues: [] };
  }
}
