import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Index } from "@/registry/__index__";
import { particles } from "@/registry/registry-particles";
import { Skeleton } from "@/registry/default/ui/skeleton";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return particles.map((particle) => ({ name: particle.name }));
}

export default async function ParticlePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const entry = Index[(await params).name];
  if (!entry) notFound();
  const Preview = entry.component;

  return (
    <div className="registry-content">
      <p className="font-mono text-muted-foreground text-sm">registry:block</p>
      <h1 className="mt-2 text-3xl font-semibold">{entry.name}</h1>
      {entry.description ? (
        <p className="mt-3 text-muted-foreground">{entry.description}</p>
      ) : null}
      <div className="mt-8 rounded-2xl border bg-background p-4 sm:p-8">
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <Preview />
        </Suspense>
      </div>
    </div>
  );
}
