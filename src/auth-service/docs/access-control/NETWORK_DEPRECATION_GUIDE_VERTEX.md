# Networks API Removed — URGENT Breaking Change Notice for the vertex team

## What changed

**`GET /api/v2/users/networks` and `POST /api/v2/users/networks` (and the v3
equivalents) have been removed entirely.** They will return 404 as soon as
this change reaches staging/production. This reverses our earlier position —
a previous version of this notice said these two endpoints would stay live
indefinitely; that exception has since been withdrawn on an explicit decision
to fully remove the network concept from auth-service before more integration
debt accumulates.

**This is a bigger break than "one admin page."** `useNetworks()` is a
required dropdown not only on the Admin > Networks ("Sensor Manufacturers")
page but also in:
- Grid creation
- Cohort creation (both variants)
- Site creation
- Device import
- Device deploy

All of these will fail wherever they call `useNetworks()`, `GET /users/networks`,
or `POST /users/networks` directly, with no fallback data source available
today.

Everything else in the old `Network` CRUD surface (assign/unassign users, set
manager, list roles for a network, get-by-id, delete, update, refresh) was
already unreachable before this change and remains so. The Sensor Manufacturer
*request* workflow (`/devices/network-creation-requests`, on device-registry)
is unaffected — unrelated service, unrelated feature, despite the similar name.

## What we need from the vertex team

This needs to be treated as urgent, pre-staging work, not a background
migration item:

1. Identify every place `useNetworks()` / `GET /users/networks` /
   `POST /users/networks` is called (the six forms listed above at minimum).
2. Decide a replacement data source before this ships to staging. Our
   recommendation: model whatever "network" meant for these forms as a
   `group` instead — groups are the actively maintained organization concept
   in auth-service and get ongoing features/fixes. If vertex's "network" here
   is a lightweight naming/tagging concept rather than an actual
   organization-membership one, a purely vertex-side field may be simpler
   than trying to preserve auth-service groups semantics.
3. If any of the six forms don't actually need this dropdown in practice,
   confirm and drop it — narrower scope may be faster than a full
   groups-based migration.

## Timeline

No advance coordination window this time — the removal is already done on
the auth-service side, pending this branch reaching staging. Please treat
this as a "fix before staging" item. Reach out to the AirQo Auth Service
team immediately if six forms breaking at once is not workable on your end —
there may be room to sequence the actual staging/production deploy around
your fix, even though the code change itself is final.
