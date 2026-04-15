import { after, NextResponse } from "next/server";

import type { ConsoleBillingPageSnapshot } from "@/lib/console/page-snapshot-types";
import { getBillingPageData } from "@/lib/billing/service";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleBillingPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function readIncludeUsage(request: Request) {
  return new URL(request.url).searchParams.get("include_usage") === "1";
}

export async function GET(request: Request) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    const includeUsage = readIncludeUsage(request);

    if (!includeUsage) {
      after(async () => {
        try {
          await getBillingPageData(session.email, {
            includeCurrentUsage: true,
          });
        } catch (error) {
          console.error("Billing usage background sync failed.", error);
        }
      });
    }

    const data = await getBillingPageData(session.email, {
      includeCurrentUsage: includeUsage,
    });

    if (!data) {
      return jsonSnapshot({
        state: "workspace-missing",
      });
    }

    return jsonSnapshot({
      data,
      state: "ready",
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
