export const docsSections = [
  {
    id: "quickstart",
    title: "CLI quick start",
    body: "Install Fugue, authenticate, and import a service from a repository, image, or local upload.",
    code: "fugue login\nfugue import github owner/repo --port 3000\nfugue app logs web --follow",
  },
  {
    id: "imports",
    title: "Import modes",
    body: "GitHub repository, Docker image, and local upload all create the same project/service graph.",
    code: "fugue import image registry.example.com/team/web:latest --name web\nfugue import upload ./dist --name static-site",
  },
  {
    id: "topology",
    title: "fugue.yaml topology",
    body: "Topology files describe services, routes, backing services, runtime targets, and persistent mounts.",
    code: "services:\n  web:\n    port: 3000\n    route: public\n  db:\n    type: postgres\n    failover: managed",
  },
  {
    id: "diagnose",
    title: "Inspect and diagnose",
    body: "Use inspect and diagnose to compare configured intent against runtime state.",
    code: "fugue app inspect web\nfugue app diagnose web --runtime <runtime-id>",
  },
];
