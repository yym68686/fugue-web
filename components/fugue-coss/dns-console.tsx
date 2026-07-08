"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFrame,
  CardHeader,
  ConfirmDialog,
  DataTable,
  Drawer,
  Empty,
  Field,
  Inline,
  Input,
  MetricStrip,
  NativeSelect,
  Stack,
  TableCell,
  TableRow,
  Textarea,
  Toast,
} from "@/components/coss/ui";
import {
  CONSOLE_DNS_PAGE_SNAPSHOT_URL,
  invalidateConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleDNSPageSnapshot } from "@/lib/console/page-snapshot-types";
import type { DNSRecordView, DNSZoneView } from "@/lib/dns/service";
import {
  type FugueHostedDNSRecordResult,
  type FugueHostedDNSRecordType,
} from "@/lib/fugue/api";
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
  const [message, setMessage] = useState<string | null>(null);
  return {
    message,
    notify(value: string) {
      setMessage(value);
      window.setTimeout(() => setMessage(null), 1800);
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

function formatDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
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
    ...(flattenTarget && (draft.flatten || draft.type === "ALIAS" || draft.type === "ANAME")
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
      <CardHeader
        title="Zones"
        description="Delegation status and Fugue nameservers for hosted DNS zones."
      />
      <CardContent>
        <div className="coss-grid-3">
          {zones.map((zone) => (
            <Card key={zone.id} muted={selectedZone?.id !== zone.id}>
              <CardContent className="coss-stack-sm">
                <Inline justify="between">
                  <strong className="coss-mono">{zone.zoneName}</strong>
                  <Badge tone={badgeToneFromConsoleTone(zone.statusTone)}>
                    {zone.status}
                  </Badge>
                </Inline>
                <span className="coss-help">{zone.delegationLabel}</span>
                <span className="coss-help">
                  NS {zone.expectedNameservers.join(", ") || "not configured"}
                </span>
                <Inline>
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
                </Inline>
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
  onChange,
  onClose,
  onSave,
  saving,
  zone,
}: {
  draft: RecordDraft | null;
  onChange: (draft: RecordDraft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  zone: DNSZoneView | null;
}) {
  const editing = Boolean(draft?.record);
  const values = draft ? splitValues(draft.valuesText) : [];
  const apexCname =
    draft?.type === "CNAME" && draft.name.trim() === "@";

  return (
    <Drawer
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
            <Field label="Name" help="@ for the zone apex, * for wildcard records.">
              <Input
                disabled={editing}
                value={draft.name}
                onChange={(event) => onChange({ ...draft, name: event.target.value })}
              />
            </Field>
            <Field label="Type" help={recordTypeHelp(draft.type, draft.name)}>
              <NativeSelect
                disabled={editing}
                value={draft.type}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    flatten:
                      event.target.value === "ALIAS" ||
                      event.target.value === "ANAME" ||
                      event.target.value === "FUGUE_APP"
                        ? true
                        : draft.flatten,
                    flattenMode:
                      event.target.value === "FUGUE_APP" ? "app" : draft.flattenMode,
                    type: event.target.value as FugueHostedDNSRecordType,
                  })
                }
              >
                {DNS_RECORD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Values" help={recordTypeHelp(draft.type, draft.name)}>
            <Textarea
              rows={4}
              value={draft.valuesText}
              onChange={(event) =>
                onChange({ ...draft, valuesText: event.target.value })
              }
            />
          </Field>
          <div className="coss-grid-2">
            <Field label="TTL" help="Record TTL in seconds.">
              <Input
                inputMode="numeric"
                value={draft.ttl}
                onChange={(event) => onChange({ ...draft, ttl: event.target.value })}
              />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={draft.status}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    status: event.target.value as RecordDraft["status"],
                  })
                }
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </NativeSelect>
            </Field>
          </div>
          {draft.type === "CNAME" ||
          draft.type === "ALIAS" ||
          draft.type === "ANAME" ||
          draft.type === "FUGUE_APP" ? (
            <Card muted>
              <CardContent className="coss-stack-sm">
                {apexCname ? (
                  <Alert tone="info" title="Apex CNAME uses flattening.">
                    Fugue will publish A/AAAA answers at the apex instead of an
                    invalid apex CNAME RR.
                  </Alert>
                ) : null}
                <label className="coss-row">
                  <input
                    checked={draft.flatten || apexCname || draft.type !== "CNAME"}
                    disabled={apexCname || draft.type !== "CNAME"}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        flatten: event.target.checked,
                        flattenMode: event.target.checked ? "always" : "none",
                      })
                    }
                  />
                  <span>Flatten to A/AAAA</span>
                </label>
                <div className="coss-grid-2">
                  <Field label="Flatten target" help="Defaults to the first value.">
                    <Input
                      value={draft.flattenTarget}
                      onChange={(event) =>
                        onChange({ ...draft, flattenTarget: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Fallback">
                    <NativeSelect
                      value={draft.flattenFallbackPolicy}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          flattenFallbackPolicy: event.target
                            .value as RecordDraft["flattenFallbackPolicy"],
                        })
                      }
                    >
                      <option value="stale_if_error">stale_if_error</option>
                      <option value="fail_closed">fail_closed</option>
                      <option value="empty_noerror">empty_noerror</option>
                    </NativeSelect>
                  </Field>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <label className="coss-row">
            <input
              checked={draft.overwrite}
              type="checkbox"
              onChange={(event) =>
                onChange({ ...draft, overwrite: event.target.checked })
              }
            />
            <span>Overwrite conflicting user record</span>
          </label>
          {draft.overwrite ? (
            <Alert tone="warning" title="Overwrite is explicit for this save.">
              Fugue will still preserve system protected records and backend
              ownership checks.
            </Alert>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function DNSConsole() {
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
    toast.notify(result.preflight.pass ? "Preflight passed." : "Preflight still pending.");
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
      <Toast message={toast.message} />
      <div className="coss-stack">
        {error ? (
          <Alert tone="destructive" title="Fugue could not load hosted DNS right now.">
            {error}
          </Alert>
        ) : null}
        {actionError ? (
          <Alert tone="destructive" title="The DNS operation failed.">
            {actionError}
          </Alert>
        ) : null}
        {initialLoading ? (
          <CardFrame>
            <CardHeader title="Hosted DNS" description="Loading DNS zones and records." />
            <CardContent className="coss-stack-sm">
              <div className="coss-skeleton" />
              <div className="coss-skeleton" />
              <div className="coss-skeleton" />
            </CardContent>
          </CardFrame>
        ) : data?.state === "workspace-missing" ? (
          <CardFrame>
            <CardContent>
              <Empty
                title="Workspace is not ready"
                description="Create or open a Fugue workspace before managing hosted DNS."
              />
            </CardContent>
          </CardFrame>
        ) : ready ? (
          <>
            {ready.data.errors.map((item) => (
              <Alert key={item} tone="warning" title="Hosted DNS loaded with a warning.">
                {item}
              </Alert>
            ))}
            <MetricStrip
              items={[
                { label: "Zones", value: String(ready.data.summary.zoneCount) },
                { label: "Active", value: String(ready.data.summary.activeZones), tone: "success" },
                { label: "Records", value: String(ready.data.summary.recordCount) },
                {
                  label: "Needs attention",
                  value: String(
                    ready.data.summary.pendingZones + ready.data.summary.degradedRecords,
                  ),
                  tone:
                    ready.data.summary.pendingZones + ready.data.summary.degradedRecords
                      ? "warning"
                      : "success",
                },
              ]}
            />
            <CardFrame>
              <CardHeader
                title="Add zone"
                description="Create a Fugue-hosted DNS zone, then set the registrar nameservers."
              />
              <CardContent className="coss-stack-sm">
                <Inline>
                  <Input
                    className="coss-input--wide"
                    placeholder="example.com"
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
                </Inline>
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
                <CardHeader
                  title={`${selectedZone.zoneName} records`}
                  description="Standard DNS records and Fugue-managed flattening records."
                  action={
                    <Inline>
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
                    </Inline>
                  }
                />
                <CardContent className="coss-stack">
                  {selectedZone.status !== "active" ? (
                    <Alert tone="warning" title="Parent delegation is not fully active.">
                      If the registrar has DNSSEC DS records enabled, remove them until
                      Fugue DNSSEC is configured.
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
                            <Stack size="sm">
                              <strong className="coss-mono">{record.name}</strong>
                              <span className="coss-help">{record.fqdn}</span>
                            </Stack>
                          </TableCell>
                          <TableCell>{record.type}</TableCell>
                          <TableCell>
                            <Stack size="sm">
                              <span>{record.answerLabel}</span>
                              {record.flattenedA.length || record.flattenedAAAA.length ? (
                                <span className="coss-help">
                                  A {record.flattenedA.join(", ") || "-"} · AAAA{" "}
                                  {record.flattenedAAAA.join(", ") || "-"}
                                </span>
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack size="sm">
                              <span>{record.flattenLabel}</span>
                              <span className="coss-help">
                                resolved {formatDate(record.lastResolvedAt)}
                              </span>
                              {record.resolveError ? (
                                <span className="coss-help">{record.resolveError}</span>
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>{record.source}</TableCell>
                          <TableCell>
                            <Badge tone={badgeToneFromConsoleTone(record.statusTone)}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(record.updatedAt)}</TableCell>
                          <TableCell className="coss-table__actions">
                            <Inline justify="end">
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
                            </Inline>
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  ) : (
                    <Empty
                      title="No DNS records"
                      description="Add a record after the zone is delegated to Fugue nameservers."
                      action={
                        <Button onClick={() => setRecordDraft(EMPTY_RECORD_DRAFT)}>
                          <Plus aria-hidden="true" />
                          Add record
                        </Button>
                      }
                    />
                  )}
                  <Inline justify="end">
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
                  </Inline>
                </CardContent>
              </CardFrame>
            ) : (
              <CardFrame>
                <CardContent>
                  <Empty
                    title="No hosted zones"
                    description="Add a zone to start serving DNS from Fugue nameservers."
                  />
                </CardContent>
              </CardFrame>
            )}
          </>
        ) : null}
      </div>
      <RecordDrawer
        draft={recordDraft}
        onChange={setRecordDraft}
        onClose={() => setRecordDraft(null)}
        onSave={saveRecord}
        saving={busy === "record:save"}
        zone={selectedZone}
      />
      <ConfirmDialog
        confirmLabel={confirm?.label}
        confirmLoading={Boolean(busy?.startsWith("record:delete") || busy?.startsWith("zone:delete"))}
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
