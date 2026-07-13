"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Badge } from "@fugue/ui/components/badge";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent, CardFrame } from "@fugue/ui/components/card";
import { Checkbox } from "@fugue/ui/components/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { Field, FieldDescription, FieldLabel } from "@fugue/ui/components/field";
import { Input } from "@fugue/ui/components/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@fugue/ui/components/select";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { TableCell, TableRow } from "@fugue/ui/components/table";
import { Textarea } from "@fugue/ui/components/textarea";
import { toastManager } from "@fugue/ui/components/toast";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { DataTable } from "@/components/console/data-table";
import { MetricStrip } from "@/components/console/metric-strip";
import { ConfirmationDialog, ConsoleDrawer } from "@/components/console/overlays";
import type {
  FugueHostedDNSRecordResult,
  FugueHostedDNSRecordType,
} from "@/components/fugue-coss/api-types";
import {
  CONSOLE_DNS_PAGE_SNAPSHOT_URL,
  invalidateConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleDNSPageSnapshot } from "@/lib/console/page-snapshot-types";
import type { DNSRecordView, DNSZoneView } from "@/lib/dns/service";
import type { DnsStateMessages } from "@/lib/i18n/console-messages";
import type { Locale } from "@/lib/i18n/core";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

type BadgeTone = "default" | "success" | "warning" | "destructive" | "info";

type RecordDraft = {
  flatten: boolean;
  flattenFallbackPolicy: "stale_if_error" | "fail_closed" | "empty_noerror";
  flattenMode: "none" | "apex" | "always" | "app";
  flattenTarget: string;
  name: string;
  overwrite: boolean;
  record: DNSRecordView | null;
  status: "active" | "degraded" | "disabled" | "conflict";
  ttl: string;
  type: FugueHostedDNSRecordType;
  valuesText: string;
};

type ConfirmState = {
  action: () => Promise<void>;
  description: string;
  label: string;
  title: string;
};

const DNS_RECORD_TYPES: FugueHostedDNSRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "MX",
  "CAA",
  "SRV",
  "ALIAS",
  "ANAME",
  "FUGUE_APP",
];

const EMPTY_RECORD_DRAFT: RecordDraft = {
  flatten: false,
  flattenFallbackPolicy: "stale_if_error",
  flattenMode: "none",
  flattenTarget: "",
  name: "@",
  overwrite: false,
  record: null,
  status: "active",
  ttl: "300",
  type: "A",
  valuesText: "",
};

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

function badgeToneFromConsoleTone(tone: string): BadgeTone {
  if (tone === "positive") return "success";
  if (tone === "warning") return "warning";
  if (tone === "danger") return "destructive";
  if (tone === "info") return "info";
  return "default";
}

function formatDate(locale: Locale, value: string | null, notYet: string) {
  if (!value) {
    return notYet;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function splitValues(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRecordDraft(record: DNSRecordView): RecordDraft {
  return {
    flatten:
      record.flattenMode === "always" ||
      record.flattenMode === "apex" ||
      record.flattenMode === "app",
    flattenFallbackPolicy:
      (record.flattenFallbackPolicy as RecordDraft["flattenFallbackPolicy"]) ??
      "stale_if_error",
    flattenMode: (record.flattenMode as RecordDraft["flattenMode"]) ?? "none",
    flattenTarget: record.flattenTarget ?? "",
    name: record.name,
    overwrite: false,
    record,
    status: record.status as RecordDraft["status"],
    ttl: String(record.ttl),
    type: record.type,
    valuesText: record.values.join("\n"),
  };
}

function buildRecordPayload(draft: RecordDraft) {
  const values = splitValues(draft.valuesText);
  const ttl = Number(draft.ttl);
  const flattenTarget = draft.flattenTarget.trim() || values[0] || "";
  const flattenMode =
    draft.type === "FUGUE_APP"
      ? "app"
      : draft.flatten
        ? draft.flattenMode === "none"
          ? "always"
          : draft.flattenMode
        : undefined;

  return {
    ...(draft.flatten || draft.type === "FUGUE_APP" ? { flatten: true } : {}),
    ...(draft.flatten || draft.type === "FUGUE_APP"
      ? { flattenFallbackPolicy: draft.flattenFallbackPolicy }
      : {}),
    ...(flattenMode ? { flattenMode } : {}),
    ...(flattenTarget &&
    (draft.flatten || draft.type === "ALIAS" || draft.type === "ANAME")
      ? { flattenTarget }
      : {}),
    ...(draft.overwrite ? { overwrite: true } : {}),
    ...(Number.isFinite(ttl) && ttl > 0 ? { ttl } : {}),
    name: draft.name.trim(),
    status: draft.status,
    type: draft.type,
    values,
  };
}

function recordTypeHelp(type: FugueHostedDNSRecordType, name: string) {
  if (type === "CNAME" && name.trim() === "@") {
    return "Apex CNAME is published with flattening, not as a standard CNAME RR.";
  }

  if (type === "ALIAS" || type === "ANAME") {
    return "Published as A/AAAA answers resolved from the target hostname.";
  }

  if (type === "FUGUE_APP") {
    return "Published as route-ready Fugue edge A/AAAA answers for the selected app.";
  }

  return "One value per line.";
}

function ZoneSelector({
  busy,
  onPreflight,
  onSelect,
  selectedZone,
  zones,
}: {
  busy: string | null;
  onPreflight: (zone: DNSZoneView) => void;
  onSelect: (zoneName: string) => void;
  selectedZone: DNSZoneView | null;
  zones: DNSZoneView[];
}) {
  if (!zones.length) {
    return null;
  }

  return (
    <CardFrame>
      <ConsoleCardHeader
        title="Zones"
        description="Delegation status and Fugue nameservers for hosted DNS zones."
      />
      <CardContent>
        <div className="coss-grid-3">
          {zones.map((zone) => (
            <Card
              className={selectedZone?.id !== zone.id ? "coss-card--muted" : undefined}
              key={zone.id}
            >
              <CardContent className="coss-stack-sm">
                <div className="coss-row coss-row--between">
                  <strong className="coss-mono">{zone.zoneName}</strong>
                  <Badge variant={badgeToneFromConsoleTone(zone.statusTone)}>
                    {zone.status}
                  </Badge>
                </div>
                <span className="coss-help">{zone.delegationLabel}</span>
                <span className="coss-help">
                  NS {zone.expectedNameservers.join(", ") || "not configured"}
                </span>
                <div className="coss-row">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelect(zone.zoneName)}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === `preflight:${zone.zoneName}`}
                    onClick={() => onPreflight(zone)}
                  >
                    <RefreshCw aria-hidden="true" />
                    Preflight
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </CardFrame>
  );
}

function RecordDrawer({
  draft,
  messages,
  onChange,
  onClose,
  onSave,
  saving,
  zone,
}: {
  draft: RecordDraft | null;
  messages: DnsStateMessages;
  onChange: (draft: RecordDraft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  zone: DNSZoneView | null;
}) {
  const editing = Boolean(draft?.record);
  const values = draft ? splitValues(draft.valuesText) : [];
  const apexCname = draft?.type === "CNAME" && draft.name.trim() === "@";

  return (
    <ConsoleDrawer
      title={editing ? "Edit DNS record" : "Create DNS record"}
      description={zone ? zone.zoneName : undefined}
      open={Boolean(draft)}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!draft || !draft.name.trim() || !values.length}
            onClick={onSave}
          >
            <Save aria-hidden="true" />
            Save record
          </Button>
        </>
      }
    >
      {draft ? (
        <div className="coss-form">
          <div className="coss-grid-2">
            <Field data-disabled={editing || undefined}>
              <FieldLabel htmlFor="dns-record-name">Name</FieldLabel>
              <Input
                autoComplete="off"
                id="dns-record-name"
                disabled={editing}
                name="recordName"
                value={draft.name}
                onChange={(event) => onChange({ ...draft, name: event.target.value })}
              />
              <FieldDescription>
                @ for the zone apex, * for wildcard records.
              </FieldDescription>
            </Field>
            <Field data-disabled={editing || undefined}>
              <FieldLabel htmlFor="dns-record-type">Type</FieldLabel>
              <Select
                disabled={editing}
                name="recordType"
                value={draft.type}
                onValueChange={(value) =>
                  value &&
                  onChange({
                    ...draft,
                    flatten:
                      value === "ALIAS" || value === "ANAME" || value === "FUGUE_APP"
                        ? true
                        : draft.flatten,
                    flattenMode: value === "FUGUE_APP" ? "app" : draft.flattenMode,
                    type: value as FugueHostedDNSRecordType,
                  })
                }
              >
                <SelectTrigger id="dns-record-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {DNS_RECORD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <FieldDescription>
                {recordTypeHelp(draft.type, draft.name)}
              </FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="dns-record-values">Values</FieldLabel>
            <Textarea
              autoComplete="off"
              id="dns-record-values"
              name="recordValues"
              rows={4}
              value={draft.valuesText}
              onChange={(event) =>
                onChange({ ...draft, valuesText: event.target.value })
              }
            />
            <FieldDescription>
              {recordTypeHelp(draft.type, draft.name)}
            </FieldDescription>
          </Field>
          <div className="coss-grid-2">
            <Field>
              <FieldLabel htmlFor="dns-record-ttl">TTL</FieldLabel>
              <Input
                autoComplete="off"
                id="dns-record-ttl"
                inputMode="numeric"
                name="recordTtl"
                value={draft.ttl}
                onChange={(event) => onChange({ ...draft, ttl: event.target.value })}
              />
              <FieldDescription>Record TTL in seconds.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="dns-record-status">Status</FieldLabel>
              <Select
                name="recordStatus"
                value={draft.status}
                onValueChange={(value) =>
                  value &&
                  onChange({
                    ...draft,
                    status: value as RecordDraft["status"],
                  })
                }
              >
                <SelectTrigger id="dns-record-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="disabled">disabled</SelectItem>
                </SelectPopup>
              </Select>
            </Field>
          </div>
          {draft.type === "CNAME" ||
          draft.type === "ALIAS" ||
          draft.type === "ANAME" ||
          draft.type === "FUGUE_APP" ? (
            <Card className="coss-card--muted">
              <CardContent className="coss-stack-sm">
                {apexCname ? (
                  <Alert variant="info" role="status">
                    <AlertTitle>{messages.apexCnameTitle}</AlertTitle>
                    <AlertDescription>{messages.apexCnameDescription}</AlertDescription>
                  </Alert>
                ) : null}
                <Field data-disabled={apexCname || draft.type !== "CNAME" || undefined}>
                  <FieldLabel className="coss-row" htmlFor="dns-record-flatten">
                    <Checkbox
                      id="dns-record-flatten"
                      checked={draft.flatten || apexCname || draft.type !== "CNAME"}
                      disabled={apexCname || draft.type !== "CNAME"}
                      name="recordFlatten"
                      onCheckedChange={(checked) =>
                        onChange({
                          ...draft,
                          flatten: checked,
                          flattenMode: checked ? "always" : "none",
                        })
                      }
                    />
                    <span>Flatten to A/AAAA</span>
                  </FieldLabel>
                </Field>
                <div className="coss-grid-2">
                  <Field>
                    <FieldLabel htmlFor="dns-record-flatten-target">
                      Flatten target
                    </FieldLabel>
                    <Input
                      autoComplete="off"
                      id="dns-record-flatten-target"
                      name="flattenTarget"
                      value={draft.flattenTarget}
                      onChange={(event) =>
                        onChange({ ...draft, flattenTarget: event.target.value })
                      }
                    />
                    <FieldDescription>Defaults to the first value.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="dns-record-fallback">Fallback</FieldLabel>
                    <Select
                      name="flattenFallback"
                      value={draft.flattenFallbackPolicy}
                      onValueChange={(value) =>
                        value &&
                        onChange({
                          ...draft,
                          flattenFallbackPolicy:
                            value as RecordDraft["flattenFallbackPolicy"],
                        })
                      }
                    >
                      <SelectTrigger id="dns-record-fallback">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        <SelectItem value="stale_if_error">stale_if_error</SelectItem>
                        <SelectItem value="fail_closed">fail_closed</SelectItem>
                        <SelectItem value="empty_noerror">empty_noerror</SelectItem>
                      </SelectPopup>
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <Field>
            <FieldLabel className="coss-row" htmlFor="dns-record-overwrite">
              <Checkbox
                checked={draft.overwrite}
                id="dns-record-overwrite"
                name="recordOverwrite"
                onCheckedChange={(checked) =>
                  onChange({ ...draft, overwrite: checked })
                }
              />
              <span>Overwrite conflicting user record</span>
            </FieldLabel>
          </Field>
          {draft.overwrite ? (
            <Alert variant="warning" role="status">
              <AlertTitle>{messages.overwriteTitle}</AlertTitle>
              <AlertDescription>{messages.overwriteDescription}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </ConsoleDrawer>
  );
}

export function DNSConsole({
  locale,
  messages,
}: {
  locale: Locale;
  messages: DnsStateMessages;
}) {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleDNSPageSnapshot>(CONSOLE_DNS_PAGE_SNAPSHOT_URL, {
      ttlMs: 15_000,
    });
  const [zoneName, setZoneName] = useState("");
  const [selectedZoneName, setSelectedZoneName] = useState("");
  const [recordDraft, setRecordDraft] = useState<RecordDraft | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();
  const ready = data?.state === "ready" ? data : null;
  const zones = useMemo(() => ready?.data.zones ?? [], [ready]);
  const selectedZone =
    zones.find((zone) => zone.zoneName === selectedZoneName) ?? zones[0] ?? null;
  const initialLoading = loading && !data;

  useEffect(() => {
    if (!selectedZoneName && zones[0]) {
      setSelectedZoneName(zones[0].zoneName);
    }
  }, [selectedZoneName, zones]);

  async function refreshDNS() {
    invalidateConsolePageSnapshot(CONSOLE_DNS_PAGE_SNAPSHOT_URL);
    await refresh({ force: true });
  }

  async function runAction<T>(key: string, action: () => Promise<T>) {
    setBusy(key);
    setActionError(null);

    try {
      return await action();
    } catch (nextError) {
      setActionError(readRequestError(nextError));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function createZone() {
    const normalized = zoneName.trim();
    if (!normalized) {
      return;
    }

    const result = await runAction("zone:create", () =>
      requestJson("/api/fugue/dns/zones", {
        body: JSON.stringify({ zoneName: normalized }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    if (!result) {
      return;
    }

    setZoneName("");
    setSelectedZoneName(normalized);
    await refreshDNS();
    toast.notify("DNS zone created.");
  }

  async function preflightZone(zone: DNSZoneView) {
    const result = await runAction(`preflight:${zone.zoneName}`, () =>
      requestJson<{ preflight: { pass: boolean } }>(
        `/api/fugue/dns/zones/${encodeURIComponent(zone.zoneName)}/preflight`,
        {
          cache: "no-store",
        },
      ),
    );

    if (!result) {
      return;
    }

    await refreshDNS();
    toast.notify(
      result.preflight.pass ? "Preflight passed." : "Preflight still pending.",
    );
  }

  async function deleteZone(zone: DNSZoneView) {
    const result = await runAction(`zone:delete:${zone.id}`, () =>
      requestJson(`/api/fugue/dns/zones/${encodeURIComponent(zone.zoneName)}`, {
        cache: "no-store",
        method: "DELETE",
      }),
    );

    if (!result) {
      return;
    }

    setSelectedZoneName("");
    await refreshDNS();
    toast.notify("DNS zone deleted.");
  }

  async function saveRecord() {
    if (!selectedZone || !recordDraft) {
      return;
    }

    const payload = buildRecordPayload(recordDraft);
    const editing = Boolean(recordDraft.record);
    const endpoint = editing
      ? `/api/fugue/dns/zones/${encodeURIComponent(
          selectedZone.zoneName,
        )}/records/${encodeURIComponent(recordDraft.record?.id ?? "")}`
      : `/api/fugue/dns/zones/${encodeURIComponent(selectedZone.zoneName)}/records`;
    const result = await runAction("record:save", () =>
      requestJson<FugueHostedDNSRecordResult>(endpoint, {
        body: JSON.stringify(payload),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: editing ? "PATCH" : "POST",
      }),
    );

    if (!result) {
      return;
    }

    setRecordDraft(null);
    await refreshDNS();
    toast.notify(editing ? "DNS record updated." : "DNS record created.");
  }

  async function deleteRecord(record: DNSRecordView) {
    if (!selectedZone) {
      return;
    }

    const result = await runAction(`record:delete:${record.id}`, () =>
      requestJson(
        `/api/fugue/dns/zones/${encodeURIComponent(
          selectedZone.zoneName,
        )}/records/${encodeURIComponent(record.id)}`,
        {
          cache: "no-store",
          method: "DELETE",
        },
      ),
    );

    if (!result) {
      return;
    }

    await refreshDNS();
    toast.notify("DNS record deleted.");
  }

  return (
    <>
      <div className="coss-stack">
        {error ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{messages.dnsLoadFailed}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {actionError ? (
          <Alert variant="error" role="alert">
            <AlertTitle>{messages.dnsOperationFailed}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        {initialLoading ? (
          <CardFrame
            aria-busy="true"
            aria-label="Loading hosted DNS"
            aria-live="polite"
            role="status"
          >
            <ConsoleCardHeader
              title="Hosted DNS"
              description="Loading DNS zones and records."
            />
            <CardContent className="coss-stack-sm">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </CardFrame>
        ) : data?.state === "workspace-missing" ? (
          <CardFrame>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{messages.workspaceNotReady}</EmptyTitle>
                  <EmptyDescription>
                    {messages.workspaceNotReadyDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </CardFrame>
        ) : ready ? (
          <>
            {ready.data.errors.map((item) => (
              <Alert key={item} variant="warning" role="status">
                <AlertTitle>{messages.dnsWarning}</AlertTitle>
                <AlertDescription>{item}</AlertDescription>
              </Alert>
            ))}
            <MetricStrip
              items={[
                { label: "Zones", value: String(ready.data.summary.zoneCount) },
                {
                  label: "Active",
                  value: String(ready.data.summary.activeZones),
                  tone: "success",
                },
                { label: "Records", value: String(ready.data.summary.recordCount) },
                {
                  label: "Needs attention",
                  value: String(
                    ready.data.summary.pendingZones +
                      ready.data.summary.degradedRecords,
                  ),
                  tone:
                    ready.data.summary.pendingZones + ready.data.summary.degradedRecords
                      ? "warning"
                      : "success",
                },
              ]}
            />
            <CardFrame>
              <ConsoleCardHeader
                title="Add zone"
                description="Create a Fugue-hosted DNS zone, then set the registrar nameservers."
              />
              <CardContent className="coss-stack-sm">
                <div className="coss-row">
                  <Input
                    aria-label="DNS zone name"
                    autoCapitalize="none"
                    autoComplete="off"
                    className="coss-input--wide"
                    name="zoneName"
                    placeholder="example.com…"
                    spellCheck={false}
                    value={zoneName}
                    onChange={(event) => setZoneName(event.target.value)}
                  />
                  <Button
                    loading={busy === "zone:create"}
                    disabled={!zoneName.trim()}
                    onClick={createZone}
                  >
                    <Plus aria-hidden="true" />
                    Add zone
                  </Button>
                </div>
                {ready.data.expectedNameservers.length ? (
                  <span className="coss-help">
                    Use nameservers {ready.data.expectedNameservers.join(", ")}.
                  </span>
                ) : null}
              </CardContent>
            </CardFrame>
            <ZoneSelector
              busy={busy}
              onPreflight={preflightZone}
              onSelect={setSelectedZoneName}
              selectedZone={selectedZone}
              zones={zones}
            />
            {selectedZone ? (
              <CardFrame>
                <ConsoleCardHeader
                  title={`${selectedZone.zoneName} records`}
                  description="Standard DNS records and Fugue-managed flattening records."
                  action={
                    <div className="coss-row">
                      <Button
                        variant="outline"
                        loading={busy === `preflight:${selectedZone.zoneName}`}
                        onClick={() => preflightZone(selectedZone)}
                      >
                        <RefreshCw aria-hidden="true" />
                        Preflight
                      </Button>
                      <Button onClick={() => setRecordDraft(EMPTY_RECORD_DRAFT)}>
                        <Plus aria-hidden="true" />
                        Add record
                      </Button>
                    </div>
                  }
                />
                <CardContent className="coss-stack">
                  {selectedZone.status !== "active" ? (
                    <Alert variant="warning" role="status">
                      <AlertTitle>{messages.parentDelegationTitle}</AlertTitle>
                      <AlertDescription>
                        {messages.parentDelegationDescription}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {selectedZone.records.length ? (
                    <DataTable
                      columns={[
                        "Name",
                        "Type",
                        "Values",
                        "Flatten",
                        "Source",
                        "Status",
                        "Updated",
                        "",
                      ]}
                      rows={selectedZone.records}
                      renderRow={(record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="coss-stack-sm">
                              <strong className="coss-mono">{record.name}</strong>
                              <span className="coss-help">{record.fqdn}</span>
                            </div>
                          </TableCell>
                          <TableCell>{record.type}</TableCell>
                          <TableCell>
                            <div className="coss-stack-sm">
                              <span>{record.answerLabel}</span>
                              {record.flattenedA.length ||
                              record.flattenedAAAA.length ? (
                                <span className="coss-help">
                                  A {record.flattenedA.join(", ") || "-"} · AAAA{" "}
                                  {record.flattenedAAAA.join(", ") || "-"}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="coss-stack-sm">
                              <span>{record.flattenLabel}</span>
                              <span className="coss-help">
                                resolved{" "}
                                {formatDate(
                                  locale,
                                  record.lastResolvedAt,
                                  messages.notYet,
                                )}
                              </span>
                              {record.resolveError ? (
                                <span className="coss-help">{record.resolveError}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{record.source}</TableCell>
                          <TableCell>
                            <Badge
                              variant={badgeToneFromConsoleTone(record.statusTone)}
                            >
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDate(locale, record.updatedAt, messages.notYet)}
                          </TableCell>
                          <TableCell className="coss-table__actions">
                            <div className="coss-row coss-row--end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRecordDraft(readRecordDraft(record))}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                loading={busy === `record:delete:${record.id}`}
                                onClick={() =>
                                  setConfirm({
                                    action: () => deleteRecord(record),
                                    description: `${record.fqdn} ${record.type} will be removed from this zone.`,
                                    label: "Delete record",
                                    title: "Delete DNS record?",
                                  })
                                }
                              >
                                <Trash2 aria-hidden="true" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>{messages.noRecords}</EmptyTitle>
                        <EmptyDescription>
                          {messages.noRecordsDescription}
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        {
                          <Button onClick={() => setRecordDraft(EMPTY_RECORD_DRAFT)}>
                            <Plus aria-hidden="true" />
                            Add record
                          </Button>
                        }
                      </EmptyContent>
                    </Empty>
                  )}
                  <div className="coss-row coss-row--end">
                    <Button
                      variant="destructive"
                      loading={busy === `zone:delete:${selectedZone.id}`}
                      onClick={() =>
                        setConfirm({
                          action: () => deleteZone(selectedZone),
                          description: `${selectedZone.zoneName} and its DNS records will be deleted from Fugue.`,
                          label: "Delete zone",
                          title: "Delete DNS zone?",
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" />
                      Delete zone
                    </Button>
                  </div>
                </CardContent>
              </CardFrame>
            ) : (
              <CardFrame>
                <CardContent>
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{messages.noZones}</EmptyTitle>
                      <EmptyDescription>{messages.noZonesDescription}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </CardContent>
              </CardFrame>
            )}
          </>
        ) : null}
      </div>
      <RecordDrawer
        draft={recordDraft}
        messages={messages}
        onChange={setRecordDraft}
        onClose={() => setRecordDraft(null)}
        onSave={saveRecord}
        saving={busy === "record:save"}
        zone={selectedZone}
      />
      <ConfirmationDialog
        confirmLabel={confirm?.label}
        confirmLoading={Boolean(
          busy?.startsWith("record:delete") || busy?.startsWith("zone:delete"),
        )}
        description={confirm?.description ?? ""}
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm?.action;
          if (!action) {
            return;
          }

          await action();
          setConfirm(null);
        }}
      />
    </>
  );
}
