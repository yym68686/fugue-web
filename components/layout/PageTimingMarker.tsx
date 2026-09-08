"use client";

import { useEffect, useRef } from "react";
import { pageNavigationStart } from "@/lib/page-navigation-timing";

export function PageTimingMarker({ id, route, serverMs, dependenciesResolved }: {
  id: string;
  route: string;
  serverMs: number;
  dependenciesResolved: boolean;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const started = pageNavigationStart(route);
        if (started === null || !marker.current) return;
        const durationMs = Math.round((performance.now() - started) * 10) / 10;
        marker.current.dataset.renderedMs = String(durationMs);
        console.info(JSON.stringify({
          event: "fugue_web_page_rendered", id, route, durationMs,
          serverMs, dependenciesResolved,
        }));
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [id, route, serverMs, dependenciesResolved]);

  return <span hidden ref={marker} data-page-timing={route} data-trace-id={id}
    data-dependencies-resolved={String(dependenciesResolved)} data-server-ms={serverMs} />;
}
