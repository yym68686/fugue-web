import type { components } from "@/lib/fugue/openapi.generated";

type Primitive = bigint | boolean | null | number | string | symbol | undefined;
type Simplify<T> = { [Key in keyof T]: T[Key] } & {};
type CamelCase<Value extends string> = Value extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : Value;
type CamelizeDeep<Value> = Value extends Primitive
  ? Value
  : Value extends ReadonlyArray<infer Item>
    ? CamelizeDeep<Item>[]
    : Value extends Array<infer Item>
      ? CamelizeDeep<Item>[]
      : Value extends Record<string, unknown>
        ? {
            [Key in keyof Value as Key extends string
              ? CamelCase<Key>
              : Key]: CamelizeDeep<Value[Key]>;
          }
        : Value;

type Schemas = components["schemas"];
type ClientSchema<Name extends keyof Schemas> = Simplify<CamelizeDeep<Schemas[Name]>>;

/**
 * Client-safe views returned by Fugue's internal JSON routes.
 *
 * The server API module imports `server-only`, so client components derive their
 * response shapes directly from the generated OpenAPI contract instead of
 * importing that server module, even as a type-only dependency.
 */
export type FugueAppEnvResult = ClientSchema<"AppEnvResponse">;
export type FugueAppDomainListResult = ClientSchema<"AppDomainListResponse">;
export type FugueAppRestartResult = ClientSchema<"AppRestartResponse">;
export type FugueAppFilesystemTreeResult = ClientSchema<"AppFilesystemTreeResponse">;
export type FugueAppImageInventoryResult = ClientSchema<"AppImageInventoryResponse">;
export type FugueAppObservabilityMetricsSummary =
  ClientSchema<"AppObservabilityMetricsSummaryResponse">;
export type FugueAppObservabilityRequests =
  ClientSchema<"AppObservabilityRequestsResponse">;
export type FugueBuildLogsResult = ClientSchema<"BuildLogsResponse">;
export type FugueRuntimeLogsResult = ClientSchema<"RuntimeLogsResponse">;
export type FugueHostedDNSRecordResult = ClientSchema<"HostedDNSRecordResponse">;
export type FugueHostedDNSRecordType = components["schemas"]["HostedDNSRecord"]["type"];
