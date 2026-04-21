"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import {
  Panel,
  PanelCopy,
  PanelSection,
  PanelTitle,
} from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import type { AdminPlatformNodeEnrollmentResult } from "@/lib/admin/service";
import { copyText } from "@/lib/ui/clipboard";

function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  return fetch(input, init).then(async (response) => {
    const data = (await response.json().catch(() => null)) as
      | (T & { error?: string })
      | null;

    if (!data) {
      throw new Error("Empty response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  });
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

function shortId(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function AdminPlatformNodeEnrollmentPanel() {
  const { formatRelativeTime, t } = useI18n();
  const { showToast } = useToast();
  const labelFieldId = useId();
  const [label, setLabel] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [issued, setIssued] =
    useState<AdminPlatformNodeEnrollmentResult | null>(null);

  async function handleIssue() {
    if (issuing) {
      return;
    }

    setIssuing(true);

    try {
      const result = await requestJson<AdminPlatformNodeEnrollmentResult>(
        "/api/admin/cluster/node-keys",
        {
          body: JSON.stringify(label.trim() ? { label } : {}),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      setIssued(result);
      showToast({
        message: t("Platform node key issued."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIssuing(false);
    }
  }

  async function handleCopyCommand() {
    if (!issued || copying) {
      return;
    }

    setCopying(true);

    try {
      const copied = await copyText(issued.joinCommand);

      showToast({
        message: copied
          ? t("Join command copied.")
          : t("Copy the join command manually."),
        variant: copied ? "success" : "info",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setCopying(false);
    }
  }

  return (
    <Panel className="fg-admin-platform-enroll">
      <PanelSection className="fg-admin-platform-enroll__head">
        <div className="fg-admin-platform-enroll__copy">
          <p className="fg-label fg-panel__eyebrow">
            {t("Platform node join")}
          </p>
          <PanelTitle>{t("Issue a platform-scoped join key")}</PanelTitle>
          <PanelCopy>
            {t(
              "Attach an admin-managed VPS as a platform node first, then use node policy below to allow builds, place workloads, or mark it as a control-plane candidate.",
            )}
          </PanelCopy>
        </div>

        <div className="fg-admin-platform-enroll__actions">
          <Button
            loading={issuing}
            loadingLabel={t("Issuing key…")}
            onClick={() => {
              void handleIssue();
            }}
            size="compact"
            variant="primary"
          >
            {t("Issue platform key")}
          </Button>
        </div>
      </PanelSection>

      <PanelSection className="fg-admin-platform-enroll__grid">
        <div className="fg-admin-platform-enroll__surface">
          <FormField
            hint={t("Leave blank to let Fugue generate the node key label.")}
            htmlFor={labelFieldId}
            label={t("Key label")}
            optionalLabel={t("Optional")}
          >
            <input
              className="fg-input"
              id={labelFieldId}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
              placeholder={t("edge-singapore-01")}
              value={label}
            />
          </FormField>

          <p className="fg-admin-platform-enroll__note">
            {t(
              "This flow creates a platform-node key, not a tenant runtime key. The joined VPS stays platform-owned and can be promoted or constrained later.",
            )}
          </p>
        </div>

        <div className="fg-admin-platform-enroll__surface">
          {issued ? (
            <div className="fg-admin-platform-enroll__result">
              <dl className="fg-cluster-node-facts fg-admin-platform-enroll__facts">
                <div>
                  <dt>{t("Node key")}</dt>
                  <dd title={issued.nodeKey.id}>
                    {issued.nodeKey.label} / {shortId(issued.nodeKey.id)}
                  </dd>
                </div>
                <div>
                  <dt>{t("Scope")}</dt>
                  <dd>
                    {t(
                      issued.nodeKey.scope === "platform-node"
                        ? "Platform node"
                        : "Unknown",
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t("Status")}</dt>
                  <dd>
                    {t(
                      issued.nodeKey.status?.trim().toLowerCase() === "revoked"
                        ? "Revoked"
                        : "Active",
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t("Created")}</dt>
                  <dd>
                    {issued.nodeKey.createdAt
                      ? formatRelativeTime(issued.nodeKey.createdAt)
                      : t("Just now")}
                  </dd>
                </div>
              </dl>

              <div className="fg-admin-platform-enroll__command-shell">
                <span>{t("Run this on the target VPS")}</span>
                <pre className="fg-admin-platform-enroll__command">
                  <code>{issued.joinCommand}</code>
                </pre>
              </div>

              <div className="fg-admin-platform-enroll__result-actions">
                <Button
                  loading={copying}
                  loadingLabel={t("Copying…")}
                  onClick={() => {
                    void handleCopyCommand();
                  }}
                  size="compact"
                  variant="secondary"
                >
                  {t("Copy join command")}
                </Button>
                <Button
                  onClick={() => {
                    setIssued(null);
                  }}
                  size="compact"
                  variant="ghost"
                >
                  {t("Clear")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="fg-admin-platform-enroll__placeholder">
              <strong>{t("No platform key issued yet")}</strong>
              <p>
                {t(
                  "When you issue a key, Fugue returns a one-time join command here so the next VPS can attach as a platform node immediately.",
                )}
              </p>
            </div>
          )}
        </div>
      </PanelSection>
    </Panel>
  );
}
