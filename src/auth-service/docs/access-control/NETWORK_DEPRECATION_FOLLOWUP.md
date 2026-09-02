# Network Deprecation — Status and Remaining Follow-Up

Tracking doc for auth-service engineers. Started after fixing a live bug where
a role (`AIRQO_SUPER_ADMIN`) ended up with both `group_id` and a stale
`network_id` set, which broke role assignment. Expanded into a full removal
of network-based RBAC from this service. See the `fix-role-group` branch for
all of this.

## Done

**Initial bug fix + hardening:**
- `createOrUpdateRoleWithPermissionSync` now `$unset`s `network_id` when
  backfilling `group_id` on a role missing it, instead of leaving both set.
- `isGroupRoleOrNetworkRole` now returns only `"group"`/`"none"` — the
  network branch is fully removed (previously it preferred `group_id` when
  both were set; now `network_id` alone is not a valid role association at
  all). All 6 assign/unassign call sites simplified to group-only.
- `migrateNetworkRolesToGroup` (`POST /roles/admin/migrate-network-to-group`)
  also catches roles that already have `group_id` set alongside a stale
  `network_id` and cleans the leftover field.
- `Role.toJSON()` no longer drops `group_id` from its output.
- Deleted `migrations/rbac-migration.util.js` (orphaned, actively regressive
  if ever wired up).

**Architecture decision — `POST /users/networks` redirected, not removed:**
`useNetworks()`/`GET+POST /users/networks` turned out to be a much bigger
Vertex dependency than originally scoped (required in grid/cohort/site
creation and device import/deploy, not just an admin page — see the updated
`NETWORK_DEPRECATION_GUIDE_VERTEX.md`). Rather than delete these endpoints,
`utils/network.util.js`'s `create()` now provisions a **group-scoped** admin
role (via a new `getOrCreateGroupForNetwork` helper) instead of a
network-scoped one. The request/response contract for Vertex is unchanged;
internally, no new network-scoped roles or `User.network_roles` entries are
produced by this path anymore.

**Role assignment (Phase 2) — fully group-only now:**
- `createRole`/`POST /roles` no longer accepts `network_id` at all —
  `group_id` is required. Validator updated to explicitly reject `network_id`
  with a clear error rather than silently ignoring it.
- `listAvailableUsersForRole` always queries `group_roles`.
- `utils/user-type.util.js` (`assignUserType`, `assignManyUsersToUserType`,
  `listUsersWithUserType`, `listAvailableUsersForUserType`) — all `net_id`
  branches removed, group-only. (Note: `assignUserType` had a pre-existing
  bug — it called an undefined `isNetwork()` function, so it was already
  broken for any invocation before this cleanup; fixing that was incidental.)

**Response-shape changes (Phase 3 — the actual breaking change):**
- `getUserRolesSimplified` (backs `.../roles-simplified`) no longer returns
  `networks[]` at all.
- `getUserRoleSummary` (backs `.../role-summary`) no longer returns
  `network_roles`.
- Login response (`enhancedLogin`) no longer returns `hasNetworkAccess` or
  `defaultNetwork`.
- `preference.util.js`'s `getEffectiveTheme` — removed the three
  network-scoped theme-resolution priorities (user network-scoped theme,
  network organization theme, primary network theme) and the `network_id`
  query param. This was client-reachable (`?network_id=`), not dead code —
  confirmed no test coverage existed for it.
- Updated `NETWORK_DEPRECATION_GUIDE_NEXUS.md` to a final notice (the
  breaking change already shipped) and `_VERTEX.md` to reflect the
  redirect-to-groups decision and the corrected, larger dependency scope.

**`services/rbac.service.js` — the core permission-resolution engine (done, carefully).**
This file had zero existing test coverage despite being used on every
authenticated request, so characterization tests were written first
(`services/test/ut_rbac.service.js`) to lock in behavior before touching
anything. Key finding: `networkPermissions`/`networkMemberships` were
**hardcoded to `{}`/`[]` literals**, not actually computed — `_batchPopulateNetworks`
was defined but never called anywhere. So the network branches in
`getUserPermissionsByContext`, `getUserPermissionsForLogin`, `hasPermission`,
`getUserPermissionsInContext`, `getUserRolesInContext`, and `_populateUserRoleData`
were already dead in practice for any real user — removed with confirmed zero
behavioral change (see the test file's docstring for the full explanation).

One near-miss worth flagging for anyone touching this file again: an early
pass removed `hasPermission`'s `contextType === "network"` branch entirely,
which would have made it fall through to the user's *full* global permission
set instead of staying empty — this silently widens
`requireNetworkManagerAccess` (`middleware/groupNetworkAuth.js`), an
OR-composed access check, making it **more permissive**, not a no-op. Fixed
by keeping that branch explicit (system permissions only), not deleting it.
Any future change to this file should grep for every caller of the function
being touched before assuming a "dead" branch is actually unreachable in
composition with other checks.

**Deliberately still live, left untouched:** `isNetworkMember`, `isNetworkManager`,
and `hasRole`'s context-specific `contextType === "network"` branch — these
query raw DB data directly (not through `_populateUserRoleData`) and back
`requireNetworkManagerAccess`, part of the still-live access-request approval
flow below. Covered by characterization tests confirming they still work.

## Remaining — not yet done in this pass

**Access-request flow.** `utils/request.util.js` and
`middleware/accessRequestAuth.js` still have live `requestType === "network"`
branches for approving/rejecting/cancelling pre-existing network-type access
requests. **Before touching this**, confirm there are zero pending
`AccessRequest` documents with `requestType: "network"` in any tenant —
otherwise those requests become permanently unapprovable. `middleware/
groupNetworkAuth.js`'s `requireNetworkManagerAccess`/`isVerifiedNetworkMember`
back this same flow.

**Schema/model fields** (`Role.network_id`, `User.network_roles` and its
schema variants, `Permission.network_id`, `TenantSettings.defaultNetwork`/
`defaultNetworkRole`) are all still present — intentionally not removed yet,
since historical data may still reference them and the migration tooling
below needs to run first. `models/Network.js` itself must stay indefinitely
now, per the redirect-to-groups decision — it's still a live, routed model.

**One-time ops run, then delete the tools.** Run
`POST /roles/admin/migrate-network-to-group` (dry-run first) then
`POST /roles/admin/cleanup-user-network-roles` per tenant — safe to run now
that `getUserRolesSimplified`/`getUserRoleSummary` no longer read
`network_roles`. After that, `migrateNetworkRolesToGroup`,
`cleanupUserNetworkRoles`, and `repairUserRoleAssignment` (and their routes in
`routes/v2/roles.routes.js`) become purposeless and can be deleted.

**Landmines, still relevant:** `models/Defaults.js` and `models/Preference.js`
both set a schema-level default for `network_id` from
`constants.DEFAULT_NETWORK` (evaluated at schema-load time); `models/
Candidate.js` hard-fails registration with a 500 if `network_id` is absent
and `DEFAULT_NETWORK` is empty. None of these can be touched until/unless
`DEFAULT_NETWORK` itself is retired — which now looks unlikely to ever fully
happen, since `models/Network.js` remains live for Vertex.

**Not urgent:** `routes/v2/networks.routes.js`'s `GET /networks` has no auth
middleware while the v3 equivalent requires `enhancedJWTAuth` + `NETWORK_VIEW`
— worth confirming intentionally. `models/Permission.js`'s `network_id` field
is read-only/legacy.
