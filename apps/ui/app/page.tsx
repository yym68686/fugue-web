import Link from "next/link";

import { Button } from "@/registry/default/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/registry/default/ui/card";

export default function RegistryHome() {
  return (
    <div className="registry-content">
      <p className="font-mono text-muted-foreground text-sm">@fugue/ui</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        One registry, one runtime package.
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        This private surface documents the Base UI primitives, semantic tokens,
        particles, and one-way sync contract used by Fugue Web.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button render={<Link href="/docs" />}>Read the docs</Button>
        <Button render={<Link href="/particles" />} variant="outline">
          Browse particles
        </Button>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Registry source</CardTitle>
            <CardDescription>
              Editable primitives live only under apps/ui/registry/default.
            </CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-sm">@fugue/*</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Runtime package</CardTitle>
            <CardDescription>
              Generated package exports are consumed through direct subpaths.
            </CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-sm">
            @fugue/ui/components/*
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Composition model</CardTitle>
            <CardDescription>
              Base UI render composition preserves semantics and focus behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-sm">
            render=&#123;&lt;Link /&gt;&#125;
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
