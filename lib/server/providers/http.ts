import "server-only";

// Shared provider HTTP client: timeouts, bounded retries for transient errors
// (429/5xx/network) with exponential backoff + jitter, Retry-After support, and
// sanitized errors. Authentication and validation errors are never retried.

export type ProviderErrorKind = "auth" | "rate_limited" | "bad_request" | "server" | "timeout" | "network" | "invalid_output" | "not_configured";

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
  }
  get retryable() {
    return this.kind === "rate_limited" || this.kind === "server" || this.kind === "timeout" || this.kind === "network";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchOptions {
  provider: string;
  timeoutMs: number;
  retries: number;
}

export async function providerFetch(url: string, init: RequestInit, opts: FetchOptions): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let res: Response | undefined;
    let error: ProviderError | undefined;
    try {
      res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    } catch {
      error = new ProviderError(opts.provider, controller.signal.aborted ? "timeout" : "network", controller.signal.aborted ? "Provider request timed out." : "Network error calling provider.");
    } finally {
      clearTimeout(timer);
    }

    if (res && res.ok) return res;
    if (res) error = await toProviderError(opts.provider, res);
    if (!error!.retryable || attempt >= opts.retries) throw error!;

    attempt++;
    const retryAfter = Number(res?.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30_000, 500 * 2 ** attempt);
    await sleep(backoff + Math.random() * 400);
  }
}

async function toProviderError(provider: string, res: Response): Promise<ProviderError> {
  const requestId = res.headers.get("x-request-id") ?? res.headers.get("request-id") ?? undefined;
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string; type?: string; code?: string }; detail?: unknown };
    // Type and code are short enums (e.g. "invalid_request_error, model_not_found"); messages are not echoed.
    detail = [body.error?.type, body.error?.code].filter((v) => typeof v === "string" && /^[\w.-]{1,64}$/.test(v)).join(", ");
  } catch {
    /* non-JSON body: ignore, never echo raw provider payloads */
  }
  const kind: ProviderErrorKind =
    res.status === 401 || res.status === 403 ? "auth" : res.status === 429 ? "rate_limited" : res.status >= 500 ? "server" : "bad_request";
  return new ProviderError(provider, kind, `${provider} request failed (${res.status}${detail ? `, ${detail}` : ""}).`, res.status, requestId);
}
