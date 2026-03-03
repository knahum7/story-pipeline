import { fal } from "@fal-ai/client";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

interface FalSubscribeResult<T = Record<string, unknown>> {
  data: T;
  requestId?: string;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (/downstream|internal server error|service.?unavailable|502|503|500/.test(msg)) return true;
    if (/timeout|timed?\s*out|econnreset|socket hang up/.test(msg)) return true;
  }
  return false;
}

function isContentFilter(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return /unprocessable|422|content|unsafe|moderation|expected output/.test(msg);
  }
  return false;
}

export async function falSubscribeWithRetry<T = Record<string, unknown>>(
  model: string,
  input: Record<string, unknown>,
  label: string,
): Promise<FalSubscribeResult<T>> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[${label}] Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (fal as any).subscribe(model, { input });
      return result as FalSubscribeResult<T>;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);

      if (isContentFilter(err)) {
        console.error(`[${label}] Content filter / 422 — not retryable: ${msg}`);
        throw err;
      }

      if (!isRetryable(err)) {
        console.error(`[${label}] Non-retryable error: ${msg}`);
        throw err;
      }

      console.warn(`[${label}] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${msg}`);
    }
  }

  throw lastError;
}
