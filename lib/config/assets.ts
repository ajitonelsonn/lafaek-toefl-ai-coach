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

/** VR landing page (/vr): crops of Hack/3d/vr_page_ilu/all_icon.png, the VR mascot and the study-room scene. */
export const VR_ASSETS = {
  mascot: img("/assets/vr/mascot-vr.webp", 1100, 870),
  background: img("/assets/vr/bg-study-room.webp", 1672, 941),
  buildSentence: img("/assets/vr/icon-build-sentence.png", 139, 108),
  listen: img("/assets/vr/icon-listen.png", 146, 115),
  interview: img("/assets/vr/icon-interview.png", 152, 121),
  vr: img("/assets/vr/icon-vr.png", 108, 60),
  desktop: img("/assets/vr/icon-desktop.png", 91, 80),
  back: img("/assets/vr/icon-back.png", 60, 61),
  arrowRight: img("/assets/vr/icon-arrow-right.png", 61, 60),
  check: img("/assets/vr/icon-check.png", 48, 49),
  pinchSelect: img("/assets/vr/hand-pinch-select.png", 252, 189),
  pinchHold: img("/assets/vr/hand-pinch-hold.png", 301, 171),
  zoneReading: img("/assets/vr/zone-reading.png", 236, 200),
  zoneListening: img("/assets/vr/zone-listening.png", 232, 200),
  zoneSpeaking: img("/assets/vr/zone-speaking.png", 218, 200),
  zoneWriting: img("/assets/vr/zone-writing.png", 227, 200),
} as const;

export const BACKGROUNDS = {
  loginScene: img("/assets/backgrounds/login-scene.webp", 1040, 693),
  signupScene: img("/assets/backgrounds/signup-scene.webp", 1040, 693),
  otpScene: img("/assets/backgrounds/otp-scene.webp", 1040, 693),
  forgotScene: img("/assets/backgrounds/forgot-password-scene.webp", 1040, 693),
  dashboard: img("/assets/backgrounds/dashboard.webp", 800, 515),
  progress: img("/assets/backgrounds/progress.webp", 900, 646),
  profile: img("/assets/backgrounds/profile.webp", 640, 676),
  settings: img("/assets/backgrounds/settings.webp", 640, 572),
  interviewer: img("/assets/backgrounds/Interview_Mascot.webp", 1254, 1254),
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
