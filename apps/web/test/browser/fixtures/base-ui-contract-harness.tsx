import { Button } from "@fugue/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@fugue/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@fugue/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@fugue/ui/components/tabs";
import { createRoot } from "react-dom/client";

function ContractHarness() {
  return (
    <main>
      <h1>Base UI contract harness</h1>
      <Tabs defaultValue="overview">
        <TabsList aria-label="Deployment views">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Table>
            <TableCaption>Deployment inventory</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Service</TableHead>
                <TableHead scope="col">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>web</TableCell>
                <TableCell>Ready</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="settings">Deployment settings</TabsContent>
        <TabsContent value="history">Deployment history</TabsContent>
      </Tabs>

      <Dialog>
        <DialogTrigger render={<Button />}>Open resource details</DialogTrigger>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Resource details</DialogTitle>
            <DialogDescription>
              Inspect the selected deployment resource.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>Resource content</DialogPanel>
        </DialogPopup>
      </Dialog>
    </main>
  );
}

const rootElement = document.getElementById("contract-root");

if (!rootElement) {
  throw new Error("Missing Base UI contract harness root.");
}

createRoot(rootElement).render(<ContractHarness />);
document.body.dataset.contractHarness = "ready";
