import type { MetadataRoute } from "next";

import { getCanonicalPublicOrigin } from "@/lib/site/metadata";

export default function robots(): MetadataRoute.Robots {
  const origin = getCanonicalPublicOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/docs"],
      disallow: [
        "/api/",
        "/app",
        "/app/",
        "/auth",
        "/auth/",
        "/healthz",
        "/new",
        "/new/",
      ],
    },
    host: origin,
    sitemap: `${origin}/sitemap.xml`,
  };
}
