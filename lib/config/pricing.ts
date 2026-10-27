// Plans shown on the landing page and in upgrade prompts. Credits are lifetime, not monthly:
// every account starts with the Starter allowance, and each Boost Pack adds to it.
import { SITE } from "./site";

export const FREE_PLAN_CREDITS = 1;
export const FREE_MOCK_CREDITS = 1;

export const BOOST_PACK = { name: "Boost Pack", priceUsd: 5, planCredits: 1, mockCredits: 2 } as const;

export interface PricingTier {
  id: "starter" | "boost" | "open-source";
  name: string;
  /** Illustration cropped from the owner's icon sheet (scripts/crop-pricing-icons.mjs). */
  icon: string;
  price: string;
  priceNote: string;
  summary: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean };
  featured?: boolean;
}

export const upgradeMailto = (email?: string) => {
  const subject = `${BOOST_PACK.name} upgrade ($${BOOST_PACK.priceUsd})`;
  const body = `Hello, I would like to buy a ${BOOST_PACK.name} ($${BOOST_PACK.priceUsd}): 1 more study plan and 2 more mock tests.${email ? `\n\nMy account email: ${email}` : ""}\n\nThank you!`;
  return `mailto:${SITE.adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const PRICING: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    icon: "/assets/pricing/starter.png",
    price: "Free",
    priceNote: "for life",
    summary: "Everything you need to start preparing.",
    features: ["1 personal AI study plan", "1 AI mock test with band estimate", "All 12 TOEFL 2026 practice types", "AI vocabulary with natural voice", "Progress tracking"],
    cta: { label: "Start free", href: "/signup" },
  },
  {
    id: "boost",
    name: BOOST_PACK.name,
    icon: "/assets/pricing/boost.png",
    price: `$${BOOST_PACK.priceUsd}`,
    priceNote: "one-time, per pack",
    summary: "Need a new plan or more practice tests? Add a pack any time.",
    features: ["+1 new AI study plan (new questions for it)", "+2 AI mock tests", "Buy as many packs as you need", "Upgrade by contacting the admin"],
    cta: { label: "Contact admin to upgrade", href: upgradeMailto(), external: true },
    featured: true,
  },
  {
    id: "open-source",
    name: "Open Source",
    icon: "/assets/pricing/open-source.png",
    price: "Free",
    priceNote: "self-hosted · non-commercial",
    summary: "Deploy your own copy from GitHub.",
    features: ["Full source code on GitHub", "Run it with your own API keys", "Not for business use", `For business use, contact ${SITE.adminEmail}`],
    cta: { label: "View on GitHub", href: SITE.githubUrl, external: true },
  },
];
