import { LogoLoader } from "@/components/ui/LogoLoader";

// Shown inside the app shell (sidebar and top bar stay) while a page loads its data.
export default function Loading() {
  return <LogoLoader label="Loading your page…" />;
}
