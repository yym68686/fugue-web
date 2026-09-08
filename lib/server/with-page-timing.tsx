import "server-only";

import { PageTimingMarker } from "@/components/layout/PageTimingMarker";
import { tracePage } from "@/lib/server/page-timing";

export function withPageTiming(route: string, render: () => Promise<React.ReactNode>) {
  return async function TimedPage() {
    const { result, timing } = await tracePage(route, render);
    return <>{result}<PageTimingMarker {...timing} /></>;
  };
}
