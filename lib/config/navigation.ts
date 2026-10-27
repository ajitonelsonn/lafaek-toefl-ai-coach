export type NavIcon =
  | "dashboard"
  | "practice"
  | "study-plan"
  | "vocabulary"
  | "mock-test"
  | "progress"
  | "usage"
  | "profile"
  | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/practice", label: "Practice Center", icon: "practice" },
  { href: "/study-plan", label: "Study Plan", icon: "study-plan" },
  { href: "/vocabulary", label: "Vocabulary", icon: "vocabulary" },
  { href: "/mock-test", label: "Mock Test", icon: "mock-test" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/usage", label: "Usage", icon: "usage" },
];

export const ACCOUNT_NAV: readonly NavItem[] = [
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Page titles for breadcrumbs, keyed by the first path segment. */
export const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  practice: "Practice Center",
  "study-plan": "Study Plan",
  vocabulary: "Vocabulary",
  "mock-test": "Mock Test",
  progress: "Progress",
  usage: "Usage",
  profile: "Profile",
  settings: "Settings",
};
