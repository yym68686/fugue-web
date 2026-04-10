import { IBM_Plex_Mono, Manrope, Syne } from "next/font/google";

export const fugueBodyFont = Manrope({
  display: "swap",
  preload: true,
  subsets: ["latin"],
  variable: "--font-fugue-body",
  weight: ["400", "500", "600", "700", "800"],
});

export const fugueHeadingFont = Syne({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-fugue-heading",
  weight: ["500", "600", "700", "800"],
});

export const fugueMonoFont = IBM_Plex_Mono({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-fugue-mono",
  weight: ["400", "500", "600"],
});

export const fugueFontVariables = [
  fugueBodyFont.variable,
  fugueHeadingFont.variable,
  fugueMonoFont.variable,
].join(" ");
