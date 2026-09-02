# Networks API Deprecation Notice — for the vertex team

## What's changing

The `networks` concept in the AirQo Auth Service (the "Sensor Manufacturers" admin
page in vertex) is deprecated. It has been superseded by `groups` across the
platform, and is no longer being developed or fixed.

**The two endpoints vertex calls are still live, with the same request/response
contract** — but we've updated an important correction to this doc: these
aren't only used by the Admin > Networks page. `useNetworks()` is also a
required dropdown in grid creation, cohort creation (both variants), site
creation, and device import/deploy. That's a much bigger dependency than
originally scoped here, so please don't treat this as an isolated admin-page
migration.

- `GET /api/v2/users/networks` (and the v3 equivalent) — used by `useNetworks()`
  to populate the network dropdowns across the forms listed above.
- `POST /api/v2/users/networks` — used by the "Create Network" form via your
  `/api/network` proxy route. **Internal change, no contract change:** this
  endpoint's RBAC side effect now provisions a group-scoped admin role instead
  of a network-scoped one (networks are being fully retired from RBAC
  elsewhere in this service) — the request body, response shape, and created
  Network record you get back are unchanged.

Everything else in the old `Network` CRUD surface (assign/unassign users, set
manager, list roles for a network, get-by-id, delete, update, refresh) was
**already unreachable** before this change — those endpoints were never wired
up on our side, so if any of that UI exists in vertex, it has not been
functional. The network-creation-*request* workflow (`/devices/network-creation-requests`)
is unaffected — that lives on a different service and is unrelated to this
deprecation.

## What we need from the vertex team

There's no deadline yet, but please plan to migrate `useNetworks()` and every
form listed above off these two endpoints. Given the broader surface than
originally documented, this is a bigger migration than "one admin page" —
please scope it accordingly. Once vertex no longer calls them, we'll do a
final removal pass.

Recommended path:
- If networks are still needed as a concept for grids/cohorts/sites/devices,
  we'd like to talk about modeling it as a `group` instead — groups are the
  actively maintained organization concept and get ongoing features/fixes.
- If some of these forms no longer need the network dropdown in practice,
  narrowing scope first may be the simpler path — worth confirming usage per
  form before committing to a full migration.

## Timeline

No fixed date. We'll coordinate with you before doing the final removal, and
we won't break `GET`/`POST /users/networks` until you've confirmed vertex no
longer depends on them.

Questions or want to plan the migration together — reach out to the AirQo
Auth Service team.
