import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { ConfigError, env } from "./env";
import { errorSummary, log } from "./log";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_CODE"
  | "INVALID_CREDENTIALS"
  | "EMAIL_DELIVERY_FAILED"
  | "CODE_EXPIRED"
  | "FEATURE_NOT_AVAILABLE"
  | "UPGRADE_REQUIRED"
  | "CONFIGURATION_MISSING"
  | "PAYLOAD_TOO_LARGE"
  | "BAD_ORIGIN"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
  }
}

export interface RouteContext<P> {
  params: P;
  requestId: string;
}

type Handler<P> = (req: NextRequest, ctx: RouteContext<P>) => Promise<Response>;

/**
 * Wraps a route handler: request ID, origin check for mutations, and
 * consistent sanitized errors. Never returns stack traces or provider errors.
 */
export function route<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    const requestId = randomUUID();
    const started = Date.now();
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const res = await handler(req, { params: await ctx.params, requestId });
      res.headers.set("x-request-id", requestId);
      log.info("request", { requestId, method: req.method, path: req.nextUrl.pathname, status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : err instanceof ConfigError
            ? new ApiError(503, "CONFIGURATION_MISSING", "This feature is not configured yet.")
            : new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
      const level = apiErr.status >= 500 ? "error" : "info";
      log[level]("request failed", {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status: apiErr.status,
        code: apiErr.code,
        error: err instanceof ApiError ? undefined : errorSummary(err),
      });
      return NextResponse.json(
        { error: { code: apiErr.code, message: apiErr.message, requestId, ...(apiErr.details ? { fields: apiErr.details } : {}) } },
        { status: apiErr.status, headers: { "x-request-id": requestId } },
      );
    }
  };
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...init?.headers } });
}

/** CSRF defence for cookie-authenticated mutations: the Origin must be this app. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) throw new ApiError(403, "BAD_ORIGIN", "Request origin is not allowed.");
  const allowed = new Set([new URL(env().APP_URL).origin, req.nextUrl.origin]);
  if (!allowed.has(origin)) throw new ApiError(403, "BAD_ORIGIN", "Request origin is not allowed.");
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>, maxBytes = 64 * 1024): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "VALIDATION_ERROR", "Please check your input.");
  }
  return validate(schema, raw);
}

export function validate<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    throw new ApiError(400, "VALIDATION_ERROR", "Please check your input.", fields);
  }
  return parsed.data;
}

export const uuidParam = z.string().uuid();

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
