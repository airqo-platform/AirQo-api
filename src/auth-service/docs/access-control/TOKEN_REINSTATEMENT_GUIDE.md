# API Token Reinstatement Guide

**Version:** 1.1 — Last updated: 2026-06-17

## Background

API tokens can be automatically suspended by the behavioural anomaly detector
in `utils/token.util.js`. The detector scores each token on two signals:

| Signal | Score delta | Suspend threshold |
|---|---|---|
| User-Agent change between requests | +2 | 10 (env: `ANOMALY_SUSPEND_THRESHOLD`) |
| Hourly rate spike (> 5× 7-day average) | +3 | same |

When the cumulative `anomaly_score` reaches the threshold, the token's
`request_pattern.auto_suspended` is set to `true` and an email is sent to the
owner. All subsequent requests using that token receive **401 Unauthorized**
immediately, before any other checks run.

Legitimate service accounts — IoT sensor fleets, server-side apps, mobile
backend tokens — are especially prone to false positives because they often
span multiple devices or User-Agent strings. The fix is to reinstate the token
and mark it as a service account (`bypass_anomaly_detection: true`).

---

## Who can perform reinstatement

The PATCH endpoint enforces two independent access controls:

### Ownership check (all callers)

Any authenticated user can reinstate their **own** token. The endpoint verifies
that the JWT's user ID matches the `user_id` on the client linked to the token
being patched. A mismatch returns **403 Forbidden** — no other information is
disclosed.

Super-admins (see below) bypass this check and can patch any token.

### Admin-only fields

`bypass_anomaly_detection` can only be set by a user whose email is in the
`SUPER_ADMIN_EMAIL_ALLOWLIST` environment variable:

```
SUPER_ADMIN_EMAIL_ALLOWLIST=alice@airqo.net,bob@airqo.net
```

Parsed as a comma-separated list in
[`config/core/static-lists.js`](../../../config/core/static-lists.js).
Non-admin JWTs attempting to set this field have it silently dropped — the rest
of the PATCH still proceeds.

### Permission summary

| Action | Token owner | Super-admin |
|---|---|---|
| Reinstate own token (`auto_suspended: false`) | ✅ | ✅ |
| Reinstate another user's token | ❌ 403 | ✅ |
| Set `bypass_anomaly_detection` | ❌ (field silently dropped) | ✅ |

### Audit trail

Every change to `request_pattern` or `bypass_anomaly_detection` is logged at
`INFO` level with the caller's email, token ID, client ID, and the exact fields
changed. Check the auth-service application logs to confirm a reinstatement was
applied and by whom.

**Obtaining an admin JWT:** Log in to `analytics.airqo.net`, open DevTools →
Network, make any API call, and copy the `Authorization` header value. It looks
like `JWT eyJ...`.

---

## Known traps — read before starting

**`token_status: "active"` does not mean the token is unsuspended.**
The `GET /api/v2/users/tokens/:token` endpoint computes `token_status` solely
from the token's `expires` date — a suspended token with a future expiry still
shows `token_status: "active"`. Always check `request_pattern.auto_suspended`
directly (Step 2 below).

**A PATCH that returns `success: true` may have changed nothing.**
Sending `auto_suspended` as a flat top-level field — `{"auto_suspended": false}`
— is silently dropped by Mongoose's strict schema mode. The API still returns
`"success": true` and bumps `updatedAt`, but the field is never written.
Always use the nested form and verify the response body (Step 3 below).

**Token expiry is unrelated to suspension.**
`verifyToken` never loads the `expires` field during auth-request verification.
A token with an August expiry date can still be fully blocked by
`auto_suspended: true`.

---

## Step 1 — Find the full token value

The token value shown in suspension alert emails is **masked** (e.g.
`ZPH6CW1J...F3NV`). You need the full plaintext string.

Retrieve it from the admin client endpoint using the client ID, or search by
client name or owner email:

```bash
# By client ID
curl -s \
  "https://api.airqo.net/api/v2/users/clients/<CLIENT_ID>" \
  -H "Authorization: JWT <YOUR_ADMIN_JWT>" \
  | jq '.access_token.token'

# By owner email — lists all clients
curl -s \
  "https://api.airqo.net/api/v2/users/clients?email=<OWNER_EMAIL>" \
  -H "Authorization: JWT <YOUR_ADMIN_JWT>" \
  | jq '.[].access_token | {name, token, auto_suspended: .request_pattern.auto_suspended}'
```

For service deployments the token may also be in a Kubernetes secret:

```bash
kubectl get secret -n production <secret-name> \
  -o jsonpath='{.data.AIRQO_API_TOKEN}' | base64 -d
```

---

## Step 2 — Confirm and inspect the suspension

Read `request_pattern` directly from the client endpoint. This is the
authoritative source.

```bash
curl -s \
  "https://api.airqo.net/api/v2/users/clients/<CLIENT_ID>" \
  -H "Authorization: JWT <YOUR_ADMIN_JWT>" \
  | jq '.access_token | {
      auto_suspended:    .request_pattern.auto_suspended,
      anomaly_score:     .request_pattern.anomaly_score,
      suspension_reason: .request_pattern.suspension_reason,
      suspended_at:      .request_pattern.suspended_at,
      bypass:            .bypass_anomaly_detection
    }'
```

**Decision table:**

| `auto_suspended` | `bypass_anomaly_detection` | Action |
|---|---|---|
| `true` | `false` | Reinstate (Step 3) then set bypass (Step 4) |
| `true` | `true` | Reinstate only (Step 3) — bypass already set |
| `false` | `false` | Token not suspended — investigate other gates (IP block? Client inactive? Scope?) |
| `false` | `true` | No action needed |

Secondary smoke-test using a documented public endpoint (confirms but does not diagnose):

```bash
# Cohort-based access (partners and organisations)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.airqo.net/api/v2/devices/measurements/cohorts/<COHORT_ID>?token=<TOKEN_VALUE>"

# Grid-based access (cities and municipalities)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.airqo.net/api/v2/devices/measurements/grids/<GRID_ID>?token=<TOKEN_VALUE>"

# 401 → suspended or invalid    200 or 429 → active
```

Reference: [Recent Measurements (Cohort)](https://docs.airqo.net/api/for-partners/recent-measurements) ·
[Recent Measurements (Grid)](https://docs.airqo.net/api/for-cities/recent-measurements)

---

## Step 3 — Reinstate the token

The body **must** nest `auto_suspended` inside `request_pattern`. The flat form
is silently ignored — see "Known traps" above.

```bash
curl -s -X PATCH \
  "https://api.airqo.net/api/v2/users/tokens/<TOKEN_VALUE>" \
  -H "Authorization: JWT <YOUR_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "request_pattern": { "auto_suspended": false } }'
```

**Verify the response body** — not just the top-level message:

```json
{
  "message": "Successfully updated the token's metadata",
  "updated_token": {
    "request_pattern": { "auto_suspended": false },
    ...
  }
}
```

If `updated_token.request_pattern.auto_suspended` is still `true`, the body
shape was wrong or the wrong token value was used. Re-check and retry.

> `updatedAt` ticks forward on every PATCH regardless of whether any field
> actually changed — a bumped `updatedAt` alone does **not** confirm
> reinstatement.

---

## Step 4 — Mark service accounts as bypass (admin only)

For any token that legitimately spans multiple devices, User-Agent strings, or
server-side processes — IoT fleets, mobile backend tokens, shared integrations —
set `bypass_anomaly_detection: true` immediately after reinstatement, before the
application resumes traffic. This disables all behavioural scoring permanently
so the token cannot be auto-suspended again by rate spikes or UA changes.

This field requires the caller's JWT email to be in `SUPER_ADMIN_EMAIL_ALLOWLIST`.
A non-admin JWT receives 403 even if the rest of the PATCH body is valid.

```bash
curl -s -X PATCH \
  "https://api.airqo.net/api/v2/users/tokens/<TOKEN_VALUE>" \
  -H "Authorization: JWT <YOUR_ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "bypass_anomaly_detection": true }'
```

Confirm it is persisted in the response:

```json
{ "updated_token": { "bypass_anomaly_detection": true, ... } }
```

> **Security tradeoff:** bypass disables *all* behavioural anomaly scoring for
> this token — both UA-change and rate-spike signals. Honeypot traps, IP
> blacklisting, and manual suspension remain active. Notify the token owner
> when this flag is applied (see Step 6).

---

## Step 5 — Smoke-test

Use whichever documented public endpoint matches the token's access pattern:

```bash
# Cohort-based access (partners and organisations)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.airqo.net/api/v2/devices/measurements/cohorts/<COHORT_ID>?token=<TOKEN_VALUE>"

# Grid-based access (cities and municipalities)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.airqo.net/api/v2/devices/measurements/grids/<GRID_ID>?token=<TOKEN_VALUE>"

# Expect: 200 (or 429 if rate-limited, but not 401)
```

Re-query the client endpoint and confirm both `auto_suspended: false` and
`bypass_anomaly_detection: true` are persisted before notifying the owner.

---

## Step 6 — Notify the token owner

Send a brief message covering:

1. **What happened** — the token was suspended by the anomaly detector due to
   `<suspension_reason>` (from `request_pattern.suspension_reason`). This is a
   false positive caused by [multi-device usage / UA variation / rate spike].
2. **What was done** — it has been reinstated and marked as a service account
   so the same heuristic will not trigger again.
3. **Security recommendation** — because behavioural monitoring is now reduced
   for this token, they should consider enabling **"Require client secret on
   every request"** on their API client card under Settings › API. When enabled,
   every request must also send `X-Client-Secret: <secret>` in the headers,
   providing defense-in-depth that does not depend on heuristics.
4. **Invite them to test** and report any remaining 401s.

---

## Troubleshooting

**PATCH returns `success: true` but token is still blocked.**
Inspect `updated_token.request_pattern.auto_suspended` in the response body. If
it is still `true`, the body was sent flat instead of nested. Resend with the
nested form (`{ "request_pattern": { "auto_suspended": false } }`) and verify
the field in the response body.

**403 on the PATCH.**
The JWT email is not in `SUPER_ADMIN_EMAIL_ALLOWLIST` on the auth-service
production env. Ask a super-admin to perform the PATCH, or have DevOps add the
email to the env var.

**`token_status` says `"active"` but the token still 401s.**
`token_status` only reflects expiry. Check `request_pattern.auto_suspended` on
the client endpoint (Step 2).

**Token has a future expiry date but is still blocked.**
Expiry and suspension are independent. `verifyToken` never loads `expires`
during auth-request verification. Fix the suspension via Step 3.

**Smoke test returns 500, not 200 or 401.**
A gateway-level 500 (especially an HTML error page) indicates an
infrastructure issue upstream of the application — nginx, ingress, or a
cold-start timeout. Retry; these are usually transient. If it persists, check
device-registry and auth-service logs around that timestamp.

**Token gets suspended again shortly after reinstatement.**
`bypass_anomaly_detection: true` was not set, or was set after the application
had already resumed traffic. The anomaly detector runs asynchronously on every
passing request — a handful of UA-mismatched calls can push `anomaly_score`
back above the threshold before the bypass write lands. Always apply bypass
immediately after reinstatement, before the application makes any calls.
