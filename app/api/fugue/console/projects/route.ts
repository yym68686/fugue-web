import { NextResponse } from "next/server";

import { getConsoleProjectGalleryData } from "@/lib/console/gallery-data";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";
import { getRequestLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireSession();

  if (response) {
    return response;
  }

  try {
    const locale = await getRequestLocale();
    const data = await getConsoleProjectGalleryData({
      includeProjectImageUsage: false,
      includeRuntimeTargets: false,
      locale,
    });

    return NextResponse.json(
      {
        errors: data.errors,
        projects: data.projects,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
