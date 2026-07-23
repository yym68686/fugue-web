"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callConsole } from "@/components/workbench/shared";

type CreatedProject = { project?: { id?: string } };

export default function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setName("");
    setDesc("");
    setError(null);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("项目名称不能为空");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await callConsole<CreatedProject>("/projects", {
        method: "POST",
        body: { name: trimmed, description: desc.trim() },
      });
      const id = result?.project?.id;
      if (id) {
        router.push(`/projects/${encodeURIComponent(id)}`);
      } else {
        // No id returned; fall back to refreshing the list.
        router.refresh();
        close();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新建项目
      </button>

      {open && (
        <div className="modal-scrim" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <h3>新建项目</h3>
            </div>
            <div className="modal-b">
              <div className="form">
                <div className="form-row">
                  <label>名称</label>
                  <input
                    className="input"
                    autoFocus
                    value={name}
                    placeholder="my-project"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                </div>
                <div className="form-row">
                  <label>描述</label>
                  <textarea
                    className="textarea"
                    value={desc}
                    placeholder="可选，项目用途说明"
                    onChange={(e) => setDesc(e.target.value)}
                  />
                </div>
              </div>
              {error && (
                <div className="wb-alert err" style={{ marginTop: 12, marginBottom: 0 }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-f">
              <button type="button" className="btn ghost" onClick={close} disabled={busy}>
                取消
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={submit}
                disabled={busy}
              >
                {busy ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
