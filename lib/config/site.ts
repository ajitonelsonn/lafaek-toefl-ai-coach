export const SITE = {
  name: "LafaekTOEFL AI Coach",
  shortName: "LafaekTOEFL",
  tagline: "AI Coach",
  description:
    "Open-source TOEFL preparation with all 12 TOEFL 2026 practice task types, a personal study plan, and progress tracking.",
  /**
   * Public address for password-reset requests. Read from configuration only;
   * when empty, the UI shows a generic "contact the site administrator" message.
   */
  adminContactEmail: process.env.NEXT_PUBLIC_ADMIN_CONTACT_EMAIL?.trim() || null,
} as const;

/** Phase 1 runs entirely in the browser with sample data. */
export const DEMO_MODE = true;
