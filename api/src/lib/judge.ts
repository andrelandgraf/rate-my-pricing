import { TypeSafeClient } from "@typesafe-ai/sdk";
import { Sentry } from "../instrument";
import type { JudgeInput, JudgeVerdict } from "./types";
import {
  JUDGE_MODEL,
  JUDGE_TIMEOUT_MS,
  JUDGE_QUESTION_IDS,
  buildJudgeState,
  composeJudgeVerdict,
  judgeQuestions,
  parseJudgeAnswers,
} from "./judgePolicy";

export { buildJudgeState, JUDGE_MODEL, JUDGE_TIMEOUT_MS };

const PASS: JudgeVerdict = { verdict: "pass", issues: [] };

function failOpen(reason: string, elapsedMs: number, extra?: Record<string, unknown>): JudgeVerdict {
  console.error(`[judge] fail-open reason=${reason} ms=${elapsedMs.toFixed(0)}`);
  Sentry.captureMessage(`[judge] fail-open: ${reason}`, {
    level: "warning",
    tags: { component: "judge", model: JUDGE_MODEL },
    extra: { elapsedMs, ...extra },
  });
  return PASS;
}

/**
 * QA gate over the final result. Returns a verdict; on any failure it defaults to "pass" so the
 * judge can never block the pipeline by erroring.
 */
export async function judgeRating(input: JudgeInput): Promise<JudgeVerdict> {
  const started = performance.now();
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) return failOpen("missing TYPESAFE_API_KEY", performance.now() - started);

  try {
    const client = new TypeSafeClient({
      apiKey,
      timeout: JUDGE_TIMEOUT_MS,
      retry: { maxRetries: 0 },
      logLevel: "warn",
    });
    const response = await client.systemOne(
      { model: JUDGE_MODEL, state: buildJudgeState(input), questions: judgeQuestions },
      { signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS) },
    );
    const parsed = parseJudgeAnswers(response.answers);
    if (!parsed.ok) {
      return failOpen(`invalid answers (${parsed.reason})`, performance.now() - started, {
        model: response.model,
      });
    }
    const verdict = composeJudgeVerdict(parsed.answers);
    const elapsedMs = performance.now() - started;
    const noul = JUDGE_QUESTION_IDS.map((id) => parsed.answers[id].noul.toFixed(3)).join(",");
    console.info(
      `[judge] ok model=${response.model} verdict=${verdict.verdict} issues=${verdict.issues.length} ms=${elapsedMs.toFixed(0)} tokens_in=${response.usage.input_tokens} noul=${noul}`,
    );
    return verdict;
  } catch (err) {
    return failOpen(err instanceof Error ? err.message : String(err), performance.now() - started);
  }
}
