// index.ts — Public API surface for @airqo/network-coverage

export { NetworkCoverageClient, NetworkCoverageError } from "./client.js";

export type {
  // Enums
  MonitorType,
  MonitorStatus,
  MonitorSource,
  PublicDataValue,

  // Core data shapes
  MonitorListItem,
  CountrySummary,
  NetworkCoverageMeta,

  // Response envelopes
  NetworkCoverageListResponse,
  MonitorDetailResponse,
  CountryMonitorsResponse,
  RegistryUpsertResponse,
  ApiSuccessEnvelope,
  ApiErrorEnvelope,
  ApiEnvelope,

  // Request params / payloads
  ListParams,
  ExportCsvParams,
  RegistryUpsertPayload,

  // Client config
  NetworkCoverageClientOptions,
} from "./types.js";
