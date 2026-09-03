# `networks[]` removed from the Roles-Simplified Response — Final Notice for the nexus team

## What changed

The `networks` org-membership concept in the AirQo Auth Service has been
removed from RBAC. As of this change, the following no longer return network
data at all:

- `GET /api/v2/users/roles/me/roles-simplified`
- `GET /api/v2/users/roles/users/:user_id/roles-simplified` — the `networks`
  key is gone from the response entirely (previously an array, now absent).
- `GET /api/v2/users/roles/users/:user_id/role-summary` — `network_roles` is
  gone from the summary object.
- The login response no longer includes `hasNetworkAccess` or `defaultNetwork`.

```json
{
  "user_id": "...",
  "groups": [{ "group_id": "...", "group_name": "...", "role_id": "...", "role_name": "...", "permissions": [] }]
}
```

If `useRBAC` (or anywhere else in nexus reading `userRoles.networks`,
`hasPermissionInNetwork`, `hasRoleInNetwork`, `getUserNetworks`,
`hasNetworkAccess`, or `defaultNetwork`) hasn't already been migrated to rely
on `groups[]` only, those code paths will now silently see `undefined`/empty
data instead of throwing — please audit for that rather than assuming a hard
failure would have flagged it.

**Confirmed via a full audit — two specific pages are affected**, not just a
theoretical "check `GET /users/:id`":
- `src/app/(dashboard)/system/users/[id]/page.tsx`
- `src/app/(dashboard)/system/team-members/[memberId]/page.tsx`

Both read `user.networks` from `GET /users/:id` to render a "Current Access"
panel. It's optional-chained on your side, so this won't throw — but the
"Networks" section of that panel will now permanently show
**"No network roles assigned"** for every user, since `User.network_roles`
has been removed from auth-service entirely. This is a UI cleanup item
(remove the now-permanently-empty section), not an urgent break, but it
should get on the backlog since it'll otherwise sit there confusing whoever
looks at it.

Also confirmed: `useRBAC.ts`'s `hasPermissionInNetwork`, `hasRoleInNetwork`,
and `getUserNetworks` have **zero call sites anywhere in nexus** — dead
exports, safe to delete whenever convenient, no live behavior depends on them.

## Status

The auth-service side is done — no further coordination needed there. What's
now on nexus: the two "Current Access" panels above will need their Networks
section removed as a follow-up cleanup (not urgent), and the three dead
`useRBAC` exports can be deleted whenever convenient. Reach out to the AirQo
Auth Service team if nexus finds any other code path that broke.
