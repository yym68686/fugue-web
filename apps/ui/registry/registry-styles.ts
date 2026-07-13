import type { Registry } from "shadcn/schema";

const colorsNeutralLight = {
  accent: "oklch(0.955 0.018 264)",
  "accent-foreground": "oklch(0.27 0.02 264)",
  background: "oklch(0.985 0.002 247.84)",
  border: "oklch(0.9 0.008 264)",
  card: "oklch(1 0 0)",
  "card-foreground": "var(--foreground)",
  destructive: "oklch(0.58 0.23 28)",
  "destructive-foreground": "oklch(0.47 0.2 28)",
  foreground: "oklch(0.205 0 0)",
  info: "oklch(0.62 0.18 250)",
  "info-foreground": "oklch(0.47 0.16 250)",
  input: "oklch(0.87 0.01 264)",
  muted: "oklch(0.965 0.004 264)",
  "muted-foreground": "oklch(0.48 0.015 264)",
  popover: "oklch(1 0 0)",
  "popover-foreground": "var(--foreground)",
  primary: "oklch(0.55 0.22 264)",
  "primary-foreground": "oklch(0.985 0 0)",
  ring: "oklch(0.58 0.2 264)",
  secondary: "oklch(0.965 0.004 264)",
  "secondary-foreground": "oklch(0.27 0.01 264)",
  success: "oklch(0.62 0.16 150)",
  "success-foreground": "oklch(0.43 0.13 150)",
  warning: "oklch(0.72 0.17 75)",
  "warning-foreground": "oklch(0.47 0.13 65)",
} as const;

const colorsNeutralDark = {
  accent: "oklch(0.28 0.03 264)",
  "accent-foreground": "oklch(0.96 0.003 264)",
  background: "oklch(0.16 0.008 264)",
  border: "oklch(1 0 0 / 10%)",
  card: "oklch(0.2 0.01 264)",
  "card-foreground": "var(--foreground)",
  destructive: "oklch(0.68 0.2 28)",
  "destructive-foreground": "oklch(0.78 0.16 28)",
  foreground: "oklch(0.96 0.003 264)",
  info: "oklch(0.7 0.14 250)",
  "info-foreground": "oklch(0.8 0.1 250)",
  input: "oklch(1 0 0 / 13%)",
  muted: "oklch(0.24 0.01 264)",
  "muted-foreground": "oklch(0.71 0.015 264)",
  popover: "oklch(0.21 0.012 264)",
  "popover-foreground": "var(--foreground)",
  primary: "oklch(0.7 0.17 264)",
  "primary-foreground": "oklch(0.17 0.01 264)",
  ring: "oklch(0.68 0.15 264)",
  secondary: "oklch(0.25 0.012 264)",
  "secondary-foreground": "oklch(0.96 0.003 264)",
  success: "oklch(0.7 0.13 150)",
  "success-foreground": "oklch(0.81 0.1 150)",
  warning: "oklch(0.78 0.14 75)",
  "warning-foreground": "oklch(0.86 0.1 75)",
} as const;

export const styles: Registry["items"] = [
  {
    css: {
      "@layer base": {
        "*": {
          "@apply border-border outline-ring/50": {},
        },
        body: {
          "@apply bg-background text-foreground": {},
        },
        "code, kbd, samp, pre": {
          "font-family": "var(--font-mono)",
        },
      },
    },
    cssVars: {
      dark: {
        ...colorsNeutralDark,
        code: "oklch(0.2 0.01 264)",
        "code-foreground": "var(--foreground)",
        "code-highlight": "oklch(1 0 0 / 6%)",
        sidebar: "oklch(0.18 0.01 264)",
        "sidebar-accent": "oklch(0.25 0.02 264)",
        "sidebar-accent-foreground": "oklch(0.96 0.003 264)",
        "sidebar-border": "oklch(1 0 0 / 8%)",
        "sidebar-foreground": "oklch(0.72 0.015 264)",
        "sidebar-primary": "var(--primary)",
        "sidebar-primary-foreground": "var(--primary-foreground)",
        "sidebar-ring": "var(--ring)",
      },
      light: {
        ...colorsNeutralLight,
        code: "oklch(0.97 0.004 264)",
        "code-foreground": "var(--foreground)",
        "code-highlight": "oklch(0.92 0.01 264)",
        radius: "0.625rem",
        sidebar: "oklch(0.97 0.004 264)",
        "sidebar-accent": "oklch(0.94 0.012 264)",
        "sidebar-accent-foreground": "oklch(0.25 0.02 264)",
        "sidebar-border": "oklch(0.89 0.008 264)",
        "sidebar-foreground": "oklch(0.42 0.015 264)",
        "sidebar-primary": "var(--primary)",
        "sidebar-primary-foreground": "var(--primary-foreground)",
        "sidebar-ring": "var(--ring)",
      },
      theme: {
        "font-heading":
          '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
        "font-mono":
          'var(--font-geist-mono), "Geist Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
        "font-sans":
          '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      },
    },
    dependencies: [
      "@base-ui/react",
      "class-variance-authority",
      "lucide-react",
    ],
    description:
      "Complete Fugue theme: colors, sidebar, fonts, and base styles. Use with `npx shadcn init @fugue/style` for full project setup.",
    devDependencies: ["tw-animate-css"],
    extends: "none",
    name: "style",
    registryDependencies: ["utils", "@fugue/ui", "@fugue/fonts"],
    type: "registry:style",
  },
  {
    cssVars: {
      dark: colorsNeutralDark,
      light: colorsNeutralLight,
    },
    name: "colors-neutral",
    type: "registry:style",
  },
];
