# `validate_network()` / `get_networks()` — Cleanup Notice for the analytics/workflows team

## What changed

The Auth Service's `GET /users/networks` endpoint has been **removed
entirely** (404 as of this change reaching staging/production) as part of a
full removal of the legacy `networks` org-membership concept, superseded by
`groups`.

Two dead call sites were found calling it:
- `validate_network()` in `api/utils/data_formatters.py` (analytics)
- `get_networks()` in `airqo_etl_utils/data_api.py` (workflows)

## Current status

- **Neither function is called anywhere else in either codebase** — checked
  every import site of `data_formatters` and `data_api`; nothing pulls these
  in except their own test files. As far as static analysis shows, both are
  unused dead code today.
- Since the endpoint they call no longer exists, either function would now
  fail immediately (network error / 404) if anything ever did call it.

## What we're asking

Please confirm on your end and remove `validate_network()` (and the
`endpoint = "/users/networks"` call inside it) and `get_networks()` whenever
convenient. This is a cleanup notice, not something actively breaking your
pipelines today given they're unused — but they're no longer safely callable
even for a one-off manual check, since the endpoint is genuinely gone (not
just deprecated). If it turns out either is needed somewhere we didn't find,
let us know and we can talk through a `groups`-based equivalent.

Questions — reach out to the AirQo Auth Service team.
