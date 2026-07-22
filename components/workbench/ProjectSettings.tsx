"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [nm, setNm] = useState(name);
  const [desc, setDesc] = useState(description);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const PROJECT = `/projects/${encodeURIComponent(projectId)}`;

  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <h3>项目设置</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>名称</label>
            <input
              className="input"
              value={nm}
              onChange={(e) => setNm(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>描述</label>
            <textarea
              className="textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="项目描述"
            />
          </div>
        </div>
        <div className="form-foot">
          <ActionButton
            className="btn primary"
            onAction={() => {
              if (!nm.trim()) throw new Error("名称不能为空");
              return callConsole(PROJECT, {
                method: "PATCH",
                body: { name: nm.trim(), description: desc },
              });
            }}
            onDone={() => router.refresh()}
          >
            保存
          </ActionButton>
        </div>
      </div>

      <div className="panel danger-zone">
        <div className="panel-h">
          <h3>危险操作</h3>
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">删除项目</div>
            <div className="sub">永久删除该项目及其所有服务,不可撤销。</div>
          </div>
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
            删除项目
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="删除项目"
          danger
          confirmLabel="永久删除"
          body={
            <>
              确认删除项目 <span className="mono">{nm}</span>?此操作不可撤销,将移除项目下所有服务与资源。
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
