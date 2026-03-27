"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { NODE_KEY_CREATE_REQUEST_EVENT } from "@/lib/console/events";
import { copyText } from "@/lib/ui/clipboard";

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
      const createRequest = requestJson<{
        created: boolean;
      }>("/api/fugue/workspace/bootstrap", {
        method: "POST",
      }).then(() =>
        requestJson<{
          key: {
            id: string;
          };
          secret: string;
        }>("/api/fugue/node-keys", {
          method: "POST",
        }),
      );
      const copiedPromise = copyText(createRequest.then((data) => data.secret));
      await createRequest;
      const copied = await copiedPromise;

      showToast({
        message: copied
          ? "Node key created and secret copied."
          : "Node key created.",
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

    window.addEventListener(NODE_KEY_CREATE_REQUEST_EVENT, handleCreateRequest);

    return () => {
      window.removeEventListener(NODE_KEY_CREATE_REQUEST_EVENT, handleCreateRequest);
    };
  }, []);

  return (
    <div className="fg-console-empty-state">
      <div>
        <strong>No keys yet</strong>
        <p>Create the first node key when you are ready.</p>
      </div>

      <div className="fg-console-empty-state__actions">
        <Button
          aria-busy={isCreating || undefined}
          loading={isCreating}
          loadingLabel="Creating node key…"
          onClick={() => {
            void handleCreate();
          }}
          variant="primary"
        >
          Create node key
        </Button>
      </div>
    </div>
  );
}
