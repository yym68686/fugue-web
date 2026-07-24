"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { callAdmin } from "@/components/admin/client";
import { useT } from "@/lib/i18n/client";

const MICRO_CENTS_PER_DOLLAR = 100_000_000;

type UserStatus = "active" | "blocked" | "deleted";

type UserRowActionsProps = {
  email: string;
  name: string;
  status: UserStatus;
  isAdmin: boolean;
  /** Tenant this user's workspace maps to, or null when they have no workspace. */
  tenantId: string | null;
  /** Current balance in microcents, or null when billing could not be loaded. */
  balanceMicrocents: number | null;
  /** Current managed cap; null components mean "unknown / not managed". */
  capCpuMillicores: number | null;
  capMemoryMebibytes: number | null;
  capStorageGibibytes: number | null;
};

/**
 * Per-row admin controls for a user: Ban/Unban (local status flip), Adjust
 * limits (managed resource cap), and Adjust balance (set prepaid balance).
 * Rendered as a client island inside the server-rendered /admin/users row.
 * Each mutation hits /api/admin/… then router.refresh() re-renders the row.
 * Billing actions only appear when the user has a workspace (tenantId).
 */
export default function UserRowActions({
  email,
  name,
  status,
  isAdmin,
  tenantId,
  balanceMicrocents,
  capCpuMillicores,
  capMemoryMebibytes,
  capStorageGibibytes,
}: UserRowActionsProps) {
  const t = useT();
  const router = useRouter();

  const [modal, setModal] = useState<"limits" | "balance" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cap-edit form state (in human units: cores / GiB).
  const hasStorageCap = capStorageGibibytes !== null;
  const [cpuCores, setCpuCores] = useState((capCpuMillicores ?? 0) / 1000);
  const [memoryGiB, setMemoryGiB] = useState((capMemoryMebibytes ?? 0) / 1024);
  const [storageGiB, setStorageGiB] = useState(capStorageGibibytes ?? 0);

  // Balance-edit form state (in dollars).
  const [dollars, setDollars] = useState(
    balanceMicrocents !== null ? balanceMicrocents / MICRO_CENTS_PER_DOLLAR : 0,
  );
  const [note, setNote] = useState("");

  const label = name || email;

  function closeAll() {
    if (busy) return;
    setModal(null);
    setConfirming(false);
    setError(null);
  }

  function openLimits() {
    setCpuCores((capCpuMillicores ?? 0) / 1000);
    setMemoryGiB((capMemoryMebibytes ?? 0) / 1024);
    setStorageGiB(capStorageGibibytes ?? 0);
    setError(null);
    setModal("limits");
  }

  function openBalance() {
    setDollars(
      balanceMicrocents !== null ? balanceMicrocents / MICRO_CENTS_PER_DOLLAR : 0,
    );
    setNote("");
    setError(null);
    setModal("balance");
  }

  async function runStatus(next: "active" | "blocked") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await callAdmin("/users/status", { body: { email, status: next } });
      setConfirming(false);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Action failed.");
      if (confirming) setError(msg);
      else window.alert(msg);
    } finally {
      setBusy(false);
    }
  }

  async function submitLimits() {
    if (busy || !tenantId) return;
    setBusy(true);
    setError(null);
    try {
      await callAdmin("/billing/cap", {
        body: {
          tenantId,
          cpuMillicores: Math.round(cpuCores * 1000),
          memoryMebibytes: Math.round(memoryGiB * 1024),
          ...(hasStorageCap ? { storageGibibytes: Math.round(storageGiB) } : {}),
        },
      });
      setModal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function submitBalance() {
    if (busy || !tenantId) return;
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError(t("Enter a valid amount."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callAdmin("/billing/balance", {
        body: {
          tenantId,
          balanceCents: Math.round(dollars * 100),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      setModal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action failed."));
    } finally {
      setBusy(false);
    }
  }

  // Deleted users have no actionable controls.
  if (status === "deleted") {
    return <span className="faint">—</span>;
  }

  return (
    <>
      <div className="row-acts">
        {tenantId && (
          <>
            <button
              type="button"
              className="btn sm ghost"
              onClick={openLimits}
              disabled={busy}
            >
              {t("Limits")}
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={openBalance}
              disabled={busy}
            >
              {t("Balance")}
            </button>
          </>
        )}
        {/* Admins cannot be banned (backend rejects it); hide the control. */}
        {!isAdmin &&
          (status === "blocked" ? (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => runStatus("active")}
              disabled={busy}
            >
              {t("Unban")}
            </button>
          ) : (
            <button
              type="button"
              className="btn sm ghost danger"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={busy}
            >
              {t("Ban")}
            </button>
          ))}
      </div>

      {modal === "limits" && (
        <div className="modal-scrim" onClick={closeAll}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{t("Adjust resource limits")}</h3>
            </div>
            <div className="modal-b">
              <p className="faint" style={{ marginTop: 0, marginBottom: 14 }}>
                {t("Managed cap for {label}.", { label })}
              </p>
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor={`lim-cpu-${email}`}>{t("CPU (cores)")}</label>
                <input
                  id={`lim-cpu-${email}`}
                  className="input mono"
                  type="number"
                  min={0}
                  step={0.1}
                  autoFocus
                  value={cpuCores}
                  disabled={busy}
                  onChange={(e) => setCpuCores(Number(e.target.value))}
                />
              </div>
              <div className="field" style={{ marginBottom: hasStorageCap ? 12 : 0 }}>
                <label htmlFor={`lim-mem-${email}`}>{t("Memory (GiB)")}</label>
                <input
                  id={`lim-mem-${email}`}
                  className="input mono"
                  type="number"
                  min={0}
                  step={0.5}
                  value={memoryGiB}
                  disabled={busy}
                  onChange={(e) => setMemoryGiB(Number(e.target.value))}
                />
              </div>
              {hasStorageCap && (
                <div className="field">
                  <label htmlFor={`lim-sto-${email}`}>{t("Storage (GiB)")}</label>
                  <input
                    id={`lim-sto-${email}`}
                    className="input mono"
                    type="number"
                    min={0}
                    step={1}
                    value={storageGiB}
                    disabled={busy}
                    onChange={(e) => setStorageGiB(Number(e.target.value))}
                  />
                </div>
              )}
              {error && (
                <div className="wb-alert err" style={{ marginTop: 12, marginBottom: 0 }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-f">
              <button
                type="button"
                className="btn ghost"
                onClick={closeAll}
                disabled={busy}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={submitLimits}
                disabled={busy}
              >
                {busy ? t("Working…") : t("Save changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "balance" && (
        <div className="modal-scrim" onClick={closeAll}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{t("Adjust balance")}</h3>
            </div>
            <div className="modal-b">
              <p className="faint" style={{ marginTop: 0, marginBottom: 14 }}>
                {t(
                  "Set the prepaid balance for {label}. This overwrites the current balance.",
                  { label },
                )}
              </p>
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor={`bal-amt-${email}`}>{t("Balance (USD)")}</label>
                <input
                  id={`bal-amt-${email}`}
                  className="input mono"
                  type="number"
                  min={0}
                  step={0.01}
                  autoFocus
                  value={dollars}
                  disabled={busy}
                  onChange={(e) => setDollars(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor={`bal-note-${email}`}>{t("Note (optional)")}</label>
                <input
                  id={`bal-note-${email}`}
                  className="input"
                  type="text"
                  maxLength={200}
                  value={note}
                  disabled={busy}
                  placeholder={t("Reason for the adjustment")}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              {error && (
                <div className="wb-alert err" style={{ marginTop: 12, marginBottom: 0 }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-f">
              <button
                type="button"
                className="btn ghost"
                onClick={closeAll}
                disabled={busy}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={submitBalance}
                disabled={busy}
              >
                {busy ? t("Working…") : t("Set balance")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-scrim" onClick={closeAll}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>{t("Ban user")}</h3>
            </div>
            <div className="modal-b">
              <p style={{ margin: 0 }}>
                {t(
                  "Ban “{label}”? They will be signed out immediately and cannot sign in until unbanned.",
                  { label },
                )}
              </p>
              {error && (
                <div className="wb-alert err" style={{ marginTop: 12, marginBottom: 0 }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-f">
              <button
                type="button"
                className="btn ghost"
                onClick={closeAll}
                disabled={busy}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => runStatus("blocked")}
                disabled={busy}
              >
                {busy ? t("Working…") : t("Ban")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
