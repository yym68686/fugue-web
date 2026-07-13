"use client";

import dynamic from "next/dynamic";

import { ConsoleIslandLoading } from "@/components/console/island-loading";
import type { DnsStateMessages } from "@/lib/i18n/console-messages";
import type { Locale } from "@/lib/i18n/core";

export const DNSConsole = dynamic<{ locale: Locale; messages: DnsStateMessages }>(
  () =>
    import("@/components/fugue-coss/dns-console").then((module) => module.DNSConsole),
  { loading: ConsoleIslandLoading },
);
