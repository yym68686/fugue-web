import { NextResponse } from "next/server";
import { getAppEnv, getConsoleApp, getConsoleProject, type ConsoleAppDetail } from "@/lib/fugue/console";
import { createProjectTemplate, type TemplateApp } from "@/lib/templates/store";
import { jsonError, readErrorMessage, readErrorStatus, readRouteParam } from "@/lib/fugue/product-route";
import { requireActiveSessionUser, requireWorkspaceForSession } from "@/lib/fugue/product-route";

async function templateApp(adminKey: string, app: ConsoleAppDetail): Promise<TemplateApp> {
  const source = { ...(app.build_source ?? {}), ...(app.origin_source ?? {}) };
  const type = source.type === "image" || source.image_ref || source.resolved_image_ref ? "image" : "github";
  if (type === "github" && source.type?.toLowerCase().includes("private")) throw new Error(`App ${app.name} uses a private repository. Connect GitHub before sharing a public template.`);
  if (type === "image" && !(source.image_ref || source.resolved_image_ref)) throw new Error(`App ${app.name} has no reusable image source.`);
  if (type === "github" && !source.repo_url) throw new Error(`App ${app.name} has an unsupported source. Only GitHub and image apps can be shared.`);
  const env = await getAppEnv(adminKey, app.id).catch(() => ({ env: {} }));
  return { name: app.name, description: app.description ?? "", source: type === "image" ? { type, imageRef: source.image_ref ?? source.resolved_image_ref } : { type, repoUrl: source.repo_url, branch: source.repo_branch, buildStrategy: source.build_strategy, dockerfilePath: source.dockerfile_path }, runtimeId: app.spec?.runtime_id, servicePort: app.spec?.ports?.[0], startupCommand: app.spec?.command, networkMode: app.spec?.network_mode, envKeys: Object.keys(env.env ?? {}).sort() };
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSessionUser(); if (auth.response) return auth.response;
  const ws = await requireWorkspaceForSession(auth.session); if (ws.response) return ws.response;
  const id = await readRouteParam(context, "id");
  try { const project = await getConsoleProject(ws.workspace.adminKeySecret, id); const apps = (await Promise.all(project.apps.map(a => getConsoleApp(ws.workspace.adminKeySecret, a.id).catch(() => null)))).filter((a): a is ConsoleAppDetail => Boolean(a)); if (!apps.length) return jsonError(400, "Project has no apps to share."); if (apps.length > 1) return jsonError(400, "Sharing projects with multiple apps is not supported yet."); const result = await createProjectTemplate({ ownerEmail: auth.session.email, name: project.project?.name || project.project_name || id, description: project.project?.description || "", apps: await Promise.all(apps.map(a => templateApp(ws.workspace.adminKeySecret, a))) }); return NextResponse.json({ ok: true, result }); } catch (error) { return jsonError(readErrorStatus(error), readErrorMessage(error)); }
}
