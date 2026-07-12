"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent } from "@fugue/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { RotateCcw } from "lucide-react";
import { ConsoleLoadingState } from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import {
  useEndpointData,
  type WorkbenchAppService,
} from "@/components/fugue-coss/project-workbench-shared";
import type { ConsoleProjectDetailData } from "@/lib/console/gallery-types";
import type { ProjectWorkbenchStateMessages } from "@/lib/i18n/console-messages";

export function CustomDomainsPanel({
  initialDomains,
  messages,
  service,
}: {
  initialDomains?: ConsoleProjectDetailData["initialDomains"];
  messages: ProjectWorkbenchStateMessages;
  service: WorkbenchAppService;
}) {
  type DomainListData = NonNullable<
    NonNullable<ConsoleProjectDetailData["initialDomains"]>["data"]
  >;
  const endpoint = `/api/fugue/apps/${encodeURIComponent(service.id)}/domains`;
  const { data, error, loading, refresh } = useEndpointData<DomainListData>(endpoint, {
    initialData:
      initialDomains?.appId === service.id
        ? {
            data: initialDomains.data,
            endpoint,
            error: initialDomains.error,
          }
        : undefined,
  });
  const rows = (data?.domains ?? []).map((domain) => ({
    ...domain,
    id: domain.hostname,
  }));

  return (
    <Card className="coss-card--muted">
      <ConsoleCardHeader
        title="Custom domains"
        description="AppDomain DNS ownership mode, verification, and TLS state."
        action={
          <Button
            variant="outline"
            size="sm"
            loading={loading}
            onClick={() => refresh()}
          >
            <RotateCcw aria-hidden="true" />
            Refresh
          </Button>
        }
      />
      <CardContent className="coss-stack-sm">
        {error ? (
          <Alert variant="warning" role="status">
            <AlertTitle>{messages.customDomainsUnavailable}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {rows.length ? (
          <DataTable
            columns={["Host", "DNS mode", "DNS", "TLS", "Record"]}
            rows={rows}
            renderRow={(domain) => (
              <tr key={domain.hostname}>
                <td className="coss-mono">{domain.hostname}</td>
                <td>{domain.dnsMode ?? "external"}</td>
                <td>
                  <Badge variant={domain.status === "verified" ? "success" : "warning"}>
                    {domain.status ?? "pending"}
                  </Badge>
                </td>
                <td>
                  <Badge variant={domain.tlsStatus === "ready" ? "success" : "warning"}>
                    {domain.tlsStatus ?? "pending"}
                  </Badge>
                </td>
                <td className="coss-mono">{domain.dnsRecordId ?? "-"}</td>
              </tr>
            )}
          />
        ) : loading ? (
          <ConsoleLoadingState label="Loading domains">
            <Skeleton style={{ height: 42 }} />
          </ConsoleLoadingState>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{messages.noCustomDomains}</EmptyTitle>
              <EmptyDescription>{messages.noCustomDomainsDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
