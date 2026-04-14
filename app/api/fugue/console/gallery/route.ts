import { after, NextResponse } from "next/server";

import {
  getConsoleProjectGallerySummaryData,
  getConsoleProjectGalleryUsageData,
} from "@/lib/console/gallery-data";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

function readIncludeUsage(request: Request) {
  return new URL(request.url).searchParams.get("include_usage") === "1";
}

export async function GET(request: Request) {
  const { response } = await requireSession();

  if (response) {
    return response;
  }

  try {
    if (readIncludeUsage(request)) {
      return NextResponse.json(await getConsoleProjectGalleryUsageData(), {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    after(async () => {
      try {
        await getConsoleProjectGalleryUsageData();
      } catch (error) {
        console.error("Console gallery usage background sync failed.", error);
      }
    });

    const data = await getConsoleProjectGallerySummaryData();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
