import { NextResponse } from "next/server";
import { getAppEnv, getConsoleApp, getConsoleProject, inspectGitHubTemplate, type ConsoleAppDetail } from "@/lib/fugue/console";
import { createProjectTemplate, type TemplateApp, type TemplateSnapshot } from "@/lib/templates/store";
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

function appSource(app: ConsoleAppDetail) { return { ...(app.build_source ?? {}), ...(app.origin_source ?? {}) }; }

async function topologySnapshot(adminKey: string, apps: ConsoleAppDetail[]): Promise<TemplateSnapshot | null> {
  const composeApps = apps.filter((app) => Boolean(appSource(app).compose_service));
  if (composeApps.length < 2) return null;
  const sources = composeApps.map(appSource);
  if (sources.some((source) => !source.repo_url || !(source.type ?? "").toLowerCase().startsWith("github") || (source.type ?? "").toLowerCase().includes("private"))) throw new Error("A multi-service public template requires public GitHub Compose or Fugue Manifest sources for every service. This project has services without a shareable source artifact.");
  const repoUrl = sources[0].repo_url!;
  if (sources.some((source) => source.repo_url !== repoUrl)) throw new Error("All services in a shared topology must come from the same GitHub repository.");
  const branch = sources.map((source) => source.repo_branch).find(Boolean);
  const inspected = await inspectGitHubTemplate(adminKey, { repoUrl, branch, repoVisibility: "public" });
  const graph = inspected.compose_stack ?? inspected.fugue_manifest;
  const services = graph?.services ?? [];
  if (services.length < 2) throw new Error("The GitHub source does not contain a multi-service Compose or Fugue Manifest topology.");
  const currentNames = new Set(composeApps.map((app) => appSource(app).compose_service));
  const sourceNames = new Set(services.map((service) => service.service));
  if ([...currentNames].some((name) => !name || !sourceNames.has(name))) throw new Error("The deployed services do not match the GitHub topology. Re-import from the repository before sharing.");
  const envByService = new Map<string, string[]>();
  await Promise.all(composeApps.map(async (app) => { const name = appSource(app).compose_service!; const env = await getAppEnv(adminKey, app.id).catch(() => ({ env: {} })); envByService.set(name, Object.keys(env.env ?? {}).sort()); }));
  return { kind: "github-compose", repoUrl, branch: inspected.repository?.branch ?? branch, commitSha: inspected.repository?.commit_sha, services: services.map((service) => ({ name: service.service, envKeys: envByService.get(service.service) ?? [], backingService: service.backing_service, bindingTargets: service.binding_targets })) };
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSessionUser(); if (auth.response) return auth.response;
  const ws = await requireWorkspaceForSession(auth.session); if (ws.response) return ws.response;
  const id = await readRouteParam(context, "id");
  try { const project = await getConsoleProject(ws.workspace.adminKeySecret, id); const apps = (await Promise.all(project.apps.map(a => getConsoleApp(ws.workspace.adminKeySecret, a.id).catch(() => null)))).filter((a): a is ConsoleAppDetail => Boolean(a)); if (!apps.length) return jsonError(400, "Project has no apps to share."); let snapshot: TemplateSnapshot; if (apps.length === 1) snapshot = { kind: "single", apps: [await templateApp(ws.workspace.adminKeySecret, apps[0])] }; else { const topology = await topologySnapshot(ws.workspace.adminKeySecret, apps); if (!topology) throw new Error("This multi-service project has no retained public GitHub Compose or Fugue Manifest source. Image-only or old archive imports cannot be converted safely into a runnable shared template; re-import the original repository or archive first."); snapshot = topology; } const result = await createProjectTemplate({ ownerEmail: auth.session.email, name: project.project?.name || project.project_name || id, description: project.project?.description || "", snapshot }); return NextResponse.json({ ok: true, result }); } catch (error) { return jsonError(readErrorStatus(error), readErrorMessage(error)); }
}
