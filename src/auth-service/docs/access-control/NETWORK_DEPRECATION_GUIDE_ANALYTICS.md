# `validate_network()` — Cleanup Notice for the analytics team

## What we found

While deprecating the legacy `networks` org-membership concept in the Auth
Service, we found that `validate_network()` in
`api/utils/data_formatters.py` still calls the Auth Service's
`GET /users/networks` endpoint (via `AirQoRequests`, resolved through the
gateway) to check whether a given name matches an existing network.

## Current status

- **This function is not called anywhere else in the analytics codebase** —
  we checked every place `data_formatters` is imported and `validate_network`
  isn't pulled in by any of them. As far as we can tell from static analysis,
  it's unused dead code today.
- The endpoint it calls (`GET /users/networks`) is still live for now — it's
  kept for one frontend app's admin page — but the underlying `networks`
  concept is deprecated and frozen, being phased out in favor of `groups`.
  We wouldn't want analytics to pick up a new dependency on it.

## What we're asking

Since it looks unused, could you confirm on your end and remove
`validate_network()` (and the `endpoint = "/users/networks"` call inside it)
whenever convenient? No urgency — this is a cleanup notice, not a breaking
change, since the endpoint isn't being removed yet either. If it turns out
you do still need network-name validation somewhere, let us know and we can
talk through what a `groups`-based equivalent would look like instead of
extending the old endpoint.

Questions — reach out to the AirQo Auth Service team.
