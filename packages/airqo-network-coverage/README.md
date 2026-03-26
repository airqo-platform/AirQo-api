# @airqo-packages/network-coverage

Node.js client for the **AirQo Network Coverage API** — typed wrappers for all monitor and registry endpoints that power the _"Where We Monitor"_ map.

Requires **Node.js ≥ 18** (uses native `fetch`). No runtime dependencies.

---

## Installation

```bash
npm install @airqo-packages/network-coverage
```

> **Migrating from an earlier version?** Replace `@airqo/network-coverage` with `@airqo-packages/network-coverage` in your `package.json` and all import statements.

---

## Authentication

To call protected endpoints (registry write operations), you need an AirQo access token.

1. Create an account at [analytics.airqo.net](https://analytics.airqo.net/user/login)
2. Go to **Account Settings → API tab → Register a client**
3. Generate an access token from the registered client
4. Pass the token to the client constructor — it will be appended as `?token=` on every request automatically

```ts
const client = new NetworkCoverageClient({
  token: "YOUR_ACCESS_TOKEN",
});
```

> **Public endpoints** (`list`, `getMonitor`, `getCountryMonitors`, `exportCsv`) do not require a token. Only `upsertRegistry` and `deleteRegistry` require authentication.

---

## Quick start

```ts
import { NetworkCoverageClient } from "@airqo-packages/network-coverage";

const client = new NetworkCoverageClient({
  baseUrl: "https://api.airqo.net/api/v2/devices",
  defaultTenant: "airqo",
});

// List all monitors grouped by country
const data = await client.list();
console.log(data.meta);      // { total, active, inactive, countries }
console.log(data.countries); // CountrySummary[]
console.log(data.monitors);  // MonitorListItem[]
```

---

## Configuration

```ts
const client = new NetworkCoverageClient({
  /** Base API URL — no trailing slash (default: AirQo production) */
  baseUrl: "https://api.airqo.net/api/v2/devices",

  /** Default tenant for all requests (default: "airqo") */
  defaultTenant: "airqo",

  /** Request timeout in ms (default: 30 000) */
  timeoutMs: 15_000,

  /** AirQo access token — appended as ?token= on every request */
  token: "YOUR_ACCESS_TOKEN",

  /** Additional headers sent with every request */
  headers: {
    "X-Custom-Header": "value",
  },
});
```

---

## API

### `client.list(params?)`

Returns all monitors and per-country aggregates.

```ts
const result = await client.list({
  search: "kampala",         // partial name / city / country match
  activeOnly: true,          // only active monitors
  types: ["Reference", "LCS"], // filter by type
});
```

**Returns:** `NetworkCoverageListResponse`

```ts
{
  success: true,
  message: "...",
  meta: { total: 120, active: 98, inactive: 22, countries: 11 },
  countries: [
    { countryId: "uganda", country: "Uganda", iso2: "UG", total: 45, active: 40, inactive: 5 },
    // ...
  ],
  monitors: [ /* MonitorListItem[] */ ],
}
```

---

### `client.getMonitor(monitorId, options?)`

Fetches a single monitor by its `_id`.

```ts
const result = await client.getMonitor("64a1f2b3c4d5e6f7a8b9c0d1");
// or with overrides:
const result = await client.getMonitor("64a1f2b3c4d5e6f7a8b9c0d1", { tenant: "airqo", token: "YOUR_TOKEN" });
console.log(result.data); // MonitorListItem
```

---

### `client.getCountryMonitors(countryId, params?)`

Returns all monitors for a country identified by its URL slug.

```ts
const result = await client.getCountryMonitors("cote-divoire", {
  activeOnly: true,
});
console.log(result.monitors); // MonitorListItem[]
```

Country slugs are lowercase, accent-normalised, and hyphenated:

| Country | Slug |
|---|---|
| Uganda | `uganda` |
| Ghana | `ghana` |
| Côte d'Ivoire | `cote-divoire` |
| South Africa | `south-africa` |

---

### `client.exportCsv(params?)`

Returns the raw CSV string (UTF-8 with BOM). Write it to a file or stream it.

```ts
import fs from "fs";

const csv = await client.exportCsv({ countryId: "kenya", activeOnly: true });
fs.writeFileSync("kenya-monitors.csv", csv);
```

---

### `client.upsertRegistry(payload)`

Creates or updates a registry entry. Returns **201** for new records, **200** for updates.

**Shape A — AirQo-site enrichment** (provide `site_id`):

```ts
await client.upsertRegistry({
  site_id: "64a1f2b3c4d5e6f7a8b9c0d1",
  equipment: "AirQo Binos",
  calibrationMethod: "Colocation",
  uptime30d: "96%",
  publicData: "Yes",
});
```

**Shape B — Standalone external entry** (omit `site_id`):

```ts
await client.upsertRegistry({
  name: "Makerere KCCA Station",
  country: "Uganda",
  city: "Kampala",
  latitude: 0.3476,
  longitude: 32.5825,
  type: "Reference",
  network: "KCCA",
  operator: "Kampala Capital City Authority",
  pollutants: ["PM2.5", "PM10", "NO2"],
});
```

---

### `client.deleteRegistry(registryId, options?)`

Removes a registry entry by document `_id`. Requires a valid access token.

```ts
await client.deleteRegistry("64a1f2b3c4d5e6f7a8b9c0d1");
// or with overrides:
await client.deleteRegistry("64a1f2b3c4d5e6f7a8b9c0d1", { tenant: "airqo", token: "YOUR_TOKEN" });
```

---

## Error handling

All methods throw `NetworkCoverageError` on non-2xx responses or timeouts.

```ts
import { NetworkCoverageClient, NetworkCoverageError } from "@airqo-packages/network-coverage";

try {
  await client.getMonitor("nonexistent-id");
} catch (err) {
  if (err instanceof NetworkCoverageError) {
    console.error(err.message);    // API error message
    console.error(err.statusCode); // HTTP status code (e.g. 404)
    console.error(err.body);       // Raw response body
  }
}
```

| Status | Meaning |
|--------|---------|
| 400 | Validation error — check your payload |
| 404 | Monitor or registry entry not found |
| 409 | Duplicate registry entry for a site |
| 408 | Request timed out (client-side) |
| 500 | Internal server error |

---

## TypeScript types

All types are exported from the package root:

```ts
import type {
  MonitorListItem,
  CountrySummary,
  NetworkCoverageMeta,
  NetworkCoverageListResponse,
  MonitorDetailResponse,
  CountryMonitorsResponse,
  RegistryUpsertPayload,
  RegistryUpsertResponse,
  MonitorType,
  MonitorStatus,
  MonitorSource,
  ListParams,
  ExportCsvParams,
  NetworkCoverageClientOptions,
} from "@airqo-packages/network-coverage";
```

---

## License

MIT
