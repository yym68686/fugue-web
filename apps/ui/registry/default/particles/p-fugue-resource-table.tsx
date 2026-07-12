import { Badge } from "@/registry/default/ui/badge";
import { Button } from "@/registry/default/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/default/ui/table";

const resources = [
  { id: "api-us", region: "us-west", state: "Healthy" },
  { id: "worker-eu", region: "eu-central", state: "Deploying" },
];

export default function FugueResourceTableParticle() {
  return (
    <Table aria-label="Example runtime resources" variant="card">
      <TableHeader>
        <TableRow>
          <TableHead>Runtime</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => (
          <TableRow key={resource.id}>
            <TableCell className="font-mono">{resource.id}</TableCell>
            <TableCell>{resource.region}</TableCell>
            <TableCell>
              <Badge variant={resource.state === "Healthy" ? "success" : "warning"}>
                {resource.state}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button size="xs" variant="ghost">
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
