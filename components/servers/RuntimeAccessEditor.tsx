"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import {
  callConsole,
  ConfirmDialog,
  useEndpointData,
} from "@/components/workbench/shared";
import {
  isInternalRuntime,
  publicOfferFree,
  validatePublicOffer,
  type PublicOffer,
  type RuntimeView,
  type ServerView,
} from "@/lib/servers/model";

type AccessData = {
  runtime: RuntimeView;
  grants: { tenantId: string; label: string; createdAt: string }[];
};
type Action =
  | { action: "sharing"; sharing: "private" | "public" }
  | { action: "scope"; scope: "internal" | "byovps" }
  | { action: "delete" }
  | { action: "revoke"; tenantId: string; label: string };

export function PublicPrice({ offer }: { offer?: PublicOffer }) {
  const t = useT();
  if (!offer || !offer.updated_at || offer.updated_at.startsWith("0001"))
    return <span>{t("Public pricing has not been configured.")}</span>;
  if (publicOfferFree(offer)) return <span>{t("Free")}</span>;
  return (
    <span>
      {t("Reference price: ${price}/month", {
        price: (
          (offer.reference_monthly_price_microcents ?? 0) / 100_000_000
        ).toFixed(2),
      })}{" "}
      ·{" "}
      {offer.reference_bundle.cpu_millicores == null
        ? "—"
        : offer.reference_bundle.cpu_millicores / 1000}{" "}
      {t("CPU cores")} · {offer.reference_bundle.memory_mebibytes ?? "—"} MiB ·{" "}
      {offer.reference_bundle.storage_gibibytes ?? "—"} GiB
      {offer.free_cpu ? ` · ${t("CPU free")}` : ""}
      {offer.free_memory ? ` · ${t("Memory free")}` : ""}
      {offer.free_storage ? ` · ${t("Disk free")}` : ""}
    </span>
  );
}

function PricingForm({
  runtime,
  onSaved,
}: {
  runtime: RuntimeView;
  onSaved: () => void;
}) {
  const t = useT();
  const id = useId();
  const offer = runtime.public_offer;
  const [cpu, setCpu] = useState(
    String((offer?.reference_bundle.cpu_millicores ?? 1000) / 1000),
  );
  const [memory, setMemory] = useState(
    String(offer?.reference_bundle.memory_mebibytes ?? 1024),
  );
  const [disk, setDisk] = useState(
    String(offer?.reference_bundle.storage_gibibytes ?? 10),
  );
  const [price, setPrice] = useState(
    String((offer?.reference_monthly_price_microcents ?? 0) / 100_000_000),
  );
  const [free, setFree] = useState(Boolean(offer?.free));
  const [freeCpu, setFreeCpu] = useState(Boolean(offer?.free_cpu));
  const [freeMemory, setFreeMemory] = useState(Boolean(offer?.free_memory));
  const [freeDisk, setFreeDisk] = useState(Boolean(offer?.free_storage));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="server-pricing"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const input = validatePublicOffer({
            reference_bundle: {
              cpu_millicores: Math.round(Number(cpu) * 1000),
              memory_mebibytes: Number(memory),
              storage_gibibytes: Number(disk),
            },
            reference_monthly_price_microcents: Math.round(
              Number(price) * 100_000_000,
            ),
            free,
            free_cpu: freeCpu,
            free_memory: freeMemory,
            free_storage: freeDisk,
          });
          await callConsole(`/runtimes/${encodeURIComponent(runtime.id)}`, {
            body: { action: "offer", offer: input },
          });
          setMessage(t("Public pricing saved."));
          onSaved();
        } catch (err) {
          setError(t(err instanceof Error ? err.message : "Action failed."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h4>{t("Public pricing")}</h4>
      <p className="form-hint">
        {t(
          "The reference bundle defines resource prices. Other users see these prices before choosing this server.",
        )}
      </p>
      <label className="server-check">
        <input
          type="checkbox"
          checked={free}
          onChange={(e) => setFree(e.target.checked)}
          disabled={busy}
        />
        {t("All resources free")}
      </label>
      <div className="server-form-grid">
        <label htmlFor={`${id}-cpu`}>
          {t("CPU cores")}
          <input
            id={`${id}-cpu`}
            className="input"
            type="number"
            min="0"
            step="0.001"
            required
            value={cpu}
            disabled={busy || free}
            onChange={(e) => setCpu(e.target.value)}
          />
        </label>
        <label htmlFor={`${id}-memory`}>
          {t("Memory (MiB)")}
          <input
            id={`${id}-memory`}
            className="input"
            type="number"
            min="0"
            step="1"
            required
            value={memory}
            disabled={busy || free}
            onChange={(e) => setMemory(e.target.value)}
          />
        </label>
        <label htmlFor={`${id}-disk`}>
          {t("Disk (GiB)")}
          <input
            id={`${id}-disk`}
            className="input"
            type="number"
            min="0"
            step="1"
            required
            value={disk}
            disabled={busy || free}
            onChange={(e) => setDisk(e.target.value)}
          />
        </label>
        <label htmlFor={`${id}-price`}>
          {t("Monthly price (USD)")}
          <input
            id={`${id}-price`}
            className="input"
            type="number"
            min="0"
            step="0.01"
            required
            value={price}
            disabled={busy || free}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>
      <p className="form-hint" role="status">
        {t("Pricing preview")}:{" "}
        {free || (freeCpu && freeMemory && freeDisk) || Number(price) === 0
          ? t("Free")
          : t("Reference price: ${price}/month", {
              price: Number.isFinite(Number(price))
                ? Number(price).toFixed(2)
                : "—",
            })}{" "}
        · {cpu || "—"} {t("CPU cores")} · {memory || "—"} MiB · {disk || "—"}{" "}
        GiB
      </p>
      <div className="server-inline">
        <label className="server-check">
          <input
            type="checkbox"
            checked={freeCpu}
            disabled={busy || free}
            onChange={(e) => setFreeCpu(e.target.checked)}
          />
          {t("CPU free")}
        </label>
        <label className="server-check">
          <input
            type="checkbox"
            checked={freeMemory}
            disabled={busy || free}
            onChange={(e) => setFreeMemory(e.target.checked)}
          />
          {t("Memory free")}
        </label>
        <label className="server-check">
          <input
            type="checkbox"
            checked={freeDisk}
            disabled={busy || free}
            onChange={(e) => setFreeDisk(e.target.checked)}
          />
          {t("Disk free")}
        </label>
      </div>
      {error && (
        <p className="wb-alert err" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button className="btn sm primary" disabled={busy}>
        {t(busy ? "Working…" : "Save pricing")}
      </button>
    </form>
  );
}

export default function RuntimeAccessEditor({
  server,
}: {
  server: ServerView;
}) {
  const t = useT();
  const router = useRouter();
  const id = useId();
  const { runtime, capabilities } = server;
  const path = `/runtimes/${encodeURIComponent(runtime.id)}`;
  const access = useEndpointData<AccessData>(
    runtime.owned ? `/api/console${path}` : null,
  );
  const [pending, setPending] = useState<Action | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const internal = isInternalRuntime(runtime);
  function refresh() {
    access.refresh();
    router.refresh();
  }
  function confirm(action: Action) {
    setConfirmName("");
    setPending(action);
    setNotice("");
  }
  if (!runtime.owned)
    return (
      <p className="form-hint">
        {t("Only the owner can manage this server's access.")}
      </p>
    );
  return (
    <section className="server-access">
      <h3>{t("Server access")}</h3>
      {notice && (
        <p className="wb-alert" role="status">
          {notice}
        </p>
      )}
      {internal ? (
        <p>
          {t(
            "This is internal cluster capacity. Public and private sharing settings do not apply.",
          )}
        </p>
      ) : (
        <>
          <div className="server-inline">
            <span className="chip">
              {t(runtime.sharing === "public" ? "Public" : "Private")}
            </span>
            <span>
              {t(
                runtime.sharing === "public"
                  ? "Any Fugue workspace can deploy here."
                  : "Only your workspace and explicitly authorized workspaces can deploy here.",
              )}
            </span>
            {capabilities.sharing && (
              <button
                className="btn sm ghost"
                onClick={() =>
                  confirm({
                    action: "sharing",
                    sharing:
                      runtime.sharing === "public" ? "private" : "public",
                  })
                }
              >
                {t(
                  runtime.sharing === "public" ? "Make private" : "Make public",
                )}
              </button>
            )}
          </div>
          {runtime.sharing === "public" && (
            <>
              <p className="form-hint">
                <PublicPrice offer={runtime.public_offer} />
              </p>
              {capabilities.sharing && (
                <PricingForm runtime={runtime} onSaved={refresh} />
              )}
            </>
          )}
          <h4>{t("Authorized workspaces")}</h4>
          <p className="form-hint">
            {t(
              "Direct grants remain useful if you switch a public server back to private.",
            )}
          </p>
          {access.loading && <p>{t("Loading…")}</p>}
          {access.error && (
            <div className="wb-alert err" role="alert">
              {t(access.error)}{" "}
              <button className="btn sm ghost" onClick={access.refresh}>
                {t("Retry")}
              </button>
            </div>
          )}
          {access.data && (
            <ul className="server-grants">
              {access.data.grants.map((g) => (
                <li key={g.tenantId}>
                  <span>
                    {g.label}
                    <small>{new Date(g.createdAt).toLocaleDateString()}</small>
                  </span>
                  {capabilities.sharing && (
                    <button
                      className="btn sm ghost danger"
                      onClick={() =>
                        confirm({
                          action: "revoke",
                          tenantId: g.tenantId,
                          label: g.label,
                        })
                      }
                    >
                      {t("Remove access")}
                    </button>
                  )}
                </li>
              ))}
              {!access.data.grants.length && (
                <li>{t("No additional workspaces have access.")}</li>
              )}
            </ul>
          )}
          {capabilities.sharing && (
            <form
              className="server-inline"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                setError("");
                try {
                  await callConsole(path, { body: { action: "grant", email } });
                  setEmail("");
                  refresh();
                } catch (err) {
                  setError(
                    t(err instanceof Error ? err.message : "Action failed."),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor={`${id}-email`}>{t("Fugue user email")}</label>
              <input
                id={`${id}-email`}
                className="input"
                type="email"
                autoComplete="off"
                maxLength={254}
                required
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn sm primary" disabled={busy}>
                {t(busy ? "Working…" : "Grant access")}
              </button>
            </form>
          )}
          {error && (
            <p className="wb-alert err" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      <div className="server-inline server-access-actions">
        {capabilities.scope && (
          <button
            className="btn sm ghost"
            onClick={() =>
              confirm({
                action: "scope",
                scope: internal ? "byovps" : "internal",
              })
            }
          >
            {t(internal ? "Return to private BYOVPS" : "Make internal node")}
          </button>
        )}
        {capabilities.delete && (
          <button
            className="btn sm danger"
            onClick={() => confirm({ action: "delete" })}
          >
            {t("Delete offline server")}
          </button>
        )}
      </div>
      {pending && (
        <ConfirmDialog
          title={t(
            pending.action === "scope"
              ? "Change cluster membership"
              : pending.action === "delete"
                ? "Delete offline server"
                : pending.action === "revoke"
                  ? "Remove workspace access"
                  : "Change server visibility",
          )}
          danger={pending.action === "delete" || pending.action === "scope"}
          body={
            <>
              <p>
                {pending.action === "scope"
                  ? t(
                      pending.scope === "internal"
                        ? "The internal cluster will be allowed to schedule here. Existing direct grants will be removed. Public pricing and BYOVPS sharing no longer apply."
                        : "This server will leave internal capacity and become private. Previous direct grants will not be restored.",
                    )
                  : pending.action === "delete"
                    ? t(
                        "Delete only if this VPS is permanently gone. The backend refuses deletion while services or active operations depend on it.",
                      )
                    : pending.action === "revoke"
                      ? t("Remove deploy access for {name}?", {
                          name: pending.label,
                        })
                      : t(
                          pending.sharing === "public"
                            ? "Every Fugue user will be allowed to deploy services on this server."
                            : "New deployments will be limited to your workspace and direct grants. Existing workloads are not stopped by this switch.",
                        )}
              </p>
              {(pending.action === "scope" || pending.action === "delete") && (
                <label htmlFor={`${id}-confirm`}>
                  {t("Type {name} to confirm", { name: runtime.name })}
                  <input
                    id={`${id}-confirm`}
                    className="input"
                    autoComplete="off"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                  />
                </label>
              )}
            </>
          }
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            if (
              (pending.action === "scope" || pending.action === "delete") &&
              confirmName !== runtime.name
            )
              throw new Error(t("Type the server name to confirm."));
            const result = await callConsole<{ nodeReconciled?: boolean }>(
              path,
              { body: { ...pending, confirmName } },
            );
            setPending(null);
            setNotice(
              t(
                pending.action === "scope" && result.nodeReconciled === false
                  ? "Membership saved. Waiting for the node to apply the change."
                  : "Server settings updated.",
              ),
            );
            refresh();
          }}
        />
      )}
    </section>
  );
}
