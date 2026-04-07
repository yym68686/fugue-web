import { NextResponse } from "next/server";

import {
  getPasswordHashByEmail,
  removeAuthMethod,
  setPasswordAuthMethod,
  upsertEmailLinkAuthMethod,
} from "@/lib/auth/methods";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type PasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
};

function readAuthMethodFromSlug(value: string) {
  switch (value) {
    case "email-link":
      return "email_link" as const;
    case "password":
      return "password" as const;
    case "google":
      return "google" as const;
    case "github":
      return "github" as const;
    default:
      return null;
  }
}

function readPasswordValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(
  request: Request,
  context: RouteContextWithParams<"method">,
) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const methodSlug = await readRouteParam(context, "method");
  const method = readAuthMethodFromSlug(methodSlug);

  if (method === "email_link") {
    try {
      const methods = await upsertEmailLinkAuthMethod(session.email);
      return NextResponse.json({ methods, ok: true });
    } catch (error) {
      return jsonError(readErrorStatus(error), readErrorMessage(error));
    }
  }

  if (method !== "password") {
    return jsonError(405, "This method cannot be added here.");
  }

  let payload: PasswordPayload;

  try {
    payload = (await request.json()) as PasswordPayload;
  } catch {
    return jsonError(400, "Invalid request payload.");
  }

  const currentPassword = readPasswordValue(payload.currentPassword);
  const newPassword = readPasswordValue(payload.newPassword);
  const passwordHash = await getPasswordHashByEmail(session.email);
  const validationError = validatePassword(newPassword);

  if (validationError) {
    return NextResponse.json(
      {
        error: validationError,
        fieldErrors: {
          newPassword: validationError,
        },
      },
      { status: 400 },
    );
  }

  if (passwordHash) {
    if (!currentPassword) {
      return NextResponse.json(
        {
          error: "Enter your current password.",
          fieldErrors: {
            currentPassword: "Enter your current password.",
          },
        },
        { status: 400 },
      );
    }

    if (!(await verifyPassword(currentPassword, passwordHash))) {
      return NextResponse.json(
        {
          error: "Current password is incorrect.",
          fieldErrors: {
            currentPassword: "Current password is incorrect.",
          },
        },
        { status: 400 },
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          error: "Choose a new password.",
          fieldErrors: {
            newPassword: "Choose a new password.",
          },
        },
        { status: 400 },
      );
    }
  }

  try {
    const nextHash = await hashPassword(newPassword);
    const methods = await setPasswordAuthMethod(session.email, nextHash);

    return NextResponse.json({
      message: passwordHash ? "Password updated." : "Password added.",
      methods,
      ok: true,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContextWithParams<"method">,
) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const methodSlug = await readRouteParam(context, "method");
  const method = readAuthMethodFromSlug(methodSlug);

  if (!method) {
    return jsonError(404, "Unknown sign-in method.");
  }

  try {
    const methods = await removeAuthMethod(session.email, method);
    return NextResponse.json({ methods, ok: true });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
