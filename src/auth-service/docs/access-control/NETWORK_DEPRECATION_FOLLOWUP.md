# Network Removal — Final Status

Tracking doc for auth-service engineers. Started after fixing a live bug
where a role (`AIRQO_SUPER_ADMIN`) ended up with both `group_id` and a stale
`network_id` set, which broke role assignment. Expanded into a **complete
removal** of the network concept from auth-service — including the two
endpoints (`GET`/`POST /users/networks`) and the `Network` model itself,
which were initially kept as a deliberate exception for Vertex and have now
also been removed on explicit instruction, accepting the breaking impact on
Vertex described below.

## Done

**RBAC role/permission layer — fully group-only:**
- `createOrUpdateRoleWithPermissionSync`, `isGroupRoleOrNetworkRole` (now
  only returns `"group"`/`"none"`), all 6 role assign/unassign call sites,
  `createRole`/`POST /roles` (rejects `network_id` outright), and
  `listAvailableUsersForRole` — all group-only now.
- `utils/user-type.util.js` — all `net_id` branches removed.
- `getUserRolesSimplified`/`getUserRoleSummary`/login response no longer
  return any network fields.
- `preference.util.js`'s `getEffectiveTheme` — network-scoped theme
  resolution and the `network_id` query param removed.

**`services/rbac.service.js` — the core permission-resolution engine.**
Had zero existing test coverage despite running on every authenticated
request, so characterization tests were written first
(`services/test/ut_rbac.service.js`) before any change. Key finding:
`networkPermissions`/`networkMemberships` were **hardcoded to `{}`/`[]`
literals**, never actually computed — dead in practice for any real user,
confirmed safe to remove. `isNetworkMember`, `isNetworkManager`,
`getNetworkModel`, and the `contextType === "network"` branches in
`hasPermission`/`hasRole`/`getUserPermissionsInContext`/
`getUserRolesInContext` are gone.

**Access-request flow — removed.** Confirmed zero pending `AccessRequest`
documents with `requestType: "network"` in any tenant before touching this.
`requireNetworkManagerAccess`/`isVerifiedNetworkMember`
(`middleware/groupNetworkAuth.js`) and every `requestType === "network"`
branch in `utils/request.util.js` are gone — the `AccessRequest.requestType`
schema enum is now `["group"]` only. (Also found: two dead calls to
`createNetworkUtil.assignOneUser`/`unAssignUser` inside that removed code —
methods that never existed on that module, so the network access-request
flow was **already silently broken**, 500s swallowed by try/catch, before
this removal.)

**One-time migration ops run, then tooling deleted.**
`POST /roles/admin/migrate-network-to-group` and
`POST /roles/admin/cleanup-user-network-roles` were run and verified per
tenant. `migrateNetworkRolesToGroup`, `cleanupUserNetworkRoles`,
`repairUserRoleAssignment` and their controller/validator/route wiring are
deleted.

**Schema fields removed:** `Role.network_id`, `User.network_roles` (+ its two
dead schema variants `networkRoleSchema`/`openNetworkRoleSchema`),
`Permission.network_id`, `TenantSettings.defaultNetwork`/
`defaultNetworkRole`, `Defaults.network_id`, `Preference.network_id`/
`network_ids`, `Candidate.network_id`. Cascaded into every consumer:
`Role.list()`'s network fallback `$lookup`, `Permission.list()`'s `networks`
`$lookup`, `Candidate.list()`'s `networks` `$lookup`, `User`'s pre-save hook
(no longer fetches `TenantSettings` at all — that fetch existed only to seed
`network_roles`, so user registration no longer depends on a
`TenantSettings` document existing), dead `User` statics
(`assignUserToNetwork`, `addNetworkRole`), `User.toJSON()`,
`getEnhancedUserDetails`, every `network_roles`-derived stat/flag across
`role-permissions.util.js`/`user.util.js`/`admin.util.js`, two live cron jobs
(`token-strategy-migration-job.js`, `guest-user-init-job.js`,
`preferences-update-job.js`), `db-projections.js`'s network exclusion
entries, and every relevant validator
(`roles`/`permissions`/`tenant-settings`/`defaults`/`preferences`/
`candidates`.validators.js — the `tenant-settings` one was **load-bearing**:
`defaultNetwork`/`defaultNetworkRole` were `.exists()`-required on `create`,
so leaving that unfixed would have made tenant-settings creation permanently
impossible to satisfy once the fields were gone).

**`Network` model and the last live endpoints — now fully removed.**
Deleted `models/Network.js`, `controllers/network.controller.js`,
`utils/network.util.js`, `routes/v2/networks.routes.js`,
`routes/v3/networks.routes.js`, and their test files; unmounted `/networks`
from both `routes/v2/index.js` and `routes/v3/index.js`. Also removed:
`constants.DEFAULT_NETWORK`/`DEFAULT_NETWORK_ROLE`/`NETWORK_EVENTS_TOPIC`
(env vars — **not** `NETWORK_CREATION_*_TOPIC`, which back device-registry's
unrelated "Sensor Manufacturer" Kafka flow and were deliberately left
alone), the `NETWORK_*` permission definitions in `config/core/permissions.js`
(confirmed non-cascading — `setupDefaultPermissions` is additive-only, so
this doesn't delete any existing `Permission` document or role assignment,
just stops re-affirming them), `cascadeUserDeletion`'s network-manager
cleanup, `profile-picture-update-job.js`'s network branch, and the now-dead
`generateFilter.networks`/`candidates`'s `network_id` filter.

**Two real bugs found and fixed as a direct result of this removal:**
1. `enhancedLogin`'s debug log did
   `Object.keys(loginPermissions.networkPermissions).length` with no guard —
   threw on every login once `getUserPermissionsForLogin` stopped returning
   that key.
2. `services/atf.service.js` (zero prior test coverage) — `StandardToken
   Strategy.generateToken` unconditionally did
   `Object.values(permissionData.networkPermissions).flat()` — threw on every
   token generation for any user on the STANDARD token strategy, for the same
   reason. Added `services/test/ut_atf.service.js` as a regression test.
   Also caught and reverted a near-miss in `hasPermission`'s network branch:
   an early edit would have made it fall through to the user's *full* global
   permission set instead of staying empty, silently widening
   `requireNetworkManagerAccess`'s OR-composed access check before that
   function was itself removed.

**Explicitly out of scope, confirmed unrelated:** `models/Scope.js` (OAuth
token-scope tiering, cosmetic FK, nothing authorizes on it),
`models/Department.js` (`dep_network_id` — feature already unreachable, zero
routes mounted), `models/AccessToken.js` (one harmless orphaned projection
key), device-registry's own independent `network` field on
Site/Device/Comparison/Inquiry models (device connectivity grouping,
unrelated to RBAC), `bin/jobs/kafka-consumer.js`'s Sensor Manufacturer
handlers and `NETWORK_CREATION_REQUESTS_TOPIC`/`_APPROVED_TOPIC`/
`_DENIED_TOPIC` (a completely different, still-live device-registry feature
that happens to share the word "network" in its Kafka topic names).
`services/atf.service.js`'s `getAllPermissions()` bit-position array still
lists `NETWORK_*` permission names — **deliberately left untouched**: it's
an independent, hardcoded, positionally-encoded list (array index → bit
position) used to decode already-issued compressed tokens; removing entries
would shift every subsequent bit position and corrupt in-flight tokens.

Full test suite passes (2172 tests) except the one pre-existing, unrelated
`getDifferenceInMonths` timing flake in `utils/common/test/ut_date.util.js`.

## Breaking changes to communicate before staging

This is now a genuine breaking change for:
- **Vertex** — `GET`/`POST /users/networks` are gone entirely. Their
  `useNetworks()` hook (used in grid creation, cohort creation (both
  variants), site creation, and device import/deploy — not just the Admin >
  Networks page) will start failing immediately on deploy. No fallback data
  source exists today.
- **Nexus** — already communicated and shipped in an earlier phase
  (`networks[]` removed from `roles-simplified`, etc.) — no new impact here.
- **Analytics / workflows** (Nicholas's area) — `validate_network()` /
  `get_networks()` call `GET /users/networks`; both were already confirmed
  dead code with no live callers, but will now hard-fail if anyone resurrects
  them.
- **vertex-template** — has its own copy of the same `/users/networks`
  coupling; their own internal audit doc already flags this as planned for
  removal, but timeline may not be in sync with this change.

See `NETWORK_DEPRECATION_GUIDE_VERTEX.md` and `NETWORK_DEPRECATION_GUIDE_NEXUS.md`
for the team-facing notices — the Vertex one needs a final update to reflect
that the exception it documented no longer holds.
