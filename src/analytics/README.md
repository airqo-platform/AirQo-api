# AirQo Analytics API

FastAPI service for AirQo air-quality analytics: data download and export,
dashboard aggregations, grid reports and scheduled exports. Backed by
BigQuery (measurements), MongoDB (scheduled exports) and Redis
(rate limiting).

Authentication is handled upstream by auth-service; this service never
sees credentials.

## Quick start

Requires **Python 3.10** (CI and the container images pin it), plus Redis for
rate limiting and Google credentials for BigQuery.

```bash
cd src/analytics
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 5000
```

- API base: `http://localhost:5000`
- Liveness: `GET /health` · Readiness: `GET /health/ready`
- Docs: `/docs`, `/redoc`, `/openapi.json` — **enabled outside production
  only**. Set `EXPOSE_API_DOCS=true` to publish them in production.

`/health/ready` returns **503** when Redis is unreachable. That is expected
without a local Redis, and is what the Kubernetes readiness probe keys on.

### Runtime dependencies

| Service         | Used for                             | Required to boot?            |
| --------------- | ------------------------------------ | ---------------------------- |
| BigQuery        | All measurement queries              | No — fails per request       |
| Redis           | Rate limiting, and the Celery broker | No, but see below            |
| MongoDB         | Scheduled exports                    | No — fails per request       |
| device-registry | Privacy filtering on download/export | No — those routes return 503 |

Redis is the one worth understanding. While it is unreachable the API keeps
serving: rate limiting falls back to **per-process counters** and logs a
warning once a minute. Limits stay enforced but become approximate — roughly
`workers × replicas ×` the configured value — and reset on restart.
`/health/ready` still reports 503, so a pod is pulled from the load balancer
until Redis returns.

Redis is also the Celery broker (`redis://{REDIS_SERVER}:{REDIS_PORT}/0`),
and that has no fallback — scheduled exports stop until it is back.
Pagination is unaffected: cursors are stateless, signed tokens that need no
server-side storage.

Locally:

```bash
docker run -d -p 6379:6379 redis:7.2
export REDIS_SERVER=localhost REDIS_PORT=6379
```

When deployed, point `REDIS_SERVER` at a Redis that every replica shares —
rate-limit counters and the Celery queue are only correct if all pods use
the same instance.

### Python dependencies

Python **3.10**, pinned by CI and the container images. Dependencies are in
[`requirements.txt`](requirements.txt); most are floor-pinned (`>=`) or
unpinned, so builds are not reproducible — pin exactly, or add a lockfile, if
you need that guarantee.

The load-bearing ones: `fastapi` + `pydantic` v2 (routing and validation),
`google-cloud-bigquery[pandas]` (synchronous SDK — every query is pushed to a
worker thread), `pymongo` 4.x (also synchronous), `celery` with a Redis
broker, and `aioredis` for the async cache client.

### Background workers

The API does not run scheduled exports; a Celery worker does, driven by a
beat scheduler that polls MongoDB.

```bash
celery -A celery_app.celery worker -Q analytics --loglevel=info
celery -A celery_app.celery beat
python devices_summary.py      # one-shot devices-summary job
```

**CI currently builds and deploys only the API image.** The worker, beat and
devices-summary builds are commented out in the deploy workflows and neither
chart runs them, so scheduled exports do not execute in deployed
environments — the commands above are for running the workers locally.

## Configuration

Every setting is declared in [`config.py`](config.py) (pydantic-settings)
with its env var name and default — that file is the reference. Values are
read from `.env` or the environment.

**Unknown variables are silently ignored** (`extra="ignore"`), so the shared
`.env` can carry other services' values. The cost is that a misspelled name
does nothing rather than erroring — check `config.py` if a setting seems not
to apply.

### Settings that will bite you

These either stop the service or change behaviour in ways that are hard to
diagnose from the symptom. The rest have sane defaults.

| Variable                    | Default                | What goes wrong                                                                                                                                                         |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SECRET_KEY`                | —                      | **The app will not start** outside development. It signs pagination cursors, so a predictable value would let callers forge them.                                       |
| `APP_ENV`                   | `production`           | Selects the Mongo URI and gates the API docs. A typo silently points you at the wrong database. `FLASK_ENV` is still accepted as a fallback.                            |
| `BIGQUERY_MAX_BYTES_BILLED` | 1 GiB                  | Deliberately tight. Legitimate large queries are **rejected by BigQuery**, logged as `bigquery cost limit exceeded`. Raise it once the logs show the real distribution. |
| `MAX_QUERY_DAYS`            | `365`                  | Requests with a wider window are rejected with 422.                                                                                                                     |
| `MAX_FILTER_VALUES`         | `1000`                 | Requests with more sites/devices are rejected with 422.                                                                                                                 |
| `TRUSTED_PROXIES`           | RFC1918                | `X-Forwarded-For` is honoured only from these peers. Set it empty and every caller shares one rate-limit bucket, because the peer is always the ingress pod.            |
| `REQUIRE_GATEWAY_IDENTITY`  | `false`                | **Leave off.** Turning it on today is an auth bypass — see [Identity](#identity-not-yet-active).                                                                        |
| `EXPOSE_API_DOCS`           | unset                  | `/docs`, `/redoc` and `/openapi.json` return 404 in production unless this is `true`.                                                                                   |
| `DATA_EXPORT_LOCATION`      | `EU`                   | Must match the BigQuery dataset's region, or export jobs fail.                                                                                                          |
| `AIRQO_API_TIMEOUT`         | `10.0`                 | Without a timeout urllib3 waits forever and parks a shared worker thread.                                                                                               |
| `CACHE_KEY_PREFIX`          | `Analytics-production` | Namespaces Redis keys. Two environments sharing a Redis without distinct prefixes will share rate-limit counters.                                                       |

## API endpoints

### v2 — `/api/v2/analytics` (internal)

| Method             | Path                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| POST               | `/data-download`, `/raw-data`                                                          |
| POST               | `/data/summary`                                                                        |
| POST               | `/dashboard/chart/data`, `/dashboard/chart/d3/data`                                    |
| GET                | `/dashboard/sites`                                                                     |
| POST               | `/dashboard/historical/daily-averages`, `/dashboard/historical/daily-averages-devices` |
| POST               | `/dashboard/exceedances`, `/dashboard/exceedances-devices`                             |
| POST / GET / PATCH | `/data-export` (scheduled exports)                                                     |

### v3 — `/api/v3/public/analytics`

`POST /data-download`, `POST /raw-data`, `POST /forecast-data`. Each carries a
stricter per-route limit (10/min) on top of the global 100/min middleware.

### Conventions

- Request bodies are camelCase (`startDateTime`), though several filter
  fields are snake_case (`device_ids`). The OpenAPI schema is authoritative.
- Exactly one filter per request: `sites`, `device_ids`, `device_names` or
  `grid_ids`. `grid_ids` is currently capped at one grid.
- `?network=` replaced the deprecated `?tenant=`.
- The `airqlouds` filter has been removed in favour of grids.

## Testing

```bash
python -m pytest tests/          # 399 tests
python -m pytest tests/test_health.py
python -m pytest -k cursor
```

The `python -m` prefix matters: `tests/` has no `__init__.py` and relies on
the working directory being on `sys.path`.

The suite is hermetic — BigQuery, GCS, Redis, MongoDB and the device-registry
privacy helper are all intercepted in [`tests/conftest.py`](tests/conftest.py),
so it needs no cloud credentials and makes no network calls. Autouse fixtures
make that the default, so new tests are isolated without opting in.

## Project layout

```
src/analytics/
├── api/
│   ├── dependencies.py     # shared FastAPI dependencies (identity)
│   ├── middlewares/        # rate limiting
│   ├── models/             # BigQuery + MongoDB data layer
│   ├── routers/            # v2.py, v3.py
│   ├── schemas/            # Pydantic requests/responses
│   ├── services/           # business logic
│   └── utils/              # cache, cursors, cleaning, BigQuery job config
├── schemas/files/          # BigQuery table schemas (shipped in the image)
├── tests/
├── celery_app.py           # scheduled-export worker + beat
├── config.py               # pydantic-settings
├── devices_summary.py      # devices-summary job
└── main.py                 # FastAPI app
```

To add an endpoint: define a Pydantic request model (inherit
`BaseFilterRequest` for data queries), add a service method that raises
`HTTPException` on failure, then a thin route handler. Routers contain no
try/except — global handlers in `main.py` render every error into the same
envelope. Mongo-backed features build on `FastAPIPyMongoModel` and are called
through `asyncio.to_thread`, since pymongo is synchronous.

## Deployment

Images come from the multi-stage [`Dockerfile`](Dockerfile):

| Target                   | Runs                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| `dev`                    | uvicorn with `--reload`                                          |
| `staging` / `production` | gunicorn + uvicorn workers on port 5000                          |
| `celery-beat`            | `celery -A celery_app.celery beat`                               |
| `celery-worker`          | `celery ... worker -Q analytics`                                 |
| `devices-summary-job`    | `python devices_summary.py`                                      |
| `redis`                  | local Redis image (not deployed; production uses a shared Redis) |

Only the `staging` / `production` API targets are built by CI at the moment;
the rest exist for local use until their workloads return.

```bash
docker build --target production -t airqo-analytics-api .
docker run -p 5000:5000 -e SECRET_KEY=... airqo-analytics-api
```

The container listens on **5000**, matching the Service `targetPort` in the
GKE chart (`k8s/analytics`) and the AKS chart
(`k8s/analytics/k8s-aks/analytics`). Worker count comes from
`WEB_CONCURRENCY` (default 2) — keep it in step with the pod CPU limit.

### Before deploying

- Set `SECRET_KEY` in the environment's configmap/secret, or the pods will
  not start.
- Set `CORS_ALLOWED_ORIGINS` and `ALLOWED_HOSTS` rather than leaving them `*`.

### Identity (not yet active)

[`api/dependencies.py`](api/dependencies.py) can take the acting user from a
gateway-asserted header instead of the client-supplied `?userId=`, closing an
insecure direct object reference(IDOR) on the scheduled-export endpoints. It is **inert today**: NGINX
propagates no identity to this service, so the code falls back to `?userId=`
and behaves exactly as before.

Do not set `REQUIRE_GATEWAY_IDENTITY=true` until all three hold, or a caller
can simply send the header themselves:

1. auth-service returns the user id as a **response header** on its
   `auth_request` endpoints — NGINX cannot read the JSON body.
2. NGINX overwrites any client-supplied identity header on every route
   reaching this API. Match routes on the upstream **service**
   (`airqo-analytics-api-svc`), not the upstream name: in `analytics-vs` and
   `platform-vs` the upstream named `analytics` is the frontend, while in
   `api-vs`, `beacon-vs`, `netmanager-vs` and `vertex-vs` it is this API.
3. The pods are not reachable around the ingress.

## Contributing

Run `pre-commit install` once — the repo runs `black`, `detect-private-key`,
and end-of-file/trailing-whitespace fixes on commit.

1. Match the surrounding style; keep type hints on new code.
2. Add tests, and keep them hermetic (no network, no credentials).
3. Update this README when configuration or endpoints change.
4. Run `python -m pytest tests/` before submitting.

## License

MIT — see [LICENSE](../../LICENSE) at the repository root.
