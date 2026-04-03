import { NextResponse } from "next/server";

import { getConsoleProjectGalleryData } from "@/lib/console/gallery-data";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireSession();

  if (response) {
    return response;
  }

  try {
    const data = await getConsoleProjectGalleryData({
      includeProjectImageUsage: false,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
