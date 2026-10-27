// Catalogue of derived assets in public/assets (see public/assets/ASSET_MANIFEST.md).
// Dimensions are the intrinsic pixel sizes of each file.

export interface AssetImage {
  src: string;
  width: number;
  height: number;
}

const img = (src: string, width: number, height: number): AssetImage => ({ src, width, height });

export const BRAND = {
  logo: img("/assets/logo/logo.png", 1254, 1254),
  logoTrimmed: img("/assets/logo/logo-full-trimmed.png", 1127, 951),
  mark: img("/assets/logo/logo-mark.png", 916, 724),
  wordmark: img("/assets/logo/logo-wordmark.png", 1127, 227),
  motto: img("/assets/crops/sidebar-motto.png", 216, 152),
} as const;

export const BACKGROUNDS = {
  loginScene: img("/assets/backgrounds/login-scene.png", 397, 285),
  signupScene: img("/assets/backgrounds/signup-scene.png", 409, 275),
  otpScene: img("/assets/backgrounds/otp-scene.png", 400, 275),
  forgotScene: img("/assets/backgrounds/forgot-password-scene.png", 403, 285),
  dashboard: img("/assets/backgrounds/dashboard.png", 323, 388),
  progress: img("/assets/backgrounds/progress.png", 392, 388),
  resources: img("/assets/backgrounds/resources.png", 263, 388),
  profile: img("/assets/backgrounds/profile.png", 303, 388),
  settings: img("/assets/backgrounds/settings.png", 319, 388),
} as const;

export const ILLUSTRATIONS = {
  conversation: img("/assets/crops/listening-conversation.png", 526, 248),
  announcement: img("/assets/crops/listening-announcement.png", 520, 240),
  emailHiking: img("/assets/crops/writing-email-hiking.png", 366, 258),
  officePrinter: img("/assets/crops/speaking-office-printer.png", 330, 348),
  vocabularyEnvironment: img("/assets/crops/vocabulary-environment.png", 280, 288),
  speakerA: img("/assets/crops/avatar-speaker-a.png", 74, 74),
  speakerB: img("/assets/crops/avatar-speaker-b.png", 74, 74),
  headerStudyPlan: img("/assets/crops/header-study-plan.png", 172, 110),
  headerVocabulary: img("/assets/crops/header-vocabulary.png", 204, 96),
  headerMockTest: img("/assets/crops/header-mock-test.png", 210, 130),
  headerProgress: img("/assets/crops/header-progress.png", 186, 100),
  headerUsage: img("/assets/crops/header-usage.png", 180, 116),
} as const;

/** 3D icons cropped from logo_icon/all_icon.png. All files are square. */
export type Icon3DName =
  | "home" | "practice" | "mock-test" | "progress" | "resources" | "profile" | "settings"
  | "login" | "signup" | "otp-verify" | "forgot-password" | "logout"
  | "listening" | "reading" | "speaking" | "writing" | "ai-practice" | "ai-coach" | "tips"
  | "test-strategy" | "feedback" | "discussion" | "saved" | "favorite" | "history"
  | "start" | "pause" | "stop" | "next" | "previous" | "retry" | "volume-on" | "volume-off"
  | "speed" | "download" | "upload" | "share" | "edit" | "delete"
  | "success" | "error" | "warning" | "info" | "loading" | "online" | "offline" | "premium"
  | "streak" | "achievement" | "goal" | "score" | "analytics" | "calendar"
  | "email" | "password" | "show" | "hide" | "user" | "users" | "key" | "security" | "phone"
  | "message" | "help" | "support" | "contact-admin" | "continue"
  | "video" | "pdf" | "link" | "image" | "document" | "audio" | "voice" | "quiz"
  | "practice-test" | "score-chart" | "report" | "website" | "external-link" | "search" | "filter";

export function icon3dSrc(name: Icon3DName): string {
  return `/assets/icons/${name}.png`;
}
