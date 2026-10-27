import "server-only";
import type { Prisma } from "@prisma/client";
import { BOOST_PACK } from "@/lib/config/pricing";
import { db } from "./db";
import { ApiError } from "./http";

// Lifetime allowances. Every account starts with the Starter allowance (1 study plan, 1 mock test,
// set by column defaults). A Boost Pack, paid by arrangement with the admin, adds 1 plan and
// 2 mock tests. Credits are used atomically, so concurrent requests cannot overspend.

export interface Credits {
  planCredits: number;
  mockCredits: number;
}

type Tx = Prisma.TransactionClient;

export async function getCredits(userId: string): Promise<Credits> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { planCredits: true, mockCredits: true } });
  return { planCredits: u?.planCredits ?? 0, mockCredits: u?.mockCredits ?? 0 };
}

function upgradeRequired(kind: "plan" | "mock"): ApiError {
  const what = kind === "plan" ? "study plans" : "mock tests";
  return new ApiError(402, "UPGRADE_REQUIRED", `You have used all your ${what}. Upgrade with a ${BOOST_PACK.name} ($${BOOST_PACK.priceUsd}) to get more.`, { kind });
}

/** Uses one study-plan credit or throws 402 UPGRADE_REQUIRED. */
export async function usePlanCredit(tx: Tx, userId: string) {
  const r = await tx.user.updateMany({ where: { id: userId, planCredits: { gt: 0 } }, data: { planCredits: { decrement: 1 } } });
  if (r.count !== 1) throw upgradeRequired("plan");
}

/** Uses one mock-test credit or throws 402 UPGRADE_REQUIRED. */
export async function useMockCredit(tx: Tx, userId: string) {
  const r = await tx.user.updateMany({ where: { id: userId, mockCredits: { gt: 0 } }, data: { mockCredits: { decrement: 1 } } });
  if (r.count !== 1) throw upgradeRequired("mock");
}

/** Adds Boost Packs to an account (after payment was arranged) and records the grant. */
export async function grantBoostPacks(input: { email?: string; userId?: string; packs: number; note?: string; grantedBy: string }) {
  if (!Number.isInteger(input.packs) || input.packs < 1 || input.packs > 20) throw new ApiError(400, "VALIDATION_ERROR", "Choose between 1 and 20 packs.");
  const user = await db.user.findFirst({
    where: input.userId ? { id: input.userId } : { emailNormalized: (input.email ?? "").trim().toLowerCase() },
    select: { id: true, emailNormalized: true },
  });
  if (!user) throw new ApiError(404, "NOT_FOUND", "No account with that email.");
  const planCredits = BOOST_PACK.planCredits * input.packs;
  const mockCredits = BOOST_PACK.mockCredits * input.packs;
  const [updated] = await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { planCredits: { increment: planCredits }, mockCredits: { increment: mockCredits } }, select: { planCredits: true, mockCredits: true } }),
    db.creditGrant.create({ data: { userId: user.id, packs: input.packs, planCredits, mockCredits, note: input.note?.slice(0, 300) ?? null, grantedBy: input.grantedBy.slice(0, 120) } }),
  ]);
  return { userId: user.id, email: user.emailNormalized, added: { planCredits, mockCredits }, credits: updated };
}

export interface AccountPlan extends Credits {
  /** Boost Packs added so far (0 = Starter only). */
  packs: number;
  used: { studyPlans: number; mockTests: number };
  grants: { date: string; packs: number; planCredits: number; mockCredits: number }[];
}

/** The learner's plan for the Usage page: credits left, what was used, and upgrade history. */
export async function getAccountPlan(userId: string): Promise<AccountPlan> {
  const [credits, grants, studyPlans, mockTests] = await Promise.all([
    getCredits(userId),
    db.creditGrant.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true, packs: true, planCredits: true, mockCredits: true } }),
    db.studyPlan.count({ where: { userId } }),
    db.mockTestResult.count({ where: { userId } }),
  ]);
  return {
    ...credits,
    packs: grants.reduce((n, g) => n + g.packs, 0),
    used: { studyPlans, mockTests },
    grants: grants.slice(0, 10).map((g) => ({ date: g.createdAt.toISOString(), packs: g.packs, planCredits: g.planCredits, mockCredits: g.mockCredits })),
  };
}
