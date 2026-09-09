import "server-only";
import { headers } from "next/headers";

import { PageTimingMarker } from "@/components/layout/PageTimingMarker";
import { tracePage } from "@/lib/server/page-timing";

export function withPageTiming(route: string, render: () => Promise<React.ReactNode>) {
  return async function TimedPage() {
    const requestHeaders = await headers();
    const { result, timing } = await tracePage(route, render, {
      edgeRequestId: requestHeaders.get("x-fugue-edge-request-id"),
    });
    return <>{result}<PageTimingMarker {...timing} /></>;
  };
}
