import { describe, expect, it } from "vitest";
import type { NoulResponse } from "@typesafe-ai/sdk";
import {
  JUDGE_ISSUE,
  JUDGE_QUESTION_IDS,
  JUDGE_SNIPPET_CHARS,
  JUDGE_THRESHOLD,
  buildJudgeState,
  composeJudgeVerdict,
  parseJudgeAnswers,
  type JudgeAnswers,
} from "./judgePolicy";
import type { JudgeInput, PricingTree } from "./types";

function noul(value: number): NoulResponse {
  return { type: "noul", noul: value };
}

function answers(overrides: Partial<Record<keyof JudgeAnswers, number>> = {}): JudgeAnswers {
  return {
    notPricingPage: noul(overrides.notPricingPage ?? 0),
    companyMismatch: noul(overrides.companyMismatch ?? 0),
    listedWithoutPrices: noul(overrides.listedWithoutPrices ?? 0),
    incompletePricing: noul(overrides.incompletePricing ?? 0),
    wrongCategory: noul(overrides.wrongCategory ?? 0),
    implausibleScore: noul(overrides.implausibleScore ?? 0),
  };
}

const emptyTree: PricingTree = {
  productName: "Example",
  currency: "$",
  billingModel: "tiered",
  tiers: [],
  addOns: [],
  hiddenCostSignals: [],
  notes: "Example notes.",
};

function input(overrides: Partial<JudgeInput> = {}): JudgeInput {
  return {
    submittedUrl: "https://example.com/pricing",
    resolvedUrl: "https://example.com/pricing",
    title: "Example",
    category: "devtools",
    tree: emptyTree,
    meters: 0,
    pricingScore: 80,
    agentScore: 90,
    listed: true,
    source: "markdown",
    content: "Pro $20/mo",
    ...overrides,
  };
}

describe("composeJudgeVerdict", () => {
  it("fails on notPricingPage alone", () => {
    expect(composeJudgeVerdict(answers({ notPricingPage: 0.96 }))).toEqual({
      verdict: "fail",
      issues: [JUDGE_ISSUE.notPricingPage],
    });
  });

  it("fails on companyMismatch alone", () => {
    expect(composeJudgeVerdict(answers({ companyMismatch: 1 }))).toEqual({
      verdict: "fail",
      issues: [JUDGE_ISSUE.companyMismatch],
    });
  });

  it("fails on listedWithoutPrices alone", () => {
    expect(composeJudgeVerdict(answers({ listedWithoutPrices: JUDGE_THRESHOLD }))).toEqual({
      verdict: "fail",
      issues: [JUDGE_ISSUE.listedWithoutPrices],
    });
  });

  it("warns on incompletePricing alone", () => {
    expect(composeJudgeVerdict(answers({ incompletePricing: 0.97 }))).toEqual({
      verdict: "warn",
      issues: [JUDGE_ISSUE.incompletePricing],
    });
  });

  it("warns on wrongCategory alone", () => {
    expect(composeJudgeVerdict(answers({ wrongCategory: 0.99 }))).toEqual({
      verdict: "warn",
      issues: [JUDGE_ISSUE.wrongCategory],
    });
  });

  it("warns on implausibleScore alone", () => {
    expect(composeJudgeVerdict(answers({ implausibleScore: 0.95 }))).toEqual({
      verdict: "warn",
      issues: [JUDGE_ISSUE.implausibleScore],
    });
  });

  it("lets fail take precedence over warn and keeps table order", () => {
    expect(
      composeJudgeVerdict(
        answers({
          notPricingPage: 0.96,
          listedWithoutPrices: 0.99,
          incompletePricing: 0.97,
          implausibleScore: 0.96,
        }),
      ),
    ).toEqual({
      verdict: "fail",
      issues: [
        JUDGE_ISSUE.notPricingPage,
        JUDGE_ISSUE.listedWithoutPrices,
        JUDGE_ISSUE.incompletePricing,
        JUDGE_ISSUE.implausibleScore,
      ],
    });
  });

  it("passes when every noul is 0", () => {
    expect(composeJudgeVerdict(answers())).toEqual({ verdict: "pass", issues: [] });
  });

  it("passes when every noul is 0.5", () => {
    expect(
      composeJudgeVerdict(
        answers({
          notPricingPage: 0.5,
          companyMismatch: 0.5,
          listedWithoutPrices: 0.5,
          incompletePricing: 0.5,
          wrongCategory: 0.5,
          implausibleScore: 0.5,
        }),
      ),
    ).toEqual({ verdict: "pass", issues: [] });
  });

  it("does not fire at the value immediately below the threshold", () => {
    expect(composeJudgeVerdict(answers({ notPricingPage: JUDGE_THRESHOLD - 0.001 }))).toEqual({
      verdict: "pass",
      issues: [],
    });
  });

  it("fires at exactly the threshold", () => {
    expect(composeJudgeVerdict(answers({ wrongCategory: JUDGE_THRESHOLD })).verdict).toBe("warn");
  });

  it("uses only the fixed issue strings", () => {
    const { issues } = composeJudgeVerdict(
      answers({
        notPricingPage: 1,
        companyMismatch: 1,
        listedWithoutPrices: 1,
        incompletePricing: 1,
        wrongCategory: 1,
        implausibleScore: 1,
      }),
    );
    expect(issues).toEqual(JUDGE_QUESTION_IDS.map((id) => JUDGE_ISSUE[id]));
  });
});

describe("parseJudgeAnswers", () => {
  it("accepts six valid noul answers", () => {
    const parsed = parseJudgeAnswers(answers({ notPricingPage: 0.1 }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.answers.notPricingPage.noul).toBe(0.1);
  });

  it("rejects a missing answers object", () => {
    expect(parseJudgeAnswers(null).ok).toBe(false);
    expect(parseJudgeAnswers("nope").ok).toBe(false);
  });

  it("rejects a missing question", () => {
    const { notPricingPage: _, ...rest } = answers();
    expect(parseJudgeAnswers(rest).ok).toBe(false);
  });

  it("rejects the wrong primitive type", () => {
    expect(
      parseJudgeAnswers({
        ...answers(),
        notPricingPage: { type: "choice", choice: "pass", confidence: 1, probabilities: {} },
      }).ok,
    ).toBe(false);
  });

  it("rejects non-finite and out-of-range noul values", () => {
    expect(parseJudgeAnswers({ ...answers(), wrongCategory: noul(Number.NaN) }).ok).toBe(false);
    expect(parseJudgeAnswers({ ...answers(), wrongCategory: noul(Number.POSITIVE_INFINITY) }).ok).toBe(
      false,
    );
    expect(parseJudgeAnswers({ ...answers(), wrongCategory: noul(-0.01) }).ok).toBe(false);
    expect(parseJudgeAnswers({ ...answers(), wrongCategory: noul(1.01) }).ok).toBe(false);
  });
});

describe("buildJudgeState", () => {
  it("caps the snippet and omits full content", () => {
    const content = `${"A".repeat(JUDGE_SNIPPET_CHARS)}END-SHOULD-DROP`;
    const state = buildJudgeState(input({ content }));
    expect(state.snippet).toHaveLength(JUDGE_SNIPPET_CHARS);
    expect(state.snippet.endsWith("A")).toBe(true);
    expect(state.snippet.includes("END-SHOULD-DROP")).toBe(false);
    expect(Object.hasOwn(state, "content")).toBe(false);
  });
});
