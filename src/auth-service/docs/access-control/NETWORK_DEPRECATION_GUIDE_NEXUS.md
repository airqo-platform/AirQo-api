# `networks[]` in the Roles-Simplified Response — Deprecation Notice for the nexus team

## What's changing

The `networks` org-membership concept in the AirQo Auth Service is deprecated
in favor of `groups`. Nothing is being removed yet, but the `networks[]` array
your `useRBAC` hook merges into its permission set is now considered legacy
and frozen — it will not receive new fields or fixes, and is a candidate for
removal in a future release.

**Endpoints unaffected for now:**
- `GET /api/v2/users/roles/me/roles-simplified`
- `GET /api/v2/users/roles/users/:user_id/roles-simplified`

Both continue to return the same shape you're consuming today:

```json
{
  "user_id": "...",
  "groups": [{ "group_id": "...", "group_name": "...", "role_id": "...", "role_name": "...", "permissions": [] }],
  "networks": [{ "network_id": "...", "network_name": "...", "role_id": "...", "role_name": "...", "permissions": [] }]
}
```

In practice, `networks[]` is mostly populated for accounts that were assigned
a legacy network role before the org migrated to groups. That said, it isn't
fully frozen data: the still-live "Sensor Manufacturers" creation flow (kept
for vertex, see `NETWORK_DEPRECATION_GUIDE_VERTEX.md`) does add a network role
for whoever creates a network, and some legacy access-request handling can
still write to it too. So we can't promise `networks[]` will only ever
shrink — please don't assume it's safe to stop merging it without checking
your own account/test data first.

## What we need from the nexus team

Please plan to migrate `useRBAC` (and anywhere else in nexus that reads
`userRoles.networks`, `hasPermissionInNetwork`, `hasRoleInNetwork`,
`getUserNetworks`) to rely on `groups[]` only. There's no fixed deadline, but
we'd like to coordinate before doing a final removal of the `networks[]`
field from the response.

## Timeline

No fixed date. We'll confirm with you before dropping `networks[]` from the
roles-simplified response.

Questions or want to plan the migration together — reach out to the AirQo
Auth Service team.
