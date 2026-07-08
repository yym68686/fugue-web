import "server-only";

import { getApiKeyPageDataForWorkspace } from "@/lib/api-keys/service";
import type { ConsoleTone } from "@/lib/console/types";
import {
  getFugueHostedDNSRecords,
  getFugueHostedDNSZones,
  type FugueHostedDNSRecord,
  type FugueHostedDNSZone,
} from "@/lib/fugue/api";
import type { WorkspaceAccess } from "@/lib/workspace/store";

export type DNSRecordView = FugueHostedDNSRecord & {
  answerLabel: string;
  flattenLabel: string;
  statusTone: ConsoleTone;
};

export type DNSZoneView = FugueHostedDNSZone & {
  delegationLabel: string;
  recordCount: number;
  records: DNSRecordView[];
  statusTone: ConsoleTone;
};

export type DNSPageData = {
  errors: string[];
  expectedNameservers: string[];
  summary: {
    activeZones: number;
    degradedRecords: number;
    pendingZones: number;
    recordCount: number;
    zoneCount: number;
  };
  zones: DNSZoneView[];
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown Fugue DNS request error.";
}

function readZoneTone(status: string): ConsoleTone {
  if (status === "active") {
    return "positive";
  }

  if (status === "pending_delegation" || status === "degraded") {
    return "warning";
  }

  return "danger";
}

function readRecordTone(status: string, flattenStatus: string | null): ConsoleTone {
  if (status === "active" && (!flattenStatus || flattenStatus === "resolved")) {
    return "positive";
  }

  if (
    status === "degraded" ||
    status === "conflict" ||
    flattenStatus === "stale" ||
    flattenStatus === "degraded" ||
    flattenStatus === "pending"
  ) {
    return "warning";
  }

  if (status === "disabled" || flattenStatus === "error") {
    return "danger";
  }

  return "neutral";
}

function readAnswerLabel(record: FugueHostedDNSRecord) {
  const flattened = [...record.flattenedA, ...record.flattenedAAAA];

  if (flattened.length) {
    return flattened.join(", ");
  }

  if (record.values.length) {
    return record.values.join(", ");
  }

  return "No published values";
}

function readFlattenLabel(record: FugueHostedDNSRecord) {
  if (
    record.type !== "ALIAS" &&
    record.type !== "ANAME" &&
    record.type !== "FUGUE_APP" &&
    record.flattenMode !== "always" &&
    record.flattenMode !== "apex" &&
    record.flattenMode !== "app"
  ) {
    return "Standard";
  }

  const target = record.flattenTarget ?? record.values[0] ?? "target";
  const status = record.flattenStatus ?? "pending";
  return `${status}: ${target}`;
}

function buildRecordView(record: FugueHostedDNSRecord): DNSRecordView {
  return {
    ...record,
    answerLabel: readAnswerLabel(record),
    flattenLabel: readFlattenLabel(record),
    statusTone: readRecordTone(record.status, record.flattenStatus),
  };
}

function buildZoneView(
  zone: FugueHostedDNSZone,
  records: FugueHostedDNSRecord[],
): DNSZoneView {
  const recordViews = records
    .map(buildRecordView)
    .sort((left, right) => {
      const nameOrder = left.fqdn.localeCompare(right.fqdn);
      if (nameOrder !== 0) {
        return nameOrder;
      }

      return left.type.localeCompare(right.type);
    });

  return {
    ...zone,
    delegationLabel:
      zone.delegationStatus === "ready"
        ? "Delegated"
        : zone.parentNameservers.length
          ? `Observed ${zone.parentNameservers.join(", ")}`
          : "Waiting for parent NS",
    recordCount: recordViews.length,
    records: recordViews,
    statusTone: readZoneTone(zone.status),
  };
}

export async function getDNSPageDataForWorkspace(
  email: string,
  workspace: WorkspaceAccess,
): Promise<DNSPageData> {
  const errors: string[] = [];

  try {
    await getApiKeyPageDataForWorkspace(email, workspace);
  } catch (error) {
    errors.push(`Workspace admin key scope repair failed: ${readErrorMessage(error)}`);
  }

  let zones: FugueHostedDNSZone[] = [];

  try {
    zones = (await getFugueHostedDNSZones(workspace.adminKeySecret)).zones;
  } catch (error) {
    errors.push(readErrorMessage(error));
  }

  const zoneViews = await Promise.all(
    zones.map(async (zone) => {
      try {
        const records = await getFugueHostedDNSRecords(
          workspace.adminKeySecret,
          zone.zoneName,
        );
        return buildZoneView(zone, records.records);
      } catch (error) {
        errors.push(`${zone.zoneName}: ${readErrorMessage(error)}`);
        return buildZoneView(zone, []);
      }
    }),
  );

  const expectedNameservers = [
    ...new Set(zoneViews.flatMap((zone) => zone.expectedNameservers)),
  ];
  const recordCount = zoneViews.reduce((total, zone) => total + zone.recordCount, 0);
  const degradedRecords = zoneViews.reduce(
    (total, zone) =>
      total +
      zone.records.filter(
        (record) =>
          record.status !== "active" ||
          record.flattenStatus === "stale" ||
          record.flattenStatus === "degraded" ||
          record.flattenStatus === "error",
      ).length,
    0,
  );

  return {
    errors,
    expectedNameservers,
    summary: {
      activeZones: zoneViews.filter((zone) => zone.status === "active").length,
      degradedRecords,
      pendingZones: zoneViews.filter((zone) => zone.status !== "active").length,
      recordCount,
      zoneCount: zoneViews.length,
    },
    zones: zoneViews.sort((left, right) => left.zoneName.localeCompare(right.zoneName)),
  };
}
