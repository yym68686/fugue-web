import type { MetadataRoute } from "next";

import { absolutePublicUrl } from "@/lib/site/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absolutePublicUrl("/").toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absolutePublicUrl("/docs").toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
