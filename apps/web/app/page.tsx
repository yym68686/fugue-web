import { ArrowRight, Boxes, Server, UploadCloud } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import {
  Card,
  CardContent,
  CardFrame,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@fugue/ui/components/card";
import { MetricStrip } from "@/components/console/metric-strip";
import { CodeBlock } from "@/components/shared/code-block";
import { FeatureList, PublicShell } from "@/components/fugue-coss/shells";
import { getRequestI18n } from "@/lib/i18n/server";
import { createShellMessages } from "@/lib/i18n/ui-messages";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();
  const title = t("Deploy on managed runtime, then move to your own server");
  const description = t(
    "Import from GitHub, a Docker image, or a local upload, then operate routes, environment, logs, files, images, and runtime migration in one console.",
  );

  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, url: "/" },
    twitter: { title, description },
  };
}

export default async function HomePage() {
  const { t } = await getRequestI18n();

  return (
    <PublicShell messages={createShellMessages(t)}>
      <section className="coss-container coss-hero-grid">
        <div className="coss-stack">
          <span className="coss-eyebrow">
            {t("managed first / owned runtime later")}
          </span>
          <h1 className="coss-heading-xl">
            {t("Ship on Fugue, then move the same app to your own server.")}
          </h1>
          <p className="coss-page-description">
            {t(
              "Import from GitHub, a Docker image, or a local upload. Fugue starts it on shared managed runtime and keeps the route, env, logs, files, images, and migration surface in one console.",
            )}
          </p>
          <div className="coss-actions">
            <Button render={<Link href="/new/repository" />}>
              {t("Get started")}
              <ArrowRight aria-hidden="true" />
            </Button>
            <Button render={<Link href="/docs" />} variant="outline">
              {t("Read docs")}
            </Button>
          </div>
        </div>
        <CardFrame>
          <CardHeader>
            <CardTitle render={<h2>{t("Deployment graph")}</h2>} />
            <CardDescription>
              {t("The product panel keeps the first workflow visible.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="coss-stack">
            <MetricStrip
              items={[
                { label: t("Source"), value: "GitHub" },
                { label: t("Runtime"), value: t("shared") },
                { label: t("Route"), value: t("public") },
                { label: t("Migration"), value: t("ready") },
              ]}
            />
            <CodeBlock>{`fugue import github owner/repo --port 3000\nfugue app logs web --follow\nfugue runtime migrate web --target <runtime-id>`}</CodeBlock>
          </CardContent>
        </CardFrame>
      </section>
      <section className="coss-container coss-page coss-stack">
        <FeatureList
          items={[
            {
              title: t("GitHub repository"),
              description: t(
                "Connect a repository, choose a branch, authorize private access, and create the first service.",
              ),
              meta: t("source"),
            },
            {
              title: t("Docker image"),
              description: t(
                "Point Fugue at an existing image and keep runtime, env, route, and logs in the same console.",
              ),
              meta: t("image"),
            },
            {
              title: t("Local upload"),
              description: t(
                "Upload a build artifact before auth and resume the pending deploy after sign-in.",
              ),
              meta: t("upload"),
            },
          ]}
        />
        <div className="coss-grid-3">
          <Card>
            <CardContent className="coss-stack-sm">
              <Boxes aria-hidden="true" />
              <strong>{t("Project workbench")}</strong>
              <p className="coss-card-description">
                {t(
                  "Routes, env, logs, files, images, observability, and settings live with the service.",
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="coss-stack-sm">
              <Server aria-hidden="true" />
              <strong>{t("Runtime servers")}</strong>
              <p className="coss-card-description">
                {t(
                  "Add your own machines, inspect pressure, and move workloads without changing the product model.",
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="coss-stack-sm">
              <UploadCloud aria-hidden="true" />
              <strong>{t("Capacity and billing")}</strong>
              <p className="coss-card-description">
                {t(
                  "Prepaid balance, managed envelope, storage, and events are visible from one page.",
                )}
              </p>
            </CardContent>
          </Card>
        </div>
        <CardFrame>
          <CardContent className="coss-row coss-row--between">
            <div>
              <Badge variant="success">{t("Console ready")}</Badge>
              <h2 className="coss-page-title">
                {t("Open the operational surface first.")}
              </h2>
              <p className="coss-card-description">
                {t(
                  "The app shell, docs shell, auth panels, deploy wizard, and admin pages share the same component foundation.",
                )}
              </p>
            </div>
            <Button render={<Link href="/app" />}>{t("Open console")}</Button>
          </CardContent>
        </CardFrame>
      </section>
    </PublicShell>
  );
}
