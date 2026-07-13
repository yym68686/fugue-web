import Link from "next/link";

import { particles } from "@/registry/registry-particles";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/registry/default/ui/card";

export default function ParticlesPage() {
  return (
    <div className="registry-content">
      <h1 className="text-3xl font-semibold">Fugue particles</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Product-shaped recipes built only from registry primitives and synthetic data.
        Each preview is loaded on its own route.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {particles.map((particle) => (
          <Link href={`/particles/${particle.name}`} key={particle.name}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle>{particle.name}</CardTitle>
                <CardDescription>{particle.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
