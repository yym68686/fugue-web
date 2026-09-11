import { importGitHubApp, importImageApp, listProjectSlugs } from "@/lib/fugue/console";
import { getProjectTemplate, incrementProjectTemplateUse } from "@/lib/templates/store";
import { isObject, jsonError, readJsonBody, readOptionalString, readStringMap } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { resolveUniqueProjectName } from "@/lib/deploy/project-name";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params; const template = await getProjectTemplate(token);
  if (!template) return jsonError(404, "Template not found or no longer available.");
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  if (!isObject(body)) return jsonError(400, "Request body must be a JSON object.");
  const requestedName = readOptionalString(body, "projectName");
  return withWorkspaceKey(async (key) => {
    const projectName = resolveUniqueProjectName(requestedName || template.name, await listProjectSlugs(key));
    const env = readStringMap(body.env);
    const missingEnv = template.apps.flatMap((app) => (app.envKeys ?? []).filter((key) => !(key in env)).map((key) => `${app.name}: ${key}`));
    if (missingEnv.length) throw new Error(`Set required environment variables: ${missingEnv.join(", ")}`);
    const results = [];
    for (const app of template.apps) {
      const common = { projectName, projectDescription: template.description, appName: app.name, runtimeId: app.runtimeId, servicePort: app.servicePort, startupCommand: app.startupCommand, networkMode: app.networkMode, env };
      if (app.source.type === "image" && app.source.imageRef) results.push(await importImageApp(key, { ...common, imageRef: app.source.imageRef }));
      else if (app.source.type === "github" && app.source.repoUrl) results.push(await importGitHubApp(key, { ...common, repoUrl: app.source.repoUrl, branch: app.source.branch, repoVisibility: "public", buildStrategy: app.source.buildStrategy, dockerfilePath: app.source.dockerfilePath, buildContextDir: app.source.buildContextDir, sourceDir: app.source.sourceDir }));
      else throw new Error(`Template app ${app.name} has no deployable source.`);
    }
    await incrementProjectTemplateUse(template.id);
    const projectId = results.find((r) => r?.app?.project_id)?.app?.project_id || results.find((r) => r?.project?.id)?.project?.id;
    return { projectId, results };
  });
}
