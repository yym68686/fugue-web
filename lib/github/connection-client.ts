"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import type { GitHubConnectionView } from "@/lib/github/types";
import { readResponseError } from "@/lib/ui/request-json";

type UseGitHubConnectionOptions = {
  enabled?: boolean;
  returnTo?: string;
};

function buildCurrentReturnTo(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

export function buildGitHubConnectHref(returnTo: string) {
  return `/api/auth/github/connect/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export function useGitHubConnection(options?: UseGitHubConnectionOptions) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const enabled = options?.enabled ?? true;
  const search = searchParams.toString();
  const resolvedReturnTo =
    options?.returnTo ?? buildCurrentReturnTo(pathname, search);
  const [connection, setConnection] = useState<GitHubConnectionView | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  async function loadConnection(signal?: AbortSignal) {
    if (!enabled) {
      setConnection(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/github/connection", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response));
      }

      const data = (await response.json()) as GitHubConnectionView;

      if (signal?.aborted) {
        return;
      }

      setConnection(data);
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setConnection(null);
      setError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not load saved GitHub access.",
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadConnection(controller.signal);
    return () => controller.abort();
  }, [enabled, pathname, search]);

  return {
    connectHref: buildGitHubConnectHref(resolvedReturnTo),
    connection,
    error,
    loading,
    refresh: () => loadConnection(),
  };
}
