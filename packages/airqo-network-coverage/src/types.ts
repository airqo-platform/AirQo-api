// types.ts — All public-facing TypeScript types for the Network Coverage API

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type MonitorType = "Reference" | "LCS" | "Inactive";
export type MonitorStatus = "active" | "inactive";
export type MonitorSource = "airqo" | "external";
export type PublicDataValue = "Yes" | "No";

// ---------------------------------------------------------------------------
// Core data shapes
// ---------------------------------------------------------------------------

/**
 * A single air-quality monitor as returned by the list and detail endpoints.
 */
export interface MonitorListItem {
  /** Registry document `_id` (or AirQo Site `_id` for pipeline monitors) */
  id: string;
  name: string;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "UG", "GH") */
  iso2: string;
  /** Approximate latitude — null when coordinates are not available */
  latitude: number | null;
  /** Approximate longitude — null when coordinates are not available */
  longitude: number | null;
  type: MonitorType;
  status: MonitorStatus;
  /** "airqo" for pipeline sites; "external" for standalone contributed entries */
  source: MonitorSource;
  network: string;
  operator: string;
  equipment: string;
  manufacturer: string;
  pollutants: string[];
  resolution: string;
  transmission: string;
  /** Human-readable site description */
  site: string;
  landUse: string;
  /** Deployment date in human-readable form (e.g. "Dec 2020") */
  deployed: string;
  calibrationLastDate: string;
  calibrationMethod: string;
  /** Uptime over the last 30 days (e.g. "96%") */
  uptime30d: string;
  publicData: PublicDataValue;
  organisation: string;
  coLocation: string;
  coLocationNote: string;
  /** Deep-link to an external data portal for this monitor */
  viewDataUrl: string;
  /** ISO 8601 timestamp — null for AirQo pipeline monitors */
  lastActive: string | null;
}

/**
 * Per-country summary included in the list response.
 */
export interface CountrySummary {
  /** URL-safe slug (e.g. "uganda", "cote-divoire") */
  countryId: string;
  country: string;
  /** ISO 3166-1 alpha-2 */
  iso2: string;
  total: number;
  active: number;
  inactive: number;
}

/**
 * Aggregate metadata included in the list response.
 */
export interface NetworkCoverageMeta {
  total: number;
  active: number;
  inactive: number;
  countries: number;
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data?: T;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  errors?: Record<string, unknown>;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

/**
 * Response shape for GET /network-coverage
 */
export interface NetworkCoverageListResponse {
  success: true;
  message: string;
  meta: NetworkCoverageMeta;
  countries: CountrySummary[];
  monitors: MonitorListItem[];
}

/**
 * Response shape for GET /network-coverage/monitors/:monitorId
 */
export interface MonitorDetailResponse {
  success: true;
  message: string;
  data: MonitorListItem;
}

/**
 * Response shape for GET /network-coverage/countries/:countryId/monitors
 */
export interface CountryMonitorsResponse {
  success: true;
  message: string;
  countryId: string;
  country: string;
  iso2: string;
  monitors: MonitorListItem[];
}

/**
 * Response shape for POST /network-coverage/registry
 */
export interface RegistryUpsertResponse {
  success: true;
  message: string;
  /** 201 when created, 200 when updated */
  status: number;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

/**
 * Query parameters accepted by GET /network-coverage and
 * GET /network-coverage/countries/:countryId/monitors
 */
export interface ListParams {
  /** Filter by partial name, city, or country */
  search?: string;
  /** When true, return only active monitors */
  activeOnly?: boolean;
  /** Comma-separated list of monitor types to include */
  types?: MonitorType | MonitorType[];
  /** Override the default tenant */
  tenant?: string;
  /** Override the client-level access token for this request */
  token?: string;
}

/**
 * Query parameters accepted by GET /network-coverage/export.csv
 */
export interface ExportCsvParams {
  countryId?: string;
  search?: string;
  activeOnly?: boolean;
  types?: MonitorType | MonitorType[];
  tenant?: string;
  /** Override the client-level access token for this request */
  token?: string;
}

/**
 * Shared optional metadata fields present in both registry payload shapes.
 */
interface RegistryCommonFields {
  city?: string;
  type?: MonitorType;
  status?: MonitorStatus;
  /** ISO 3166-1 alpha-2 override */
  iso2?: string;
  network?: string;
  operator?: string;
  equipment?: string;
  manufacturer?: string;
  pollutants?: string[];
  resolution?: string;
  transmission?: string;
  site?: string;
  landUse?: string;
  deployed?: string;
  calibrationLastDate?: string;
  calibrationMethod?: string;
  uptime30d?: string;
  publicData?: PublicDataValue;
  organisation?: string;
  coLocation?: string;
  coLocationNote?: string;
  viewDataUrl?: string;
  /** ISO 8601 date string */
  lastActive?: string;
  tenant?: string;
}

/**
 * Shape A — AirQo-site enrichment.
 * Provide `site_id`; name/country/lat/lng are optional (sourced live from the Site document).
 */
export type RegistryUpsertWithSite = RegistryCommonFields & {
  site_id: string;
  name?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * Shape B — Standalone external entry.
 * Omit `site_id`; name, country, latitude, and longitude are required.
 */
export type RegistryUpsertStandalone = RegistryCommonFields & {
  site_id?: never;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};

/**
 * Body for POST /network-coverage/registry.
 *
 * Two mutually exclusive shapes enforced at compile time:
 *   - `RegistryUpsertWithSite`   — pass `site_id` to enrich an existing AirQo site
 *   - `RegistryUpsertStandalone` — omit `site_id` and provide name/country/lat/lng for an external entry
 */
export type RegistryUpsertPayload = RegistryUpsertWithSite | RegistryUpsertStandalone;

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

export interface NetworkCoverageClientOptions {
  /**
   * Base URL of the AirQo API (no trailing slash).
   * Defaults to the AirQo production API.
   */
  baseUrl?: string;
  /**
   * Default tenant to use for all requests. Can be overridden per-request.
   * Defaults to "airqo".
   */
  defaultTenant?: string;
  /**
   * Request timeout in milliseconds. Defaults to 30 000 ms.
   */
  timeoutMs?: number;
  /**
   * Additional headers to send with every request (e.g. Authorization).
   */
  headers?: Record<string, string>;
  /**
   * AirQo access token. When provided it is appended as `?token=` on every
   * request — the same mechanism described in the AirQo API documentation.
   * Can be overridden per-request via the `token` field on each params object.
   */
  token?: string;
}
