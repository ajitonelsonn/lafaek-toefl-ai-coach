import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Meta intermittently answers 404 model_not_found for muse-spark-1.3; generateText must
// retry it and then use the fallback model.
describe("generateText model fallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries model_not_found, then uses the fallback model", async () => {
    process.env.MODEL_API_KEY = "test-key";
    process.env.META_TEXT_MODEL = "muse-spark-1.3";
    process.env.META_TEXT_FALLBACK_MODEL = "muse-spark-1.2";
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      sent.push(model);
      if (model === "muse-spark-1.3") {
        return new Response(JSON.stringify({ error: { type: "invalid_request_error", code: "model_not_found" } }), { status: 404 });
      }
      return new Response(JSON.stringify({ model, choices: [{ message: { content: '{"ok":"yes"}' } }], usage: {} }), { status: 200 });
    });
    const { generateText } = await import("@/lib/server/providers/meta");
    const r = await generateText({ task: "generate:probe", schema: z.object({ ok: z.string() }), system: "s", user: "u" });
    expect(sent).toEqual(["muse-spark-1.3", "muse-spark-1.3", "muse-spark-1.3", "muse-spark-1.2"]);
    expect(r).toMatchObject({ data: { ok: "yes" }, model: "muse-spark-1.2" });
  });
});
