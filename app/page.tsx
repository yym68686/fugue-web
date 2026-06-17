import { ArrowRight, Boxes, Server, UploadCloud } from "lucide-react";

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardFrame,
  CardHeader,
  CodeBlock,
  MetricStrip,
} from "@/components/coss/ui";
import { FeatureList, PublicShell } from "@/components/fugue-coss/shells";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getCurrentSession();

  return (
    <PublicShell>
      <section className="coss-container coss-hero-grid">
        <div className="coss-stack">
          <span className="coss-eyebrow">managed first / owned runtime later</span>
          <h1 className="coss-heading-xl">
            Ship on Fugue, then move the same app to your own server.
          </h1>
          <p className="coss-page-description">
            Import from GitHub, a Docker image, or a local upload. Fugue starts it on shared managed runtime and keeps the route, env, logs, files, images, and migration surface in one console.
          </p>
          <div className="coss-actions">
            <ButtonLink href={session ? "/app" : "/new/repository"}>
              {session ? "Open console" : "Get started"}
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/docs" variant="outline">
              Read docs
            </ButtonLink>
          </div>
        </div>
        <CardFrame>
          <CardHeader title="Deployment graph" description="The COSS-style product panel keeps the first workflow visible." />
          <CardContent className="coss-stack">
            <MetricStrip
              items={[
                { label: "Source", value: "GitHub" },
                { label: "Runtime", value: "shared" },
                { label: "Route", value: "public" },
                { label: "Migration", value: "ready" },
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
              title: "GitHub repository",
              description: "Connect a repository, choose a branch, authorize private access, and create the first service.",
              meta: "source",
            },
            {
              title: "Docker image",
              description: "Point Fugue at an existing image and keep runtime, env, route, and logs in the same console.",
              meta: "image",
            },
            {
              title: "Local upload",
              description: "Upload a build artifact before auth and resume the pending deploy after sign-in.",
              meta: "upload",
            },
          ]}
        />
        <div className="coss-grid-3">
          <Card>
            <CardContent className="coss-stack-sm">
              <Boxes aria-hidden="true" />
              <strong>Project workbench</strong>
              <p className="coss-card-description">Routes, env, logs, files, images, observability, and settings live with the service.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="coss-stack-sm">
              <Server aria-hidden="true" />
              <strong>Runtime servers</strong>
              <p className="coss-card-description">Add your own machines, inspect pressure, and move workloads without changing the product model.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="coss-stack-sm">
              <UploadCloud aria-hidden="true" />
              <strong>Capacity and billing</strong>
              <p className="coss-card-description">Prepaid balance, managed envelope, storage, and events are visible from one page.</p>
            </CardContent>
          </Card>
        </div>
        <CardFrame>
          <CardContent className="coss-row" style={{ justifyContent: "space-between" }}>
            <div>
              <Badge tone="success">Console ready</Badge>
              <h2 className="coss-page-title">Open the operational surface first.</h2>
              <p className="coss-card-description">The app shell, docs shell, auth panels, deploy wizard, and admin pages now share the same COSS foundation.</p>
            </div>
            <ButtonLink href="/app">Open console</ButtonLink>
          </CardContent>
        </CardFrame>
      </section>
    </PublicShell>
  );
}
