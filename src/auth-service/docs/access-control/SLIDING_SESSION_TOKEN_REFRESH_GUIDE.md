# Session Management & Token Refresh

**Version:** 3.0 — Last updated: 2026-06-17

## Who this is for

Developers building applications that authenticate users against the AirQo API
using JWTs — whether a mobile app, a web dashboard, or a server-side integration.

---

## How sessions work

When a user logs in to AirQo, they receive a JWT that is valid for **24 hours**.
The API is designed so that active users never have to log in again, even across
multiple days — as long as your application correctly handles token renewal.

The session lifetime is governed by three windows:

| Window | Duration | What happens |
|---|---|---|
| **Token lifetime** | 24 hours | The JWT is valid for this long after issue |
| **Refresh window** | Last 15 minutes of the token's life | The API silently issues a replacement token on any successful response |
| **Grace period** | 5 minutes after expiry | Requests with an expired token are still accepted; no new token is issued |
| **Hard ceiling** | 1 year of activity | No session survives longer than this regardless of renewal activity |

**In practice:** a user who makes at least one API call every 24 hours will never
be logged out. Each call within the refresh window extends the session by another
24 hours automatically.

---

## Two ways tokens are renewed

The API provides two independent renewal paths. Implementing both gives your
application the smoothest possible session experience.

### 1. Sliding session — automatic renewal on every response

Whenever an authenticated request is made while the token is within its final
15-minute window, the API includes a fresh token in the response:

```
Response header:
  X-Access-Token: JWT eyJ...
  Access-Control-Expose-Headers: X-Access-Token
```

Your application must read this header on every successful (2xx) response and
replace the stored token immediately. This costs zero extra network calls.

The value already includes the `JWT ` prefix. Strip it before storage and
re-add it when building your `Authorization` header.

### 2. Explicit refresh — on-demand renewal before a request

When your application detects that the stored token has already expired (e.g.
the user re-opens the app after an overnight idle period), call the refresh
endpoint **before** making the actual request:

```
POST https://api.airqo.net/api/v2/users/token/refresh
Authorization: JWT <expired-or-expiring-token>
Content-Type: application/json
```

**Success (200):**
```json
{
  "success": true,
  "token": "eyJ...",
  "expiresIn": 86400
}
```

Store the new token and use it for the request you were about to make.

**Failure (401):** the token is too old to be renewed. The user must log in again.

> Always send `Authorization: JWT <token>`. Using `Bearer` instead of `JWT`
> will result in a 401 on every request.

---

## What to implement

### On every successful (2xx) API response

Check for the `X-Access-Token` header. If present, save the new token and use
it for all subsequent requests.

**Flutter:**
```dart
if (response.statusCode >= 200 && response.statusCode < 300) {
  final newToken = response.headers['x-access-token'];
  if (newToken != null && newToken.isNotEmpty) {
    await storage.write(key: 'auth_token', value: stripJwtPrefix(newToken));
  }
}
```

**JavaScript / TypeScript:**
```js
// Axios response interceptor
const newToken = response.headers['x-access-token'];        // Axios: plain object
if (newToken) {
  const clean = newToken.replace(/^JWT\s+/i, '').trim();
  localStorage.setItem('authToken', clean);
  apiClient.defaults.headers.common['Authorization'] = `JWT ${clean}`;
}

// Native fetch (response.headers is a Headers object — use .get())
const newToken = response.headers.get('x-access-token');    // fetch: Headers API
if (newToken) {
  const clean = newToken.replace(/^JWT\s+/i, '').trim();
  localStorage.setItem('authToken', clean);
}
```

### Before making a request when the stored token is expired

Check the token expiry locally. If expired, call the refresh endpoint first.

**Flutter:**
```dart
Future<String?> getValidToken() async {
  final token = await storage.read(key: 'auth_token');
  if (token == null) return null;

  if (JwtDecoder.isExpired(token)) {
    final refreshed = await refreshToken(token);
    return refreshed; // null if refresh failed — let the 401 handle it
  }

  return token;
}

Future<String?> refreshToken(String expiredToken) async {
  final response = await http.post(
    Uri.parse('https://api.airqo.net/api/v2/users/token/refresh'),
    headers: {
      'Authorization': 'JWT $expiredToken',
      'Content-Type': 'application/json',
    },
  );

  if (response.statusCode == 200) {
    final body = json.decode(response.body);
    final newToken = body['token'] as String;
    await storage.write(key: 'auth_token', value: newToken);
    return newToken;
  }

  return null; // Token too old — user must log in again
}
```

**JavaScript / TypeScript:**
```js
async function getValidToken() {
  const token = localStorage.getItem('authToken');
  if (!token) return null;

  // JWT payloads are base64url-encoded — normalise before decoding
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(base64Url.length / 4) * 4, '='
  );
  const payload = JSON.parse(atob(base64));
  const isExpired = payload.exp * 1000 < Date.now();

  if (isExpired) {
    return await refreshToken(token);
  }

  return token;
}

async function refreshToken(expiredToken) {
  try {
    const response = await fetch(
      'https://api.airqo.net/api/v2/users/token/refresh',
      {
        method: 'POST',
        headers: {
          'Authorization': `JWT ${expiredToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const body = await response.json();
      const newToken = body.token;
      localStorage.setItem('authToken', newToken);
      return newToken;
    }
  } catch (_) {}

  return null; // Token too old — user must log in again
}
```

### On 401 Unauthorized

A 401 from a non-refresh endpoint means the token was rejected. Before logging
the user out, try refreshing once:

```js
// In your error handler / interceptor
if (response.status === 401 && !request._alreadyRetried) {
  request._alreadyRetried = true;
  const newToken = await refreshToken(getCurrentToken());
  if (newToken) {
    request.headers['Authorization'] = `JWT ${newToken}`;
    return retryRequest(request); // retry original call
  }
}

// Refresh failed or already retried — log out
clearSession();
redirectToLogin();
```

---

## Why users get logged out unexpectedly

Unexpected logouts follow one predictable chain. Use this to identify where
your implementation is breaking:

```
1. App opens — stored token is checked
   │
   ├─ Not expired → proceed
   └─ Expired → call POST /api/v2/users/token/refresh
                    │
                    ├─ 200 → store new token → proceed
                    └─ non-200 → use expired token anyway (fallback)
                                     │
2. Request sent with expired token
   │
3. Server checks the token
   │
   ├─ Within 5-minute grace period → succeeds, may issue X-Access-Token
   └─ Beyond grace period → 401 "Your session has expired"
                                 │
4. Client handles the 401
   │
   ├─ Tries refresh → retries original request → succeeds
   └─ No retry / refresh also fails → logout
```

**The most common cause** is not reading the `X-Access-Token` header on
successful responses. If this header is ignored, the stored token is never
extended and expires normally after 24 hours, logging out every user who has
been active for more than a day without triggering a proactive refresh.

---

## Quick reference

### Authorization header

```
Authorization: JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Use `JWT`, not `Bearer`.

### Sliding session header (read on every 2xx response)

```
X-Access-Token: JWT eyJ...
```

### Refresh endpoint

```
POST https://api.airqo.net/api/v2/users/token/refresh
Authorization: JWT <token>

200 → { "success": true, "token": "eyJ...", "expiresIn": 86400 }
401 → session cannot be recovered — prompt login
```

### On 401 from any other endpoint

1. Try `POST /api/v2/users/token/refresh` once
2. On success, retry the original request with the new token
3. On failure, clear the session and redirect to login

Never redirect to login immediately on a 401 without attempting a refresh —
this is the most common cause of premature logouts.
