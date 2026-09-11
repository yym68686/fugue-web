import { NextResponse } from "next/server";
import { getProjectTemplate } from "@/lib/templates/store";
import { revokeProjectTemplate } from "@/lib/templates/store";
import { requireActiveSessionUser } from "@/lib/fugue/product-route";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const template = await getProjectTemplate(token);
  if (!template) return NextResponse.json({ error: "Template not found or no longer available." }, { status: 404 });
  return NextResponse.json({ ok: true, result: { id: template.id, name: template.name, description: template.description, apps: template.apps.map((app) => ({ ...app, envKeys: app.envKeys ?? [] })), createdAt: template.createdAt, useCount: template.useCount } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ token: string }> }) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  const { token } = await context.params;
  const revoked = await revokeProjectTemplate(token, auth.session.email);
  if (!revoked) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
