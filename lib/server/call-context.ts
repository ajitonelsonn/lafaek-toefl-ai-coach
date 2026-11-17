import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Where an AI call comes from, for the server logs: the VR Study Room, the website, or a
 * background worker job. Set once per request or job; read by the provider logging.
 */
export interface CallContext {
  /** "vr-room" (the headset), "web" (the website) or "worker" (Render background jobs). */
  client: "vr-room" | "web" | "worker";
  /** What triggered it, e.g. "speaking", "feedback", or the worker job type. */
  feature?: string;
  jobId?: string;
}

const store = new AsyncLocalStorage<CallContext>();

export const callContext = (): CallContext | undefined => store.getStore();

export function withCallContext<T>(ctx: CallContext, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

/** The VR room marks its requests with this header (see vr/src/data.ts). */
export function clientFromRequest(req: Request): CallContext["client"] {
  return req.headers.get("x-lafaek-client") === "vr-room" ? "vr-room" : "web";
}
