import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@fugue/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@fugue/ui/components/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@fugue/ui/components/field";
import { Input } from "@fugue/ui/components/input";
import { Skeleton } from "@fugue/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@fugue/ui/components/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@fugue/ui/components/tabs";
import { CircleAlertIcon, PlusIcon } from "lucide-react";

export default function FixturePage() {
  return (
    <div className="mx-auto grid min-h-svh w-full max-w-6xl gap-8 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-muted-foreground text-sm">visual fixture</p>
          <h1 className="text-3xl font-semibold">Fugue console composition</h1>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}>
            <PlusIcon aria-hidden="true" />
            New project
          </DialogTrigger>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>This fixture does not submit data.</DialogDescription>
            </DialogHeader>
            <div className="p-6">
              <FieldGroup>
                <Field name="name">
                  <FieldLabel>Project name</FieldLabel>
                  <Input autoComplete="off" name="name" placeholder="sample-service" />
                </Field>
              </FieldGroup>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <DialogClose render={<Button />}>Create</DialogClose>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      </header>

      <Tabs defaultValue="resources">
        <TabsList aria-label="Fixture states">
          <TabsTab value="resources">Resources</TabsTab>
          <TabsTab value="empty">Empty</TabsTab>
          <TabsTab value="loading">Loading</TabsTab>
          <TabsTab value="error">Error</TabsTab>
        </TabsList>
        <TabsPanel className="mt-4" value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Runtimes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table aria-label="Fixture runtimes">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono">api-us</TableCell>
                    <TableCell>us-west</TableCell>
                    <TableCell>
                      <Badge variant="success">Healthy</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono">worker-eu</TableCell>
                    <TableCell>eu-central</TableCell>
                    <TableCell>
                      <Badge variant="warning">Deploying</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsPanel>
        <TabsPanel className="mt-4" value="empty">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No runtimes yet</EmptyTitle>
              <EmptyDescription>
                Create a runtime to begin serving traffic.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm">Create runtime</Button>
            </EmptyContent>
          </Empty>
        </TabsPanel>
        <TabsPanel className="mt-4" value="loading">
          <section
            aria-label="Loading runtime resources"
            aria-live="polite"
            className="grid gap-3"
          >
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </section>
        </TabsPanel>
        <TabsPanel className="mt-4" value="error">
          <Alert variant="error">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>Could not load runtimes</AlertTitle>
            <AlertDescription>Check the connection and try again.</AlertDescription>
          </Alert>
        </TabsPanel>
      </Tabs>
    </div>
  );
}
