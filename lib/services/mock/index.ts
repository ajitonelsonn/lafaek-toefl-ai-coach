import type { PracticeSlug } from "@/lib/config/practice-types";
import { SAMPLE_SETS } from "@/lib/mock-data/questions";
import { buildUsageSummary } from "@/lib/mock-data/usage";
import type { AuthService, AuthUser, MediaService, QuestionService, UsageService } from "@/lib/services/types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockQuestionService: QuestionService = {
  async getQuestionSet(slug: PracticeSlug) {
    const content = SAMPLE_SETS[slug];
    return content ? { slug, source: "sample", content } : null;
  },
};

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Student";
  const word = local.replace(/[._-]+/g, " ").trim().split(" ")[0] ?? "Student";
  return word ? word[0].toUpperCase() + word.slice(1) : "Student";
}

/**
 * Simulated authentication. It performs no security checks and keeps no
 * credentials: the password is only validated for shape and then discarded.
 */
export const mockAuthService: AuthService = {
  async signIn({ email }) {
    await wait(600);
    const user: AuthUser = { name: nameFromEmail(email), email, createdAt: new Date().toISOString() };
    return user;
  },
  async signUp({ email }) {
    await wait(600);
    return { email };
  },
  async verifyEmail({ email, code, name }) {
    await wait(600);
    if (!/^\d{6}$/.test(code)) throw new Error("Enter all 6 digits.");
    return { name: name || nameFromEmail(email), email, createdAt: new Date().toISOString() };
  },
  async resendCode() {
    await wait(400);
    return { resendAfterSeconds: 45 };
  },
  async signOut() {
    await wait(200);
  },
};

/** No media files exist in Phase 1, so playback falls back to the browser voice. */
export const mockMediaService: MediaService = {
  async getPlaybackUrl(media) {
    return media.url;
  },
};

export const mockUsageService: UsageService = {
  async getUsage(range) {
    return buildUsageSummary(range);
  },
};
