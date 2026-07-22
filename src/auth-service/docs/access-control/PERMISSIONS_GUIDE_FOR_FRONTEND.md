# Permissions Guide (AirQo Nexus API)

Base URL:
- Production: `https://api.airqo.net/api/v2/users` or `https://nexus.airqo.net/api/v2/users`
- Staging: `https://nexus-staging.airqo.net/api/v2/users`

All requests below require: `Authorization: JWT <token>`

## 1. What is a permission?

A permission is an uppercase string code in `SCOPE_ACTION` format, e.g. `USER_CREATE`, `DEVICE_DEPLOY`, `GROUP_VIEW`.

## 2. Full list of permissions

### System & Admin (platform-level only — never assigned on a group role)

| Permission | What it's for |
|---|---|
| `SYSTEM_ADMIN` | System administration access |
| `SUPER_ADMIN` | Super administrator access |
| `DATABASE_ADMIN` | Database administration access |
| `ADMIN_FULL_ACCESS` | Full administrative access |
| `SYSTEM_CONFIGURE` | Configure system settings |
| `SYSTEM_MONITOR` | Monitor system health and status |

### Organization Management

| Permission | What it's for |
|---|---|
| `ORG_CREATE` | Create new organizations |
| `ORG_VIEW` | View organization details |
| `ORG_UPDATE` | Update organization details |
| `ORG_DELETE` | Delete organizations |
| `ORG_APPROVE` | Approve organization requests |
| `ORG_REJECT` | Reject organization requests |

### Group Management

| Permission | What it's for |
|---|---|
| `GROUP_VIEW` | View group information and basic details |
| `GROUP_CREATE` | Create new groups |
| `GROUP_EDIT` | Edit group settings and information |
| `GROUP_DELETE` | Delete groups |
| `GROUP_MANAGEMENT` | Full group management access |
| `GROUP_SETTINGS` | Manage group-specific settings |

### Network Management

| Permission | What it's for |
|---|---|
| `NETWORK_VIEW` | View network information |
| `NETWORK_CREATE` | Create new networks |
| `NETWORK_EDIT` | Edit network settings |
| `NETWORK_DELETE` | Delete networks |
| `NETWORK_MANAGEMENT` | Full network management access |

### User & Member Management

| Permission | What it's for |
|---|---|
| `USER_VIEW` | View user information |
| `USER_CREATE` | Create new users |
| `USER_EDIT` | Edit user information |
| `USER_DELETE` | Delete users |
| `USER_MANAGEMENT` | Full user management access |
| `USER_INVITE` | Invite new users |
| `ORG_USER_ASSIGN` | Assign users to organizations (groups/networks) |
| `MEMBER_VIEW` | View group members |
| `MEMBER_INVITE` | Invite new members to group |
| `MEMBER_REMOVE` | Remove members from group |
| `MEMBER_EDIT` | Edit member information |
| `MEMBER_SEARCH` | Search group members |
| `MEMBER_EXPORT` | Export member data |

### Role & Permission Management

| Permission | What it's for |
|---|---|
| `ROLE_VIEW` | View roles and their permissions |
| `ROLE_CREATE` | Create new roles |
| `ROLE_EDIT` | Edit existing roles |
| `ROLE_DELETE` | Delete roles |
| `ROLE_ASSIGNMENT` | Assign roles to users |

### Device Management

| Permission | What it's for |
|---|---|
| `DEVICE_VIEW` | View devices |
| `DEVICE_DEPLOY` | Deploy devices |
| `DEVICE_RECALL` | Recall devices |
| `DEVICE_MAINTAIN` | Maintain devices |
| `DEVICE_UPDATE` | Update device information |
| `DEVICE_DELETE` | Delete devices |
| `DEVICE_CLAIM` | Claim and unclaim devices |

### Site Management

| Permission | What it's for |
|---|---|
| `SITE_VIEW` | View sites |
| `SITE_CREATE` | Create new sites |
| `SITE_UPDATE` | Update site information |
| `SITE_DELETE` | Delete sites |

### Dashboard & Analytics

| Permission | What it's for |
|---|---|
| `DASHBOARD_VIEW` | View dashboard |
| `ANALYTICS_VIEW` | View analytics and reports |
| `ANALYTICS_EXPORT` | Export analytics data |
| `DATA_VIEW` | View data |
| `DATA_EXPORT` | Export data |
| `DATA_COMPARE` | Compare data |
| `DATA_CREATE` | Create data entries |
| `DATA_UPDATE` | Update data entries |

### User Profile

| Permission | What it's for |
|---|---|
| `PROFILE_VIEW` | View own profile |
| `PROFILE_UPDATE` | Update own profile |

### Settings

| Permission | What it's for |
|---|---|
| `SETTINGS_VIEW` | View system and group settings |
| `SETTINGS_EDIT` | Edit system and group settings |

### Content Management

| Permission | What it's for |
|---|---|
| `CONTENT_VIEW` | View content |
| `CONTENT_CREATE` | Create content |
| `CONTENT_EDIT` | Edit content |
| `CONTENT_DELETE` | Delete content |
| `CONTENT_MODERATION` | Moderate content |

### Audit & Reporting

| Permission | What it's for |
|---|---|
| `ACTIVITY_VIEW` | View activity logs |
| `AUDIT_VIEW` | View audit trails |
| `AUDIT_EXPORT` | Export audit data |
| `REPORT_GENERATE` | Generate reports |

### API & Integration

| Permission | What it's for |
|---|---|
| `API_ACCESS` | Access the API |
| `TOKEN_GENERATE` | Generate API tokens |
| `TOKEN_MANAGE` | Manage API tokens |
| `TOKEN_ANALYZE` | Analyze token usage |

### Shipping Management

| Permission | What it's for |
|---|---|
| `SHIPPING_VIEW` | View shipping information |
| `SHIPPING_CREATE` | Create shipping batches |
| `SHIPPING_EDIT` | Edit shipping information |
| `SHIPPING_DELETE` | Delete shipping records |

> **Legacy permissions** such as `CREATE_UPDATE_AND_DELETE_NETWORK_DEVICES`, `VIEW_AIR_QUALITY_FOR_NETWORK`, `MANAGE_GROUP_SETTINGS`, `VIEW_GROUP_DASHBOARD`, `ACCESS_PLATFORM`, and similar `*_NETWORK_*` / `*_GROUP_*` combo permissions still exist on older roles but are being phased out — don't build new features against them; use the equivalent scoped permission above instead (e.g. `GROUP_SETTINGS` instead of `MANAGE_GROUP_SETTINGS`).

The authoritative, up-to-date list is always available live via `GET /permissions`.

## 3. How access is structured

`User → Role (per Group) → Permissions`

- A user is assigned a **Role** within a **Group** (organization). A role carries a fixed list of permissions.
- The same user can hold different roles — and therefore different permissions — in different groups.
- Users flagged `isSuperAdmin` implicitly have every permission everywhere.

## 4. Getting the logged-in user's permissions

**The login response does not include permissions.** After login, call:

```
GET /profile/enhanced
```

Response (key fields under `data`):

```json
{
  "success": true,
  "data": {
    "allPermissions": ["USER_CREATE", "GROUP_VIEW", "..."],
    "systemPermissions": ["..."],
    "groupPermissions": { "<groupId>": ["GROUP_VIEW", "..."] },
    "networkPermissions": { "<networkId>": ["..."] },
    "groupMemberships": ["..."],
    "networkMemberships": ["..."],
    "isSuperAdmin": false,
    "contextSummary": {
      "totalPermissions": 12,
      "groupMemberships": 2,
      "networkMemberships": 0,
      "isSuperAdmin": false
    }
  }
}
```

Use `allPermissions` for a flat check, or `groupPermissions[groupId]` when the user is switching between organizations.

## 5. Checking permissions for a specific group

```
GET /roles/me/groups/:group_id/permissions            // full detail + role info
GET /roles/me/groups/:group_id/permissions/simplified  // lightweight version
```

To check several groups/permissions at once:

```
POST /roles/me/permissions/bulk-check
Body: { "group_ids": ["<id1>", "<id2>"], "permissions": ["GROUP_EDIT", "DEVICE_DEPLOY"] }
```

Response `data`:

```json
{
  "results": [
    {
      "group_id": "...",
      "group_name": "...",
      "role_name": "...",
      "permission_checks": { "GROUP_EDIT": true, "DEVICE_DEPLOY": false },
      "access_control": { "can_edit": true, "can_delete": false, "can_update": true }
    }
  ],
  "summary": { "total_groups": 2, "groups_with_access": 2, "groups_with_errors": 0 }
}
```

## 6. Managing permissions & roles (for admin/settings screens)

```
GET    /permissions                       // list all permissions (paginated)
POST   /permissions                       // create a custom permission: { permission, description, group_id? }
PUT    /permissions/:permission_id        // update description only — name cannot be changed
DELETE /permissions/:permission_id

GET    /roles                             // list roles with their permissions
GET    /roles/:role_id/permissions        // permissions on a role
GET    /roles/:role_id/available_permissions  // permissions not yet on a role
POST   /roles/:role_id/permissions        // assign permission(s) to a role
DELETE /roles/:role_id/permissions/:permission_id  // remove one permission from a role
POST   /roles/:role_id/users              // assign the role to user(s)
```

## 7. Rules & gotchas

- Permission names are globally unique and **cannot be renamed** after creation (only description changes).
- `SYSTEM_ADMIN` / `SUPER_ADMIN` style permissions are platform-level only — they're never assigned on a group role.
- Default/system roles cannot be deleted.
- Always re-fetch `/profile/enhanced` when the user switches their active group, since permissions are per-group.
