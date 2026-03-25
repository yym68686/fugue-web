"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { API_KEY_CREATE_REQUEST_EVENT } from "@/lib/console/events";

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
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
}

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function ApiKeyEmptyState() {
  const router = useRouter();
  const { showToast } = useToast();
  const createRequestRef = useRef<() => void>(() => {});
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      await requestJson("/api/fugue/workspace/bootstrap", {
        method: "POST",
      });

      const created = await requestJson<{
        key: {
          id: string;
        };
        secret: string;
      }>("/api/fugue/api-keys", {
        method: "POST",
      });
      const copied = await copyText(created.secret);

      showToast({
        message: copied ? "Key created and secret copied." : "Key created.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  createRequestRef.current = () => {
    void handleCreate();
  };

  useEffect(() => {
    const handleCreateRequest = () => {
      createRequestRef.current();
    };

    window.addEventListener(API_KEY_CREATE_REQUEST_EVENT, handleCreateRequest);

    return () => {
      window.removeEventListener(API_KEY_CREATE_REQUEST_EVENT, handleCreateRequest);
    };
  }, []);

  return (
    <div className="fg-console-empty-state">
      <div>
        <strong>No keys yet</strong>
        <p>Create a key when you need one.</p>
      </div>

      <div className="fg-console-empty-state__actions">
        <Button
          aria-busy={isCreating || undefined}
          disabled={isCreating}
          onClick={() => {
            void handleCreate();
          }}
          variant="primary"
        >
          {isCreating ? "Creating…" : "Create key"}
        </Button>
      </div>
    </div>
  );
}
