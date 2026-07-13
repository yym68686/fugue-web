import { fontHeading, fontMono, fontSans } from "@fugue/ui/fonts";
import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Fugue UI Registry",
    template: "%s · Fugue UI Registry",
  },
  description: "Private documentation and shadcn registry for the Fugue UI system.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <a className="sr-only focus:not-sr-only" href="#main-content">
          Skip to content
        </a>
        <div className="registry-shell" data-app-root>
          <aside aria-label="UI registry" className="registry-rail">
            <Link className="text-lg font-semibold" href="/">
              Fugue UI
            </Link>
            <nav aria-label="Registry sections" className="mt-6 grid gap-1 text-sm">
              <Link
                className="rounded-lg px-3 py-2 hover:bg-sidebar-accent"
                href="/docs"
              >
                Documentation
              </Link>
              <Link
                className="rounded-lg px-3 py-2 hover:bg-sidebar-accent"
                href="/particles"
              >
                Particles
              </Link>
              <a
                className="rounded-lg px-3 py-2 hover:bg-sidebar-accent"
                href="/r/registry.json"
              >
                Registry JSON
              </a>
            </nav>
          </aside>
          <main className="min-w-0" id="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
