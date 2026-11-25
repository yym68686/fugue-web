"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import type { ProjectTemplate } from "@/lib/templates/store";

export default function TemplateDeploy({ token, template }: { token: string; template: ProjectTemplate }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const zh = locale === "zh-CN";
  const [name, setName] = useState(`${template.name}${zh ? " 副本" : " copy"}`);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [serviceEnv, setServiceEnv] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const envKeys = [...new Set(template.apps.flatMap((app) => app.envKeys ?? []))];
  const topology = template.topology;
  const deploymentError = zh ? "部署失败" : "Deployment failed";

  async function deploy() {
    if (busy || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(token)}/deploy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: name, env, serviceEnv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || deploymentError);
      const id = data.result?.projectId;
      router.push(id ? `/projects/${encodeURIComponent(id)}` : "/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : deploymentError);
      setBusy(false);
    }
  }

  return <div className="template-deploy">
    <section>
      <h2>{topology ? (zh ? "包含的服务" : "Included services") : (zh ? "包含的应用" : "Included apps")}</h2>
      <ul className="template-services">
        {template.apps.map((app) => <li key={app.name}>
          <strong>{app.name}</strong>
          <span className="mono">{app.source.type === "image" ? app.source.imageRef : app.source.repoUrl}</span>
        </li>)}
      </ul>
    </section>
    <form onSubmit={(e) => { e.preventDefault(); void deploy(); }}>
      <h2>{zh ? "部署模板" : "Deploy template"}</h2>
      <label className="template-field">{t("Project name")}<input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      {topology ? topology.services.filter((service) => service.envKeys.length > 0).map((service) => (
        <fieldset key={service.name}><legend>{service.name}</legend>
          {service.envKeys.map((key) => (
            <label className="template-field" key={key}>{key}
              <input className="input mono" type="password" value={serviceEnv[service.name]?.[key] ?? ""}
                onChange={(e) => setServiceEnv((current) => ({ ...current, [service.name]: { ...current[service.name], [key]: e.target.value } }))}
                placeholder={zh ? "可选覆盖" : "Optional override"} autoComplete="off" />
            </label>
          ))}
        </fieldset>
      )) : envKeys.map((key) => <label key={key} className="template-field">{key}
        <input className="input mono" type="password" value={env[key] ?? ""}
          onChange={(e) => setEnv((current) => ({ ...current, [key]: e.target.value }))}
          placeholder={zh ? "必填机密" : "Required secret"} autoComplete="off" required />
      </label>)}
      <p className="form-hint">{zh ? "不包含机密和账户专属设置。Compose 模板在创建资源前会先检查并试运行。" : "Secrets and account-specific settings are not included. Compose templates are inspected and dry-run before creating resources."}</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="btn primary" disabled={busy || !name.trim()}>{busy ? t("Deploying…") : (zh ? "部署模板" : "Deploy template")}</button>
    </form>
  </div>;
}
