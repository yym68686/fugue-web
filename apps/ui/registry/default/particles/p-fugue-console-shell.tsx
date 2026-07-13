import { ActivityIcon, BoxIcon, KeyRoundIcon } from "lucide-react";

import { Badge } from "@/registry/default/ui/badge";
import { Button } from "@/registry/default/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/registry/default/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/registry/default/ui/sidebar";

const navigation = [
  { icon: BoxIcon, label: "Projects" },
  { icon: ActivityIcon, label: "Observability" },
  { icon: KeyRoundIcon, label: "API keys" },
];

export default function FugueConsoleShellParticle() {
  return (
    <SidebarProvider className="min-h-[32rem] overflow-hidden rounded-2xl border">
      <Sidebar collapsible="none">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Fugue</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map(({ icon: Icon, label }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton isActive={label === "Projects"}>
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="p-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Projects</h2>
            <p className="text-muted-foreground text-sm">Synthetic preview data</p>
          </div>
          <Button size="sm">New project</Button>
        </header>
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>sample-service</CardTitle>
            <Badge variant="success">Healthy</Badge>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            2 runtimes · updated moments ago
          </CardContent>
        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}
