import { importGitHubApp, importImageApp, inspectGitHubTemplate, listProjectSlugs } from "@/lib/fugue/console";
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
    if (template.kind === "github-compose" && template.topology) {
      const serviceEnvRaw = isObject(body.serviceEnv) ? body.serviceEnv : {};
      const serviceEnv: Record<string, Record<string, string>> = {};
      for (const service of template.topology.services) {
        const values = isObject(serviceEnvRaw[service.name]) ? readStringMap(serviceEnvRaw[service.name]) : {};
        if (Object.keys(values).length) serviceEnv[service.name] = values;
      }
      const source = await inspectGitHubTemplate(key, { repoUrl: template.topology.repoUrl, branch: template.topology.commitSha || template.topology.branch, repoVisibility: "public" });
      const graph = source.compose_stack ?? source.fugue_manifest;
      const currentServices = (graph?.services ?? []).map((service) => service.service).sort();
      const expectedServices = template.topology.services.map((service) => service.name).sort();
      if (currentServices.join("\0") !== expectedServices.join("\0")) throw new Error("The shared source topology changed after this template was created. Deployment was stopped before creating any resources.");
      const preview = await importGitHubApp(key, { projectName, projectDescription: template.description, repoUrl: template.topology.repoUrl, branch: template.topology.commitSha || template.topology.branch, repoVisibility: "public", serviceEnv, dryRun: true });
      const plan = preview.plan as { services?: Array<{ name?: string; service?: string }> } | undefined;
      const plannedServices = (plan?.services ?? []).map((service) => service.name ?? service.service).filter(Boolean).sort();
      if (plannedServices.length && plannedServices.join("\0") !== expectedServices.join("\0")) throw new Error("Fugue's deployment plan does not match the shared service topology. Deployment was stopped before creating any resources.");
      const result = await importGitHubApp(key, { projectName, projectDescription: template.description, repoUrl: template.topology.repoUrl, branch: template.topology.commitSha || template.topology.branch, repoVisibility: "public", serviceEnv });
      await incrementProjectTemplateUse(template.id);
      const projectId = result.apps?.find((app) => app.project_id)?.project_id || result.project?.id;
      return { projectId, results: [result] };
    }
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
