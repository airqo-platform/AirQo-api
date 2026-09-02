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

**Also check `GET /users/:id`** (and the users-list endpoint) if nexus reads
`.networks` from those responses to render a "Network" scope row or seed a
role-picker default — that field's source data is being migrated off users
next and will empty out.

## Status

Done. No further coordination needed on this specific change — reach out to
the AirQo Auth Service team if nexus finds a code path that broke.
