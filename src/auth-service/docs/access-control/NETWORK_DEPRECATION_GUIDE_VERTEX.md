# Networks API Deprecation Notice — for the vertex team

## What's changing

The `networks` concept in the AirQo Auth Service (the "Sensor Manufacturers" admin
page in vertex) is deprecated. It has been superseded by `groups` across the
platform, and is no longer being developed or fixed.

**Nothing is being removed yet.** The two endpoints vertex currently calls are
still live and unchanged:

- `GET /api/v2/users/networks` (and the v3 equivalent) — used by `useNetworks()`
  to populate the network dropdowns and the Admin > Networks list.
- `POST /api/v2/users/networks` — used by the "Create Network" form via your
  `/api/network` proxy route.

Everything else in the old `Network` CRUD surface (assign/unassign users, set
manager, list roles for a network, get-by-id, delete, update, refresh) was
**already unreachable** before this change — those endpoints were never wired
up on our side, so if any of that UI exists in vertex, it has not been
functional. The network-creation-*request* workflow (`/devices/network-creation-requests`)
is unaffected — that lives on a different service and is unrelated to this
deprecation.

## What we need from the vertex team

There's no deadline yet, but please plan to migrate the Admin > Networks
("Sensor Manufacturers") page off these two endpoints. Once vertex no longer
calls them, we'll do a final removal pass.

Recommended path:
- If the "Sensor Manufacturers" feature is still needed, we'd like to talk
  about modeling it as a `group` instead — groups are the actively maintained
  organization-membership concept and get ongoing features/fixes.
- If the feature is no longer used in practice, removing the Admin > Networks
  page entirely may be the simpler path — worth confirming usage first.

## Timeline

No fixed date. We'll coordinate with you before doing the final removal, and
we won't break `GET`/`POST /users/networks` until you've confirmed vertex no
longer depends on them.

Questions or want to plan the migration together — reach out to the AirQo
Auth Service team.
