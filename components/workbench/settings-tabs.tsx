"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BackingService, ConsoleAppDetail } from "@/lib/fugue/console";
import { ActionButton, callConsole, ConfirmDialog } from "./shared";

const APP = (id: string) => `/apps/${encodeURIComponent(id)}`;

/* =========================== Settings tab (app) =========================== */

export function SettingsTab({
  app,
  onDeleted,
}: {
  app: ConsoleAppDetail;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const spec = app.spec ?? {};
  const [startupCommand, setStartupCommand] = useState(spec.command ?? "");
  const [imageMirrorLimit, setImageMirrorLimit] = useState(
    spec.image_mirror_limit != null ? String(spec.image_mirror_limit) : "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const phase = app.status?.phase?.toLowerCase() ?? "";
  const paused = phase === "paused" || phase === "stopped" || app.status?.current_replicas === 0;

  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <h3>运行时设置</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>启动命令</label>
            <input
              className="input mono"
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
              placeholder="(默认)"
            />
          </div>
          <div className="form-row">
            <label>镜像保留数量</label>
            <input
              className="input mono"
              type="number"
              min={1}
              value={imageMirrorLimit}
              onChange={(e) => setImageMirrorLimit(e.target.value)}
              placeholder="5"
              style={{ maxWidth: 120 }}
            />
          </div>
          <div className="form-row">
            <label>运行时</label>
            <span className="mono">{spec.runtime_id || "—"}</span>
          </div>
          <div className="form-row">
            <label>网络模式</label>
            <span className="mono">{spec.network_mode || "default"}</span>
          </div>
          <div className="form-row">
            <label>副本数</label>
            <span className="mono">{spec.replicas ?? app.status?.current_replicas ?? "—"}</span>
          </div>
        </div>
        <div className="form-foot">
          <ActionButton
            className="btn primary"
            onAction={() => {
              const patch: Record<string, unknown> = { startup_command: startupCommand };
              const n = Number(imageMirrorLimit);
              if (imageMirrorLimit && Number.isFinite(n)) patch.image_mirror_limit = n;
              return callConsole(APP(app.id), { method: "PATCH", body: patch });
            }}
            onDone={() => router.refresh()}
          >
            保存设置
          </ActionButton>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>源</h3>
        </div>
        <div className="form">
          <div className="form-row">
            <label>来源</label>
            <span className="mono">{app.origin_source?.repo_url || app.origin_source?.type || "—"}</span>
          </div>
          <div className="form-row">
            <label>分支</label>
            <span className="mono">{app.origin_source?.repo_branch || "—"}</span>
          </div>
          <div className="form-row">
            <label>提交</label>
            <span className="mono">{app.build_source?.commit_sha?.slice(0, 12) || "—"}</span>
          </div>
        </div>
        <div className="form-foot">
          <ActionButton
            className="btn"
            confirm="确认从源重新构建并部署?"
            onAction={() => callConsole(`${APP(app.id)}/rebuild`, { body: {} })}
            onDone={() => router.refresh()}
          >
            重新构建
          </ActionButton>
        </div>
      </div>

      <div className="panel danger-zone">
        <div className="panel-h">
          <h3>危险操作</h3>
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">重启服务</div>
            <div className="sub">滚动重启,保持副本数不变。</div>
          </div>
          <ActionButton
            className="btn"
            confirm="确认重启该服务?"
            onAction={() => callConsole(`${APP(app.id)}/restart`)}
            onDone={() => router.refresh()}
          >
            重启
          </ActionButton>
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">{paused ? "启动服务" : "暂停服务"}</div>
            <div className="sub">
              {paused ? "将副本恢复到 1,重新对外提供服务。" : "缩容到 0,停止对外服务但保留配置。"}
            </div>
          </div>
          {paused ? (
            <ActionButton
              className="btn"
              onAction={() => callConsole(`${APP(app.id)}/scale`, { body: { replicas: 1 } })}
              onDone={() => router.refresh()}
            >
              启动
            </ActionButton>
          ) : (
            <ActionButton
              className="btn"
              confirm="确认暂停该服务?将停止对外服务。"
              onAction={() => callConsole(`${APP(app.id)}/disable`)}
              onDone={() => router.refresh()}
            >
              暂停
            </ActionButton>
          )}
        </div>
        <div className="danger-row">
          <div className="danger-txt">
            <div className="nm">删除服务</div>
            <div className="sub">永久删除该服务及其资源,不可撤销。</div>
          </div>
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
            删除
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="删除服务"
          danger
          confirmLabel="永久删除"
          body={
            <>
              确认删除服务 <span className="mono">{app.name}</span>?此操作不可撤销,将移除所有相关资源。
            </>
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await callConsole(`${APP(app.id)}?force=true`, { method: "DELETE" });
            onDeleted();
          }}
        />
      )}
    </>
  );
}

/* ===================== Database (backing) service tabs ===================== */

export function DbOverviewTab({ svc }: { svc: BackingService }) {
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>概览</h3>
      </div>
      <div className="form">
        <div className="form-row">
          <label>类型</label>
          <span className="mono">{svc.type || "—"}</span>
        </div>
        <div className="form-row">
          <label>状态</label>
          <span className="mono">{svc.status || "—"}</span>
        </div>
        <div className="form-row">
          <label>所属应用</label>
          <span className="mono">{svc.owner_app_name || svc.owner_app_id || "—"}</span>
        </div>
        <div className="form-row">
          <label>运行时</label>
          <span className="mono">{svc.location_label || svc.database_runtime_id || "—"}</span>
        </div>
      </div>
    </div>
  );
}

export function DbFailoverTab({ svc }: { svc: BackingService }) {
  const tone = svc.continuity?.live ? "ok" : "idle";
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>故障转移</h3>
      </div>
      <div className="form">
        <div className="form-row">
          <label>连续性</label>
          <span className={`chip ${tone}`}>{svc.continuity?.label || "未配置"}</span>
        </div>
        <div className="form-row">
          <label>已配置</label>
          <span className="mono">{svc.failover_configured ? "是" : "否"}</span>
        </div>
        <div className="form-row">
          <label>目标运行时</label>
          <span className="mono">{svc.failover_target_runtime_id || "—"}</span>
        </div>
      </div>
    </div>
  );
}
