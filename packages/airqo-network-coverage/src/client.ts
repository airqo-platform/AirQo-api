// client.ts — NetworkCoverageClient
// Uses the native fetch API (Node 18+). No runtime dependencies.

import type {
  NetworkCoverageClientOptions,
  NetworkCoverageListResponse,
  MonitorDetailResponse,
  CountryMonitorsResponse,
  RegistryUpsertResponse,
  ListParams,
  ExportCsvParams,
  RegistryUpsertPayload,
  MonitorType,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.airqo.net/api/v2/devices";
const DEFAULT_TENANT = "airqo";
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildQuery(
  params: Record<string, string | boolean | number | undefined>
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `?${qs}`;
}

function typesParam(types?: MonitorType | MonitorType[]): string | undefined {
  if (!types) return undefined;
  return Array.isArray(types) ? types.join(",") : types;
}

// ---------------------------------------------------------------------------
// Runtime payload assertion
// ---------------------------------------------------------------------------

/**
 * Fails fast before a network request is made when the payload violates the
 * Shape A / Shape B contract that TypeScript enforces at compile time but
 * JavaScript callers or dynamic data can bypass at runtime.
 *
 * Shape A (site_id present)  — no required fields; name/country/lat/lng are optional overrides.
 * Shape B (site_id absent)   — name, country, latitude, longitude are all required and valid.
 */
function assertRegistryPayload(payload: RegistryUpsertPayload): void {
  if ("site_id" in payload && payload.site_id !== undefined) {
    // Shape A — nothing further to assert; optional fields are caller's choice.
    return;
  }

  // Shape B — standalone entry: validate required location fields.
  const errors: string[] = [];

  if (typeof (payload as { name?: unknown }).name !== "string" || !(payload as { name: string }).name.trim()) {
    errors.push("name must be a non-empty string");
  }
  if (typeof (payload as { country?: unknown }).country !== "string" || !(payload as { country: string }).country.trim()) {
    errors.push("country must be a non-empty string");
  }

  const lat = (payload as { latitude?: unknown }).latitude;
  if (typeof lat !== "number" || !isFinite(lat) || lat < -90 || lat > 90) {
    errors.push("latitude must be a finite number between -90 and 90");
  }

  const lng = (payload as { longitude?: unknown }).longitude;
  if (typeof lng !== "number" || !isFinite(lng) || lng < -180 || lng > 180) {
    errors.push("longitude must be a finite number between -180 and 180");
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid standalone registry payload (Shape B requires name, country, latitude, longitude): ${errors.join("; ")}`
    );
  }
}

// ---------------------------------------------------------------------------
// NetworkCoverageClient
// ---------------------------------------------------------------------------

export class NetworkCoverageClient {
  private readonly baseUrl: string;
  private readonly defaultTenant: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly token: string | undefined;

  constructor(options: NetworkCoverageClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultTenant = options.defaultTenant ?? DEFAULT_TENANT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.extraHeaders = options.headers ?? {};
    this.token = options.token;
  }

  // -------------------------------------------------------------------------
  // Private request helpers
  // -------------------------------------------------------------------------

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...this.extraHeaders },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { message?: string }).message ?? response.statusText;
        throw new NetworkCoverageError(message, response.status, body);
      }

      const data = await response.json() as T;
      return data;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new NetworkCoverageError(
          `Request timed out after ${this.timeoutMs}ms`,
          408
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async getRaw(path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { ...this.extraHeaders },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new NetworkCoverageError(response.statusText, response.status);
      }

      return await response.text();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new NetworkCoverageError(
          `Request timed out after ${this.timeoutMs}ms`,
          408
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.extraHeaders },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => ({}));
        const message =
          (responseBody as { message?: string }).message ?? response.statusText;
        throw new NetworkCoverageError(message, response.status, responseBody);
      }

      const data = await response.json() as T;
      return data;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new NetworkCoverageError(
          `Request timed out after ${this.timeoutMs}ms`,
          408
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async delete<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...this.extraHeaders },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          (body as { message?: string }).message ?? response.statusText;
        throw new NetworkCoverageError(message, response.status, body);
      }

      const data = await response.json() as T;
      return data;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new NetworkCoverageError(
          `Request timed out after ${this.timeoutMs}ms`,
          408
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * GET /network-coverage
   *
   * Returns all monitors grouped by country along with aggregate metadata.
   * Use this to power a map or sidebar listing.
   */
  async list(params: ListParams = {}): Promise<NetworkCoverageListResponse> {
    const { search, activeOnly, types, tenant, token } = params;
    const qs = buildQuery({
      tenant: tenant ?? this.defaultTenant,
      token,
      search,
      activeOnly: activeOnly !== undefined ? String(activeOnly) : undefined,
      types: typesParam(types),
    });
    return this.get<NetworkCoverageListResponse>(
      `/network-coverage${qs}`
    );
  }

  /**
   * GET /network-coverage/monitors/:monitorId
   *
   * Returns the full detail record for a single monitor.
   */
  async getMonitor(
    monitorId: string,
    options?: { tenant?: string; token?: string }
  ): Promise<MonitorDetailResponse> {
    const qs = buildQuery({
      tenant: options?.tenant ?? this.defaultTenant,
      token: options?.token,
    });
    return this.get<MonitorDetailResponse>(
      `/network-coverage/monitors/${encodeURIComponent(monitorId)}${qs}`
    );
  }

  /**
   * GET /network-coverage/countries/:countryId/monitors
   *
   * Returns all monitors for a specific country identified by its slug
   * (e.g. "uganda", "ghana", "cote-divoire").
   */
  async getCountryMonitors(
    countryId: string,
    params: Omit<ListParams, "search"> = {}
  ): Promise<CountryMonitorsResponse> {
    const { activeOnly, types, tenant, token } = params;
    const qs = buildQuery({
      tenant: tenant ?? this.defaultTenant,
      token,
      activeOnly: activeOnly !== undefined ? String(activeOnly) : undefined,
      types: typesParam(types),
    });
    return this.get<CountryMonitorsResponse>(
      `/network-coverage/countries/${encodeURIComponent(countryId)}/monitors${qs}`
    );
  }

  /**
   * GET /network-coverage/export.csv
   *
   * Returns the raw CSV string (UTF-8 with BOM).
   * The caller is responsible for writing it to a file or streaming it.
   *
   * @example
   * const csv = await client.exportCsv();
   * fs.writeFileSync("monitors.csv", csv);
   */
  async exportCsv(params: ExportCsvParams = {}): Promise<string> {
    const { countryId, search, activeOnly, types, tenant, token } = params;
    const qs = buildQuery({
      tenant: tenant ?? this.defaultTenant,
      token,
      countryId,
      search,
      activeOnly: activeOnly !== undefined ? String(activeOnly) : undefined,
      types: typesParam(types),
    });
    return this.getRaw(`/network-coverage/export.csv${qs}`);
  }

  /**
   * POST /network-coverage/registry
   *
   * Creates or updates a registry entry.
   *
   * Shape A — AirQo-site enrichment: provide `site_id`.
   * Shape B — Standalone external entry: omit `site_id`, provide `name`,
   *   `country`, `latitude`, and `longitude`.
   *
   * Returns 201 on creation, 200 on update.
   */
  async upsertRegistry(
    payload: RegistryUpsertPayload,
    options?: { tenant?: string; token?: string }
  ): Promise<RegistryUpsertResponse> {
    assertRegistryPayload(payload);
    const qs = buildQuery({
      tenant: options?.tenant ?? this.defaultTenant,
      token: options?.token ?? this.token,
    });
    return this.post<RegistryUpsertResponse>(
      `/network-coverage/registry${qs}`,
      payload as unknown as Record<string, unknown>
    );
  }

  /**
   * DELETE /network-coverage/registry/:registryId
   *
   * Removes a registry entry by its document `_id`.
   */
  async deleteRegistry(
    registryId: string,
    options?: { tenant?: string; token?: string }
  ): Promise<{ success: boolean; message: string }> {
    const qs = buildQuery({
      tenant: options?.tenant ?? this.defaultTenant,
      token: options?.token ?? this.token,
    });
    return this.delete<{ success: boolean; message: string }>(
      `/network-coverage/registry/${encodeURIComponent(registryId)}${qs}`
    );
  }
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class NetworkCoverageError extends Error {
  public readonly statusCode: number;
  public readonly body?: unknown;

  constructor(message: string, statusCode: number, body?: unknown) {
    super(message);
    this.name = "NetworkCoverageError";
    this.statusCode = statusCode;
    this.body = body;
  }
}
