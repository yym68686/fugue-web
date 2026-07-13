"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsoleProjectDetailData } from "@/lib/console/gallery-types";
import type { Locale } from "@/lib/i18n/core";
import {
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

export type WorkbenchProject = NonNullable<ConsoleProjectDetailData["project"]>;
export type WorkbenchService = WorkbenchProject["services"][number];
export type WorkbenchAppService = Extract<WorkbenchService, { kind: "app" }>;
export type WorkbenchBackingService = Extract<
  WorkbenchService,
  { kind: "backing-service" }
>;

export function isWorkbenchAppService(
  service: WorkbenchService,
): service is WorkbenchAppService {
  return service.kind === "app";
}

export function workbenchTabs(service: WorkbenchService): string[] {
  return isWorkbenchAppService(service)
    ? ["Route", "Environment", "Logs", "Files", "Images", "Observability", "Settings"]
    : ["Overview", "Failover", "Settings"];
}

export function resolveWorkbenchSelection(
  detail: ConsoleProjectDetailData | undefined,
  requestedServiceId: string | null,
  requestedTab: string | null,
) {
  const services = detail?.project?.services ?? [];
  const service =
    services.find((item) => item.id === requestedServiceId) ?? services[0] ?? null;
  const tabs = service ? workbenchTabs(service) : [];

  return {
    selectedServiceId: service?.id ?? null,
    tab:
      requestedTab && tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? "Route"),
  };
}

export function shouldUseInitialWorkbenchDetail(
  initialDetail: ConsoleProjectDetailData | undefined,
  refreshKey: number,
): initialDetail is ConsoleProjectDetailData {
  return initialDetail !== undefined && refreshKey === 0;
}

export function formatBytes(locale: Locale, value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unknown";
  }

  if (value === 0) {
    return "0 bytes";
  }

  const units = ["bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024)),
  );
  const amount = value / 1024 ** index;

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(amount)} ${units[index]}`;
}

export function formatRelativeOrExact(locale: Locale, value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type EndpointDataState<T> = {
  data: T | null;
  endpoint: string | null;
  error: string | null;
  loading: boolean;
};

export type EndpointInitialData<T> = {
  data: T | null;
  endpoint: string;
  error: string | null;
};

export function shouldUseInitialEndpointData(
  initialEndpoint: string | null,
  currentEndpoint: string | null,
  refreshKey: number,
  departedInitialEndpoint: boolean,
) {
  return (
    Boolean(initialEndpoint) &&
    initialEndpoint === currentEndpoint &&
    refreshKey === 0 &&
    !departedInitialEndpoint
  );
}

export function useEndpointData<T>(
  url: string | null,
  options?: { initialData?: EndpointInitialData<T> },
) {
  const initialDataRef = useRef(options?.initialData ?? null);
  const initialData = initialDataRef.current;
  const [state, setState] = useState<EndpointDataState<T>>(() => {
    if (initialData?.endpoint === url) {
      return {
        data: initialData.data,
        endpoint: url,
        error: initialData.error,
        loading: false,
      };
    }

    return {
      data: null,
      endpoint: url,
      error: null,
      loading: Boolean(url),
    };
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdentityRef = useRef<object | null>(null);
  const departedInitialEndpointRef = useRef(false);

  useEffect(() => {
    const requestIdentity = { refreshKey, url };
    requestIdentityRef.current = requestIdentity;

    if (!url) {
      setState({ data: null, endpoint: null, error: null, loading: false });
      return;
    }

    if (initialData?.endpoint !== url) {
      departedInitialEndpointRef.current = true;
    }

    if (
      shouldUseInitialEndpointData(
        initialData?.endpoint ?? null,
        url,
        refreshKey,
        departedInitialEndpointRef.current,
      )
    ) {
      setState({
        data: initialData?.data ?? null,
        endpoint: url,
        error: initialData?.error ?? null,
        loading: false,
      });
      return;
    }

    const controller = new AbortController();
    setState((current) => ({
      data: current.endpoint === url ? current.data : null,
      endpoint: url,
      error: null,
      loading: true,
    }));

    requestJson<T>(url, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((value) => {
        if (
          controller.signal.aborted ||
          requestIdentityRef.current !== requestIdentity
        ) {
          return;
        }

        setState({ data: value, endpoint: url, error: null, loading: false });
      })
      .catch((nextError) => {
        if (
          controller.signal.aborted ||
          requestIdentityRef.current !== requestIdentity ||
          isAbortRequestError(nextError)
        ) {
          return;
        }

        setState({
          data: null,
          endpoint: url,
          error: readRequestError(nextError),
          loading: false,
        });
      });

    return () => controller.abort();
  }, [initialData, url, refreshKey]);

  const isCurrentEndpoint = state.endpoint === url;

  return {
    data: isCurrentEndpoint ? state.data : null,
    error: isCurrentEndpoint ? state.error : null,
    loading: isCurrentEndpoint ? state.loading : Boolean(url),
    refresh: () => setRefreshKey((value) => value + 1),
  };
}
