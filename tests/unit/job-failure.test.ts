import { describe, expect, it } from "vitest";
import { toJobFailure } from "@/lib/server/generation/handlers";
import { ProviderError } from "@/lib/server/providers/http";

describe("toJobFailure", () => {
  it("blocks (does not fail) on an unknown model or rejected key", () => {
    const model = toJobFailure(new ProviderError("meta", "bad_request", "x", 404, undefined, "model_not_found"));
    const auth = toJobFailure(new ProviderError("meta", "auth", "x", 401));
    for (const f of [model, auth]) expect([f.code, f.blocked, f.retryable]).toEqual(["PROVIDER_CONFIG", true, false]);
  });

  it("keeps other bad requests as failures and server errors as retryable", () => {
    const bad = toJobFailure(new ProviderError("meta", "bad_request", "x", 400, undefined, "invalid_value"));
    expect([bad.code, bad.blocked, bad.retryable]).toEqual(["PROVIDER_BAD_REQUEST", false, false]);
    expect(toJobFailure(new ProviderError("meta", "server", "x", 503)).retryable).toBe(true);
  });
});
