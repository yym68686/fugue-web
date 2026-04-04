"use client";

import { useSyncExternalStore } from "react";

export type PendingProjectIntentSourceMode =
  | "docker-image"
  | "github"
  | "local-upload";

export type PendingProjectIntentStatus = "error" | "pending" | "resolved";

export type PendingProjectIntent = {
  appId: string | null;
  appName: string | null;
  createdAt: number;
  errorMessage: string | null;
  id: string;
  projectId: string | null;
  projectName: string;
  requestInProgress: boolean;
  retryHref: string | null;
  sourceLabel: string | null;
  sourceMode: PendingProjectIntentSourceMode;
  status: PendingProjectIntentStatus;
};

const PENDING_PROJECT_INTENT_TTL_MS = 15 * 60 * 1000;

const listeners = new Set<() => void>();
const intents = new Map<string, PendingProjectIntent>();

function createIntentId() {
  return `intent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emitChange() {
  listeners.forEach((listener) => {
    listener();
  });
}

function isExpired(intent: PendingProjectIntent) {
  return Date.now() - intent.createdAt > PENDING_PROJECT_INTENT_TTL_MS;
}

function pruneExpiredIntents() {
  let didChange = false;

  intents.forEach((intent, id) => {
    if (!isExpired(intent)) {
      return;
    }

    intents.delete(id);
    didChange = true;
  });

  if (didChange) {
    emitChange();
  }
}

export function createPendingProjectIntent(input: {
  appName?: string | null;
  projectId?: string | null;
  projectName: string;
  retryHref?: string | null;
  sourceLabel?: string | null;
  sourceMode: PendingProjectIntentSourceMode;
}) {
  pruneExpiredIntents();

  const intent: PendingProjectIntent = {
    appId: null,
    appName: input.appName?.trim() || null,
    createdAt: Date.now(),
    errorMessage: null,
    id: createIntentId(),
    projectId: input.projectId?.trim() || null,
    projectName: input.projectName.trim() || "Untitled project",
    requestInProgress: false,
    retryHref: input.retryHref?.trim() || null,
    sourceLabel: input.sourceLabel?.trim() || null,
    sourceMode: input.sourceMode,
    status: "pending",
  };

  intents.set(intent.id, intent);
  emitChange();

  return intent;
}

export function readPendingProjectIntent(id?: string | null) {
  if (!id) {
    return null;
  }

  const intent = intents.get(id) ?? null;

  if (!intent || isExpired(intent)) {
    return null;
  }

  return intent;
}

export function resolvePendingProjectIntent(
  id: string,
  patch: {
    appId?: string | null;
    projectId?: string | null;
    requestInProgress?: boolean;
  },
) {
  const current = intents.get(id);

  if (!current) {
    return null;
  }

  const next: PendingProjectIntent = {
    ...current,
    appId:
      patch.appId === undefined ? current.appId : patch.appId?.trim() || null,
    errorMessage: null,
    projectId:
      patch.projectId === undefined
        ? current.projectId
        : patch.projectId?.trim() || null,
    requestInProgress: patch.requestInProgress ?? false,
    status: "resolved",
  };

  intents.set(id, next);
  emitChange();

  return next;
}

export function failPendingProjectIntent(id: string, errorMessage: string) {
  const current = intents.get(id);

  if (!current) {
    return null;
  }

  const next: PendingProjectIntent = {
    ...current,
    errorMessage: errorMessage.trim() || "Request failed.",
    requestInProgress: false,
    status: "error",
  };

  intents.set(id, next);
  emitChange();

  return next;
}

export function clearPendingProjectIntent(id: string) {
  if (!intents.delete(id)) {
    return false;
  }

  emitChange();
  return true;
}

function subscribe(listener: () => void) {
  pruneExpiredIntents();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function usePendingProjectIntent(id?: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => readPendingProjectIntent(id),
    () => null,
  );
}
