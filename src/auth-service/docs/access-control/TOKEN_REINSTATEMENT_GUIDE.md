# API Token Suspension & Recovery

**Version:** 2.0 — Last updated: 2026-06-17

## Why tokens get suspended

The AirQo API monitors usage patterns on every token to detect unusual activity.
A token is automatically suspended when either of the following is detected:

- **User-Agent change** — the same token is used from different clients or
  applications in a short window (common signal of token sharing or leakage).
- **Unusual request rate** — the hourly request volume spikes sharply compared
  to the token's recent average.

When a token is suspended you will receive an email with the reason and the
timestamp of the suspension. All API requests using that token will return
**401 Unauthorized** until the token is recovered.

---

## What the suspension email tells you

The email includes:

- The masked token value (e.g. `ZPH6CW1J...F3NV`) and its name
- The time of suspension
- The reason detected (e.g. "User-Agent change detected")

> **Note:** A suspended token is not the same as an expired token. A token can
> have a valid future expiry date and still be suspended. The expiry date shown
> in your API client settings is unrelated to whether the token is currently
> active.

---

## How to recover your token

You have two options. Use whichever fits your workflow.

### Option A — AirQo Nexus (recommended)

1. Log in to [nexus.airqo.net](https://nexus.airqo.net)
2. Go to **Settings › API**
3. Find the affected token on your API client card
4. If it shows as suspended, click **Reinstate** to restore it
5. Alternatively, click **Regenerate Token** to issue a fresh token without
   creating a new client — this is the safest choice if you suspect the token
   may have been compromised

### Option B — API (for developers)

If you prefer to reinstate programmatically, use your own AirQo JWT (obtained
by logging in to the platform).

**Step 1 — Reinstate the token**

```bash
curl -s -X PATCH \
  "https://api.airqo.net/api/v2/users/tokens/<YOUR_TOKEN_VALUE>" \
  -H "Authorization: JWT <YOUR_AIRQO_JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "request_pattern": { "auto_suspended": false } }'
```

**Important:** the field must be nested exactly as shown. Sending
`{ "auto_suspended": false }` flat at the top level will appear to succeed
(the API returns `success: true`) but will not change anything. Always verify
the response body:

```json
{
  "message": "Successfully updated the token's metadata",
  "updated_token": {
    "request_pattern": { "auto_suspended": false },
    ...
  }
}
```

If `updated_token.request_pattern.auto_suspended` is still `true` in the
response, the body shape was wrong. Re-check and retry with the nested form.

> You can only reinstate tokens that belong to your own account. Attempting to
> patch a token from a different account returns 403 Forbidden.

**Step 2 — Verify the token is working**

```bash
# Cohort-based access (partners and organisations)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.airqo.net/api/v2/devices/measurements/cohorts/<YOUR_COHORT_ID>?token=<YOUR_TOKEN_VALUE>"

# Grid-based access (cities and municipalities)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.airqo.net/api/v2/devices/measurements/grids/<YOUR_GRID_ID>?token=<YOUR_TOKEN_VALUE>"
```

Expect `200`. A `401` means the token is still suspended. A `429` means the
token is active but rate-limited.

Reference:
[Recent Measurements (Cohort)](https://docs.airqo.net/api/for-partners/recent-measurements) ·
[Recent Measurements (Grid)](https://docs.airqo.net/api/for-cities/recent-measurements)

---

## If the token keeps getting suspended

If your token is reinstated but suspended again within minutes, it is because
the same pattern that triggered the original suspension (e.g. requests from
multiple devices with different User-Agent strings) is still occurring.

This is common for:
- IoT sensor fleets where multiple physical devices share one token
- Server-side apps alongside a browser or mobile client using the same token
- Applications that were recently updated and changed their HTTP client or SDK

**What to do:** contact [support@airqo.net](mailto:support@airqo.net) and
request that your token be marked as a service account. This disables the
automated suspension heuristics for your token permanently so high-volume or
multi-device usage is no longer flagged. Other security protections remain
active.

---

## Security recommendation

If your token was suspended due to a User-Agent change, consider enabling the
**"Require client secret on every request"** option on your API client card
under Settings › API.

When enabled, every API request must also include a `X-Client-Secret` header
alongside your token:

```
X-Client-Secret: <your-client-secret>
```

This means that even if your token is exposed, it cannot be used without also
knowing your client secret — providing an extra layer of protection that does
not depend on usage monitoring.

---

## Frequently asked questions

**My token shows as active in Settings › API but requests still return 401.**
The "active" status shown in the UI reflects whether your token has expired —
it does not reflect suspension. If you are seeing 401s, your token may be
suspended even if the UI shows it as active. Use the Reinstate option as
described above.

**I used the PATCH endpoint and got `success: true` but the token is still blocked.**
The body was almost certainly sent flat (`{ "auto_suspended": false }`) instead
of nested (`{ "request_pattern": { "auto_suspended": false } }`). Check the
`updated_token.request_pattern.auto_suspended` field in the response body — if
it is still `true`, resend with the correct nested form.

**My token expiry date is months away — can it still be suspended?**
Yes. Expiry and suspension are independent. A token with a future expiry date
can still be suspended by the anomaly detector. Reinstating restores access
regardless of the expiry date.

**I got 403 when trying to reinstate via the API.**
You can only reinstate your own tokens. If you need to reinstate a token
belonging to another account, contact [support@airqo.net](mailto:support@airqo.net).

**The smoke test returned 500, not 200 or 401.**
A 500 from the gateway is usually a transient infrastructure issue. Wait a
minute and retry. If it persists, contact support.
