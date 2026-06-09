import { IBM_Plex_Mono, Inter, Syne } from "next/font/google";

export const fugueBodyFont = Inter({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-fugue-body",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const fugueMonoFont = IBM_Plex_Mono({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-fugue-mono",
  weight: ["400", "500", "600"],
});

export const fugueBrandFont = Syne({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-fugue-brand",
  weight: ["600", "700", "800"],
});

export const fugueFontVariables = [
  fugueBodyFont.variable,
  fugueMonoFont.variable,
  fugueBrandFont.variable,
].join(" ");
