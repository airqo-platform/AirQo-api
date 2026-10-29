# Network Removal — Final Status

## Cross-repo verification + critical open risk (2026-09-03)

Prompted by a direct "is this totally removed, and does it only break Vertex?"
check, ran two passes: (1) one more self-review of auth-service itself, (2) a
full re-audit of every app in `airqo-frontend/src/` and every service in
`AirQo-api/src/` (not just the previously-checked Vertex/workflows).

**Auth-service — 3 more leftover references found and fixed:**
- `utils/preference.util.js` still listed `network_ids` in three
  `$addToSet`-field arrays (dead since `Preference.network_ids` no longer
  exists as a schema field, but inconsistent with everything else removed).
- `utils/common/generate-filter.util.js`'s `roles` and `permissions` filter
  builders — backing `GET /roles` and `GET /permissions`, the exact
  endpoints this whole effort is about — still accepted `network_id`/
  `net_id`/`network` query params. Also cleaned the `defaults` filter's
  `network_id` param for the same reason.
- One leftover "or network" phrase in the group-assignment notification
  email (`utils/common/email.msgs.util.js`).

All fixed with test coverage; full suite still green.

**Backend re-audit (every service under `AirQo-api/src/`): confirmed clean.**
No service besides auth-service calls any removed endpoint, reads any removed
response field, or sends `network_id`/`contextType=network`/
`requestType: "network"` to auth-service. `analytics`'s `validate_network()`
and `workflows`' `get_networks()` are re-confirmed dead code (zero live
callers). device-registry's own "network" concept (device/site connectivity)
is fully independent and unaffected, including one inert
`Network.auth_service_id` field that no live code path touches.

**Frontend re-audit: NOT limited to Vertex.**
- **`vertex-template`** (the internal white-label fork of Vertex) has the
  **identical** live coupling to `/users/networks` and will break the same
  way — this was previously only flagged as "worth a heads-up," now
  confirmed as an active break requiring the same urgency as Vertex itself.
- **Nexus** — not a hard break, but a real regression the earlier
  "already migrated" note missed: `src/app/(dashboard)/system/users/[id]/page.tsx`
  and `.../team-members/[memberId]/page.tsx` read `user.networks` from
  `GET /users/:id` to render a "Current Access" panel. It's optional-chained
  (no crash), but will now permanently show "No network roles assigned" for
  every user. `useRBAC.ts`'s `hasPermissionInNetwork`/`hasRoleInNetwork`/
  `getUserNetworks` are confirmed to have zero call sites anywhere in nexus —
  dead code, no live regression there.
- **beacon, mobile, website, docs-website, calibrate, vertex-desktop**:
  confirmed no impact — all "network" hits are either an unrelated
  device-registry concept or already-dead fields.

**CRITICAL — silent, security-relevant permission loss risk (Vertex + vertex-template):**
Both apps' `core/permissions/permissionService.ts` (`getEffectivePermissions`,
`isSuperAdmin`, `getUserRole`, `getOrganizationPermissions`, `getUserRoles`)
read `user.networks` as a parallel source alongside `user.groups`. Since
`user.networks` is now permanently empty, **any user whose permissions or
SUPER_ADMIN status were granted only via a legacy network-role — never
mirrored to a group-role — silently loses that access, with no error shown
anywhere.**

Traced whether the migration tooling we ran before deleting `network_roles`
(`migrateNetworkRolesToGroup`) actually prevented this, by reading its
deleted source via `git show`. Finding: **it did not, for the common case.**
- When an equivalent group-scoped role already existed by name, it correctly
  redirected affected users' role arrays to it (this path is fine).
- When no equivalent existed, it only converted the **Role document itself**
  (`$set: {group_id}, $unset: {network_id}`) — it never touched any **User**
  document. A user whose only assignment of that role lived in their own
  `network_roles` array would keep it sitting there, unmigrated, until
  `cleanupUserNetworkRoles` later wiped `network_roles` to `[]` — at which
  point that assignment was gone, with the role itself (now correctly
  group-scoped) never having been added to that user's `group_roles`.

**This cannot be fixed by writing more code.** `cleanupUserNetworkRoles` set
`network_roles: []` on affected users *before* the schema field was removed
— the actual data, not just its schema definition, is gone from the live
database. A job or script can only act on data that still exists; there is
none left to reconcile from. Checked for an alternative signal (an audit/
activity log of historical role assignments) — doesn't exist either:
`ActivityLogSchema.group_id` is a **required** field by design, and
`utils/request.util.js` explicitly skips logging entirely for network-type
events ("ActivityLog is group-specific — only log for group-type"). So
there's no retained record anywhere of which users had network-only role
assignments.

**Decision (2026-09-03): a database backup restore was available but
deliberately not pursued**, to avoid an infra-level, large-scale DB
operation for a risk of unknown/likely-small scope. **Mitigation is
reactive, not proactive**: if a real user reports unexpectedly missing
access, re-grant the correct group-scoped role directly via the existing,
already-working role-assignment endpoints — a two-minute, single-account
fix, not a bulk operation. No code changes were made for this finding
specifically; it's tracked here as an accepted, open risk. Likely exposure
is small: the roles this session specifically verified via API earlier
(`AIRQO_SUPER_ADMIN`, `AIRQO_ADMIN`, `AIRQO_DEFAULT_USER`) already had
matching group-scoped equivalents by the time of migration, meaning they'd
have gone through the "redirect to existing equivalent" path, which
did work correctly.

**Frontend fix needed (not made here — out of scope, documented for the
Vertex team instead):** `permissionService.ts` in both Vertex and
vertex-template should stop reading `user.networks` entirely and rely solely
on `user.groups` — the network concept no longer exists anywhere in
auth-service, so this is now permanently-dead code that should be removed,
not fixed. See `NETWORK_DEPRECATION_GUIDE_VERTEX.md`.

## Post-review fixes (2026-09-03)

A PR review (Copilot + a second reviewer) came in after the removal above had
already shipped further than the review's own diff snapshot — several
findings were already moot (e.g. suggestions to fix `utils/network.util.js`
or re-add auth to `routes/v2/networks.routes.js`, both fully deleted by the
time the review landed). What was still genuinely valid and fixed:

- **`validators/roles.validators.js`'s `update` validator accepted
  `network_id` silently** (only `create` rejected it) — re-opened the exact
  bug this whole effort started from: a client could set a stale
  `network_id` on an existing role via `PUT`. The schema field removal
  already prevented it from persisting (Mongoose strict-mode strips unknown
  paths), but there was no explicit rejection or client-facing error. Now
  rejects the same way `create` does.
- **`createOrUpdateRoleWithPermissionSync`'s stale-`network_id` cleanup was
  gated behind `needsGroupIdBackfill`** — a role that already had `group_id`
  set (no backfill needed) but still carried a leftover `network_id` was
  never cleaned up by the startup sync. Decoupled into its own
  `hasStaleNetworkId` condition; also fixed the stale inline comment this
  same code had (Copilot correctly flagged it as inaccurate once group_id
  priority was already in place elsewhere in this file).
- **`utils/user-type.util.js` — found broken independent of this review**:
  `UserModel`/`GroupModel` were used throughout but never `require()`d (a bug
  predating this whole effort, confirmed via `git show` on the original
  commit) — every function in this file threw `ReferenceError` on any real
  invocation. While fixing that to actually verify the review's other
  findings: `assignUserType`/`assignManyUsersToUserType` did
  `$set: { group_roles: {...} }`, replacing a user's entire `group_roles`
  array with a single bare object instead of updating one entry — fixed to a
  positional `"group_roles.$.userType"` update. Also added a missing
  `grp_id` guard (previously would run `updateOne({_id}, {})`, a
  disguised-as-success no-op) and `return` before early `next(...)` calls
  that were missing it. Added `utils/test/ut_user-type.util.js` — this file
  had zero prior coverage.

Confirmed already resolved / no longer applicable by the time of review:
`atf.service.js`'s `networkPermissions` crash (already fixed), `user.util.js`'s
login-path crash (already fixed), `getDetailedUserRolesAndPermissions`'s
network fields (already removed, zero remaining references), and every
`network.util.js`/`routes/v2/networks.routes.js`-targeted suggestion (both
fully deleted).

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
