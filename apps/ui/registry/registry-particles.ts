import type { Registry } from "shadcn/schema";

import { categories } from "@/registry/registry-categories";

export const particles = [
  {
    name: "p-fugue-auth-form",
    description: "Accessible Fugue auth form composition with safe example data.",
    type: "registry:block",
    categories: categories("form", "field", "validation"),
    registryDependencies: [
      "@fugue/alert",
      "@fugue/button",
      "@fugue/field",
      "@fugue/form",
      "@fugue/input",
    ],
    files: [{ path: "particles/p-fugue-auth-form.tsx", type: "registry:block" }],
  },
  {
    name: "p-fugue-console-shell",
    description: "Fugue console shell composition with sidebar and resource status.",
    type: "registry:block",
    categories: categories("card", "sidebar", "badge"),
    registryDependencies: [
      "@fugue/badge",
      "@fugue/button",
      "@fugue/card",
      "@fugue/sidebar",
    ],
    dependencies: ["lucide-react"],
    files: [{ path: "particles/p-fugue-console-shell.tsx", type: "registry:block" }],
  },
  {
    name: "p-fugue-resource-table",
    description: "Dense, labelled resource table with status and row action.",
    type: "registry:block",
    categories: categories("table", "badge"),
    registryDependencies: ["@fugue/badge", "@fugue/button", "@fugue/table"],
    files: [{ path: "particles/p-fugue-resource-table.tsx", type: "registry:block" }],
  },
  {
    name: "p-fugue-environment-editor",
    description: "Environment variable editor using Field and InputGroup contracts.",
    type: "registry:block",
    categories: categories("field", "input group", "form"),
    registryDependencies: [
      "@fugue/button",
      "@fugue/field",
      "@fugue/input",
      "@fugue/input-group",
    ],
    dependencies: ["lucide-react"],
    files: [
      { path: "particles/p-fugue-environment-editor.tsx", type: "registry:block" },
    ],
  },
] satisfies Registry["items"];
