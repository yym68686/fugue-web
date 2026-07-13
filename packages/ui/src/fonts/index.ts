import localFont from "next/font/local";

export const fontSans = localFont({
  adjustFontFallback: "Arial",
  display: "swap",
  fallback: ["Inter", "Arial", "Helvetica", "sans-serif"],
  preload: true,
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-sans",
  weight: "100 900",
});

export const fontHeading = localFont({
  adjustFontFallback: "Arial",
  display: "swap",
  fallback: ["Inter", "Arial", "Helvetica", "sans-serif"],
  preload: true,
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-heading",
  weight: "100 900",
});

export const fontMono = localFont({
  adjustFontFallback: false,
  display: "swap",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  preload: true,
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-mono",
  weight: "100 900",
});
