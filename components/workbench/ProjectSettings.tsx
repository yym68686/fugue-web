"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ActionButton, callConsole, ConfirmDialog } from "./shared";

export default function ProjectSettings({
  projectId,
  name,
  description,
}: {
  projectId: string;
  name: string;
  description: string;
}) {
  const t = useT();
  const router = useRouter();
  const [nm, setNm] = useState(name);
  const [desc, setDesc] = useState(description);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const PROJECT = `/projects/${encodeURIComponent(projectId)}`;

  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <h3>{t("Basic info")}</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>{t("Name")}</label>
            <input
              className="input"
              value={nm}
              onChange={(e) => setNm(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>{t("Description")}</label>
            <textarea
              className="textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t("Project description")}
            />
          </div>
        </div>
        <div className="form-foot">
          <ActionButton
            className="btn primary"
            onAction={() => {
              if (!nm.trim()) throw new Error(t("Name cannot be empty"));
              return callConsole(PROJECT, {
                method: "PATCH",
                body: { name: nm.trim(), description: desc },
              });
            }}
            onDone={() => router.refresh()}
          >
            {t("Save")}
          </ActionButton>
        </div>
      </div>

      <div className="panel danger-zone">
        <div className="panel-h">
          <h3>{t("Danger zone")}</h3>
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">{t("Delete project")}</div>
            <div className="sub">{t("Permanently delete this project and all its services. This cannot be undone.")}</div>
          </div>
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
            {t("Delete project")}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t("Delete project")}
          danger
          confirmLabel={t("Permanently delete")}
          body={
            <>
              {t("Delete project")} <span className="mono">{nm}</span>
              {t("? This action cannot be undone and will remove all services and resources under the project.")}
            </>
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await callConsole(PROJECT, { method: "DELETE" });
            router.push("/projects");
          }}
        />
      )}
    </>
  );
}
