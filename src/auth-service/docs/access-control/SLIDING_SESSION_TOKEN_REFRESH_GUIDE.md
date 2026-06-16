# Sliding Session & Token Refresh Guide

**Version:** 2.0 — Last updated: 2026-06-17

## Who this is for

Developers working on any AirQo client that makes authenticated API calls:

| App | Stack | HTTP layer |
|---|---|---|
| `airqo-frontend/src/mobile` | Flutter | `http` package + `BaseRepository` |
| `airqo-frontend/src/platform` | Next.js (TypeScript) | `ApiClient` (Axios) |
| `airqo-frontend/src/vertex` | Next.js (TypeScript) | Axios (`createAxiosInstance`) |
| `airqo-frontend/src/beacon` | Next.js (JavaScript) | native `fetch` |

---

## How the backend keeps sessions alive

The backend (`enhancedJWTAuth` middleware) implements a **three-window model**.
Every authenticated request passes through all three checks in order:

```
Client sends JWT
  │
  ├─ 1. Signature invalid?
  │      → 401 "Invalid token: ..."
  │
  ├─ 2. exp + GRACE_PERIOD < now?
  │      → 401 "Your session has expired. Please log in again."
  │
  ├─ 3. exp < now + REFRESH_WINDOW?   ← token is valid but nearing expiry
  │      → issue replacement token silently
  │        set response header:  X-Access-Token: JWT eyJ...
  │        set response header:  Access-Control-Expose-Headers: X-Access-Token
  │        request still succeeds with original token
  │
  └─ Proceed with request normally
```

### Timing configuration

All values are env vars with these production defaults:

| Env var | Default | Effect |
|---|---|---|
| `JWT_EXPIRES_IN_SECONDS` | **86 400** (24 h) | Lifetime of every issued JWT |
| `JWT_REFRESH_WINDOW_SECONDS` | **900** (15 min) | Backend issues a new token on any response when the existing one expires within this window |
| `JWT_GRACE_PERIOD_SECONDS` | **300** (5 min) | Expired tokens are still accepted for this long after `exp` |
| `JWT_REFRESH_MAX_AGE_SECONDS` | **31 536 000** (1 yr) | Hard ceiling — no token survives longer than this regardless of activity |

> **What this means in practice:** a user who opens the app at least once every
> 24 h will never be logged out — each visit extends the session by another 24 h
> via the `X-Access-Token` sliding window. The 1-year ceiling prevents truly
> stale sessions from surviving forever.

---

## Two mechanisms, one goal

The backend provides two independent paths for clients to stay authenticated.
Both should be implemented; each covers a different failure mode.

### Mechanism 1 — Sliding session header (server-push)

On any **successful (2xx) response** where the token is within the 15-minute
refresh window, the backend sets `X-Access-Token` in the response headers.
The client must read this header and replace its stored token immediately.

This is the primary keep-alive path for active users. It requires zero extra
network calls.

**API contract:**
```
Response header (when token is nearing expiry):
  X-Access-Token: JWT eyJ...
  Access-Control-Expose-Headers: X-Access-Token
```

The new token value already includes the `JWT ` scheme prefix. Strip it before
storage; re-add it when constructing `Authorization` headers.

### Mechanism 2 — Explicit refresh endpoint (client-pull)

For cases where the client detects a locally expired token **before** making a
request (e.g. on app resume after a long idle period), there is a dedicated
refresh endpoint.

**Request:**
```
POST /api/v2/users/token/refresh
Authorization: JWT <expired-or-expiring-token>
Content-Type: application/json
```

**Success response (200):**
```json
{
  "success": true,
  "token": "eyJ...",
  "expiresIn": 86400
}
```

**Failure response (401 or 4xx):** the token is beyond the grace period and
cannot be recovered. The client must log the user out.

> Always use `Authorization: JWT <token>` — not `Authorization: Bearer <token>`.
> The auth-service only recognises the `JWT` scheme.

---

## The logout failure chain

When a user is unexpectedly logged out, the failure is almost always one step
in this chain. Use this as a diagnostic checklist:

```
1. Client checks local token before request
       │
       ├─ Token not expired locally → skip to step 3
       └─ Token expired locally → call POST /api/v2/users/token/refresh
                                        │
                                        ├─ 200 → store new token → proceed
                                        └─ non-200 → fall back to stored token
                                                            │
2. Request is made with stored (expired) token
       │
3. Server checks token
       │
       ├─ exp + grace_period > now → server issues X-Access-Token silently → 200
       └─ exp + grace_period < now → 401 "Your session has expired"
                                            │
4. Client handles 401
       │
       ├─ Retry with refreshed token (if not already retried) → back to step 3
       └─ No retry / refresh failed → trigger logout
```

The most common cause of unexpected logouts is the **client not reading and
storing `X-Access-Token`** on 2xx responses. If the sliding session update is
missed, the stored token is never extended and expires normally after 24 h.

---

## Per-app implementation status and what to do

### Mobile — `airqo-frontend/src/mobile`

**Status: both mechanisms implemented.**

| Component | File | What it does |
|---|---|---|
| `AuthTokenStorage.saveTokenFromHeaders()` | `auth/services/auth_token_storage.dart` | Reads `x-access-token` on every 2xx response (Mechanism 1) |
| `AuthHelper.refreshTokenIfNeeded()` / `_doRefresh()` | `auth/services/auth_helper.dart` | Calls `/api/v2/users/token/refresh` if local token is expired (Mechanism 2); serialises concurrent refresh calls |
| `BaseRepository._getToken()` | `shared/repository/base_repository.dart` | Calls `refreshTokenIfNeeded()` before every request; falls back to stored token if refresh fails |
| `BaseRepository._handleTokenRefresh()` | same | Calls `saveTokenFromHeaders()` on every 2xx |
| `BaseRepository._isSessionRelated401()` | same | Distinguishes JWT 401s from API-key 401s before triggering logout |
| `GlobalAuthManager.notifySessionExpired()` | `shared/repository/global_auth_manager.dart` | Fires `SessionExpired` event at most once per session; subsequent concurrent 401s are deduplicated |

**If users are still being logged out:** the failure is almost certainly in
`AuthHelper._doRefresh()`. Check whether `POST /api/v2/users/token/refresh`
is returning 200 for your environment. If it returns non-200, the fallback
path uses the stored expired token → 401 → logout.

---

### Platform — `airqo-frontend/src/platform`

**Status: Mechanism 2 implemented. Mechanism 1 (X-Access-Token) not read.**

The `ApiClient` class in `shared/services/apiClient.ts` has:

- **Request interceptor:** if the token expires within 2 minutes (`JWT_REFRESH_SKEW_MS = 120 000`), it calls `_refreshAuthToken()` → `POST /api/v2/users/token/refresh` before the request goes out.
- **Response interceptor (401):** on a 401, retries the original request once with a freshly refreshed token (`_retry` guard prevents loops). Falls back to dispatching `auth:unauthorized` on the window if the retry also fails.
- **Concurrent refresh queue:** a `_pendingQueue` ensures that multiple simultaneous requests all wait for one shared refresh instead of issuing duplicates.
- **Custom events:** dispatches `auth:token-refreshed` (token updated) and `auth:unauthorized` (session terminated) on `window` — listen for these at the app root to drive UI state (e.g. redirect to login).

**Missing: `X-Access-Token` is not read from 2xx responses.** The response
interceptor handles performance tracking and error logging but does not call
`saveTokenFromHeaders` or equivalent. Add reading of `response.headers['x-access-token']`
in the success branch of the response interceptor to enable Mechanism 1.

**Token format note:** tokens are normalised through `normalizeOAuthAccessToken()`
before use. The `Authorization` header is always constructed as `JWT ${token}`.

---

### Vertex — `airqo-frontend/src/vertex`

**Status: neither mechanism fully implemented.**

The `createAxiosInstance()` in `core/apis/axiosConfig.ts` has:

- **Request interceptor:** reads `session.accessToken` from NextAuth and sets
  `config.headers['Authorization'] = token`. The token value from NextAuth
  may already include `JWT ` as a prefix — verify that the final header is
  `Authorization: JWT eyJ...` and not `Authorization: JWT JWT eyJ...`.
- **Response interceptor:** detects `x-access-token` in the response and logs
  a warning: *"Received a refreshed auth token, but client-side update is not
  implemented. The new token will be ignored."* — this is a known stub.
- **On 401:** calls `clearSessionData()` and redirects to `/login?session_expired=true`.
  There is no refresh attempt before logging out.

**What needs to be added:**
1. In the response interceptor success branch, store the `x-access-token` value
   (Mechanism 1) — replacing the logged warning with actual storage.
2. On 401, attempt `POST /api/v2/users/token/refresh` once before triggering
   logout (Mechanism 2). Only redirect if the refresh also fails.

---

### Beacon — `airqo-frontend/src/beacon`

**Status: no session refresh mechanism.**

Beacon uses native `fetch` calls in `lib/api.js` with `authService.getToken()`
for the token. There is no interceptor layer, no `X-Access-Token` handling, and
no explicit refresh call. Most internal routes are proxied through Next.js API
routes (`/api/devices/...`), which may handle auth server-side.

**What needs to be added depends on architecture:**
- If Beacon proxies all AirQo API calls through its own Next.js API routes,
  token refresh should be handled server-side in those route handlers, reading
  `X-Access-Token` from the upstream AirQo API response and forwarding it to
  the browser client.
- If Beacon makes direct browser-to-API calls, a centralised fetch wrapper
  (analogous to `BaseRepository` on mobile or `ApiClient` on platform) is
  needed, implementing both mechanisms.

---

## Quick reference

### Authorization header format

```
Authorization: JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Never use `Bearer`. The auth-service only accepts the `JWT` scheme.

### Sliding session — what to read on every 2xx response

```
X-Access-Token: JWT eyJ...
```

Strip the `JWT ` prefix before storing; prepend it again when constructing
the `Authorization` header.

### Explicit refresh endpoint

```
POST /api/v2/users/token/refresh
Authorization: JWT <current-or-expired-token>

→ 200: { "success": true, "token": "eyJ...", "expiresIn": 86400 }
→ 401: session cannot be recovered — log the user out
```

### On 401 from a non-refresh endpoint

1. Was this a first attempt? → call `POST /api/v2/users/token/refresh`, then retry.
2. Was this already a retry, or did the refresh also 401? → log the user out.

Do not redirect to login on every 401 without attempting a refresh first —
that is the primary cause of users being logged out prematurely.
