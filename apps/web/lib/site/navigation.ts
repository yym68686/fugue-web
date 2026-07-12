export type MarketingNavItem = {
  href: string;
  label: string;
};

export const marketingPrimaryNav: readonly MarketingNavItem[] = [
  { href: "/docs", label: "Docs" },
  { href: "/#route", label: "How it works" },
  { href: "/#surface", label: "Available now" },
  { href: "/#quickstart", label: "Quickstart" },
  { href: "/#launch", label: "Sign in" },
];
