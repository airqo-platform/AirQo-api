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
// NetworkCoverageClient
// ---------------------------------------------------------------------------

export class NetworkCoverageClient {
  private readonly baseUrl: string;
  private readonly defaultTenant: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: NetworkCoverageClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultTenant = options.defaultTenant ?? DEFAULT_TENANT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.extraHeaders = options.headers ?? {};
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
    const { search, activeOnly, types, tenant } = params;
    const qs = buildQuery({
      tenant: tenant ?? this.defaultTenant,
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
    tenant?: string
  ): Promise<MonitorDetailResponse> {
    const qs = buildQuery({ tenant: tenant ?? this.defaultTenant });
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
    const { activeOnly, types, tenant } = params;
    const qs = buildQuery({
      tenant: tenant ?? this.defaultTenant,
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
    const { countryId, search, activeOnly, types, tenant } = params;
    const qs = buildQuery({
      tenant: tenant ?? this.defaultTenant,
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
    payload: RegistryUpsertPayload
  ): Promise<RegistryUpsertResponse> {
    const { tenant, ...body } = payload;
    const qs = buildQuery({ tenant: tenant ?? this.defaultTenant });
    return this.post<RegistryUpsertResponse>(
      `/network-coverage/registry${qs}`,
      body as Record<string, unknown>
    );
  }

  /**
   * DELETE /network-coverage/registry/:registryId
   *
   * Removes a registry entry by its document `_id`.
   */
  async deleteRegistry(
    registryId: string,
    tenant?: string
  ): Promise<{ success: boolean; message: string }> {
    const qs = buildQuery({ tenant: tenant ?? this.defaultTenant });
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
