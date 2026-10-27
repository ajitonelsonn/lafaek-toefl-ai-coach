"use client";

// Browser → API helper. Same-origin cookies carry the session; nothing secret is stored client-side.

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body || init.form ? "POST" : "GET"),
      headers: init.form ? undefined : init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      credentials: "same-origin",
      cache: "no-store",
      signal: init.signal,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", "We couldn't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as { error?: { code: string; message: string; fields?: Record<string, string>; requestId?: string } } | null;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiClientError(res.status, e?.code ?? "INTERNAL_ERROR", e?.message ?? "Something went wrong. Please try again.", e?.fields, e?.requestId);
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.";
}
