// config/global/permissions.js

const generateDescription = (permission) => {
  if (!permission) return "No description available.";
  return (
    permission.toLowerCase().replace(/_/g, " ").charAt(0).toUpperCase() +
    permission.slice(1).toLowerCase().replace(/_/g, " ")
  );
};

// Step 1: Define the single source of truth for all permissions
const PERMISSION_DEFINITIONS = [
  // System & Admin
  { name: "SYSTEM_ADMIN", description: "System administration access" },
  { name: "SUPER_ADMIN", description: "Super administrator access" },
  { name: "DATABASE_ADMIN", description: "Database administration access" },
  { name: "ADMIN_FULL_ACCESS", description: "Full administrative access" },
  { name: "SYSTEM_CONFIGURE", description: "Configure system settings" },
  { name: "SYSTEM_MONITOR", description: "Monitor system health and status" },

  // Organization & Group Management
  { name: "ORG_CREATE", description: "Create new organizations" },
  { name: "ORG_VIEW", description: "View organization details" },
  { name: "ORG_UPDATE", description: "Update organization details" },
  { name: "ORG_DELETE", description: "Delete organizations" },
  { name: "ORG_APPROVE", description: "Approve organization requests" },
  { name: "ORG_REJECT", description: "Reject organization requests" },

  // Group Management
  {
    name: "GROUP_VIEW",
    description: "View group information and basic details",
  },
  { name: "GROUP_CREATE", description: "Create new groups" },
  { name: "GROUP_EDIT", description: "Edit group settings and information" },
  { name: "GROUP_DELETE", description: "Delete groups" },
  { name: "GROUP_MANAGEMENT", description: "Full group management access" },
  { name: "GROUP_SETTINGS", description: "Manage group-specific settings" },

  // Network Management
  { name: "NETWORK_VIEW", description: "View network information" },
  { name: "NETWORK_CREATE", description: "Create new networks" },
  { name: "NETWORK_EDIT", description: "Edit network settings" },
  { name: "NETWORK_DELETE", description: "Delete networks" },
  { name: "NETWORK_MANAGEMENT", description: "Full network management access" },

  // User & Member Management
  { name: "USER_VIEW", description: "View user information" },
  { name: "USER_CREATE", description: "Create new users" },
  { name: "USER_EDIT", description: "Edit user information" },
  { name: "USER_DELETE", description: "Delete users" },
  { name: "USER_MANAGEMENT", description: "Full user management access" },
  { name: "USER_INVITE", description: "Invite new users" },
  {
    name: "ORG_USER_ASSIGN",
    description: "Assign users to organizations (groups/networks)",
  },
  { name: "MEMBER_VIEW", description: "View group members" },
  { name: "MEMBER_INVITE", description: "Invite new members to group" },
  { name: "MEMBER_REMOVE", description: "Remove members from group" },
  { name: "MEMBER_SEARCH", description: "Search group members" },
  { name: "MEMBER_EXPORT", description: "Export member data" },

  // Role & Permission Management
  { name: "ROLE_VIEW", description: "View roles and their permissions" },
  { name: "ROLE_CREATE", description: "Create new roles" },
  { name: "ROLE_EDIT", description: "Edit existing roles" },
  { name: "ROLE_DELETE", description: "Delete roles" },
  { name: "ROLE_ASSIGNMENT", description: "Assign roles to users" },

  // Device Management
  { name: "DEVICE_VIEW", description: "View devices" },
  { name: "DEVICE_DEPLOY", description: "Deploy devices" },
  { name: "DEVICE_RECALL", description: "Recall devices" },
  { name: "DEVICE_MAINTAIN", description: "Maintain devices" },
  { name: "DEVICE_UPDATE", description: "Update device information" },
  { name: "DEVICE_DELETE", description: "Delete devices" },
  { name: "DEVICE_CLAIM", description: "Claim and unclaim devices" },

  // Site Management
  { name: "SITE_VIEW", description: "View sites" },
  { name: "SITE_CREATE", description: "Create new sites" },
  { name: "SITE_UPDATE", description: "Update site information" },
  { name: "SITE_DELETE", description: "Delete sites" },

  // Dashboard & Analytics
  { name: "DASHBOARD_VIEW", description: "View dashboard" },
  { name: "ANALYTICS_VIEW", description: "View analytics and reports" },
  { name: "ANALYTICS_EXPORT", description: "Export analytics data" },
  { name: "DATA_VIEW", description: "View data" },
  { name: "DATA_EXPORT", description: "Export data" },
  { name: "DATA_COMPARE", description: "Compare data" },

  // Settings and Configuration
  { name: "SETTINGS_VIEW", description: "View system and group settings" },
  { name: "SETTINGS_EDIT", description: "Edit system and group settings" },

  // Content Management
  { name: "CONTENT_VIEW", description: "View content" },
  { name: "CONTENT_CREATE", description: "Create content" },
  { name: "CONTENT_EDIT", description: "Edit content" },
  { name: "CONTENT_DELETE", description: "Delete content" },
  { name: "CONTENT_MODERATION", description: "Moderate content" },

  // Audit & Reporting
  { name: "ACTIVITY_VIEW", description: "View activity logs" },
  { name: "AUDIT_VIEW", description: "View audit trails" },
  { name: "AUDIT_EXPORT", description: "Export audit data" },
  { name: "REPORT_GENERATE", description: "Generate reports" },

  // API & Integration
  { name: "API_ACCESS", description: "Access the API" },
  { name: "TOKEN_GENERATE", description: "Generate API tokens" },
  { name: "TOKEN_MANAGE", description: "Manage API tokens" },
  { name: "TOKEN_ANALYZE", description: "Analyze token usage" },

  // Legacy Permissions (to be phased out)
  {
    name: "CREATE_UPDATE_AND_DELETE_NETWORK_DEVICES",
    description: generateDescription(
      "CREATE_UPDATE_AND_DELETE_NETWORK_DEVICES"
    ),
  },
  {
    name: "CREATE_UPDATE_AND_DELETE_NETWORK_SITES",
    description: generateDescription("CREATE_UPDATE_AND_DELETE_NETWORK_SITES"),
  },
  {
    name: "VIEW_AIR_QUALITY_FOR_NETWORK",
    description: generateDescription("VIEW_AIR_QUALITY_FOR_NETWORK"),
  },
  {
    name: "CREATE_UPDATE_AND_DELETE_NETWORK_ROLES",
    description: generateDescription("CREATE_UPDATE_AND_DELETE_NETWORK_ROLES"),
  },
  {
    name: "CREATE_UPDATE_AND_DELETE_NETWORK_USERS",
    description: generateDescription("CREATE_UPDATE_AND_DELETE_NETWORK_USERS"),
  },
  {
    name: "MANAGE_NETWORK_SETTINGS",
    description: generateDescription("MANAGE_NETWORK_SETTINGS"),
  },
  {
    name: "VIEW_NETWORK_DASHBOARD",
    description: generateDescription("VIEW_NETWORK_DASHBOARD"),
  },
  {
    name: "CREATE_UPDATE_AND_DELETE_GROUP_DEVICES",
    description: generateDescription("CREATE_UPDATE_AND_DELETE_GROUP_DEVICES"),
  },
  {
    name: "CREATE_UPDATE_AND_DELETE_GROUP_SITES",
    description: generateDescription("CREATE_UPDATE_AND_DELETE_GROUP_SITES"),
  },
  {
    name: "VIEW_AIR_QUALITY_FOR_GROUP",
    description: generateDescription("VIEW_AIR_QUALITY_FOR_GROUP"),
  },
  {
    name: "CREATE_UPDATE_AND_DELETE_GROUP_ROLES",
    description: generateDescription("CREATE_UPDATE_AND_DELETE_GROUP_ROLES"),
  },
  {
    name: "CREATE_UPDATE_AND_DELETE_GROUP_USERS",
    description: generateDescription("CREATE_UPDATE_AND_DELETE_GROUP_USERS"),
  },
  {
    name: "MANAGE_GROUP_SETTINGS",
    description: generateDescription("MANAGE_GROUP_SETTINGS"),
  },
  {
    name: "VIEW_GROUP_DASHBOARD",
    description: generateDescription("VIEW_GROUP_DASHBOARD"),
  },
  {
    name: "ACCESS_PLATFORM",
    description: generateDescription("ACCESS_PLATFORM"),
  },
];

// Step 2: Derive the constants object for backward compatibility
const PERMISSIONS = PERMISSION_DEFINITIONS.reduce((acc, p) => {
  acc[p.name] = p.name;
  return acc;
}, {});

// Step 2: Create derived constants from the base permissions
const ALL_PERMISSIONS = PERMISSION_DEFINITIONS.map((p) => p.name);

const DEFAULT_ROLE_DEFINITIONS = {
  AIRQO_SUPER_ADMIN: {
    role_name: "AIRQO_SUPER_ADMIN",
    role_code: "AIRQO_SUPER_ADMIN",
    role_description:
      "AirQo Super Administrator with system-wide privileges across all groups and networks",
    permissions: ALL_PERMISSIONS.filter(
      (p) => !["ACCESS_PLATFORM"].includes(p)
    ),
    isSystemWide: true, // Flag to indicate this role grants system-wide access
    grantedIn: "AIRQO_GROUP", // Indicates this role is granted in the AirQo master group
  },
  AIRQO_ADMIN: {
    role_name: "AIRQO_ADMIN",
    role_code: "AIRQO_ADMIN",
    role_description: "Default Administrator role for the AirQo organization",
    permissions: [
      // ORGANIZATION
      PERMISSIONS.ORG_CREATE,
      PERMISSIONS.ORG_VIEW,
      PERMISSIONS.ORG_UPDATE,
      PERMISSIONS.ORG_DELETE,
      PERMISSIONS.ORG_APPROVE,
      PERMISSIONS.ORG_REJECT,
      // GROUP
      PERMISSIONS.GROUP_VIEW,
      PERMISSIONS.GROUP_CREATE,
      PERMISSIONS.GROUP_EDIT,
      PERMISSIONS.GROUP_DELETE,
      PERMISSIONS.GROUP_MANAGEMENT,
      // USER & MEMBER
      PERMISSIONS.USER_MANAGEMENT,
      PERMISSIONS.USER_INVITE,
      PERMISSIONS.ORG_USER_ASSIGN,
      // ROLE
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.ROLE_CREATE,
      PERMISSIONS.ROLE_EDIT,
      PERMISSIONS.ROLE_DELETE,
      PERMISSIONS.ROLE_ASSIGNMENT,
      // DEVICE, SITE, ANALYTICS, SETTINGS
      ...Object.values(PERMISSIONS).filter((p) =>
        [
          "DEVICE_",
          "SITE_",
          "DASHBOARD_",
          "ANALYTICS_",
          "DATA_",
          "SETTINGS_",
        ].some((prefix) => p.startsWith(prefix))
      ),
    ].filter((value, index, self) => self.indexOf(value) === index), // Ensure unique
  },
  AIRQO_DEFAULT_USER: {
    role_name: "AIRQO_DEFAULT_USER",
    role_code: "AIRQO_DEFAULT_USER",
    role_description: "Default role for new AirQo users",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DATA_VIEW,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.DATA_EXPORT,
      PERMISSIONS.SITE_VIEW,
      PERMISSIONS.DEVICE_VIEW,
      PERMISSIONS.DEVICE_CLAIM,
      PERMISSIONS.DEVICE_DEPLOY,
      PERMISSIONS.NETWORK_VIEW,
      PERMISSIONS.API_ACCESS,
      PERMISSIONS.TOKEN_GENERATE,
    ],
  },
  DEFAULT_MEMBER: {
    role_name: "DEFAULT_MEMBER",
    role_code: "DEFAULT_MEMBER",
    role_description: "Default Member role for an organization",
    permissions: [
      PERMISSIONS.GROUP_VIEW,
      PERMISSIONS.MEMBER_VIEW,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DATA_VIEW,
      PERMISSIONS.DEVICE_VIEW,
      PERMISSIONS.SITE_VIEW,
    ],
  },
  TECHNICIAN: {
    role_name: "TECHNICIAN",
    role_code: "TECHNICIAN",
    role_description: "Technician role with device management permissions",
    permissions: [
      PERMISSIONS.GROUP_VIEW,
      PERMISSIONS.DEVICE_VIEW,
      PERMISSIONS.DEVICE_DEPLOY,
      PERMISSIONS.DEVICE_MAINTAIN,
      PERMISSIONS.SITE_VIEW,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DATA_VIEW,
      PERMISSIONS.MEMBER_VIEW,
    ],
  },
  ANALYST: {
    role_name: "ANALYST",
    role_code: "ANALYST",
    role_description: "Analyst role with data analysis permissions",
    permissions: [
      PERMISSIONS.GROUP_VIEW,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DATA_VIEW,
      PERMISSIONS.DATA_EXPORT,
      PERMISSIONS.DATA_COMPARE,
      PERMISSIONS.DEVICE_VIEW,
      PERMISSIONS.SITE_VIEW,
      PERMISSIONS.MEMBER_VIEW,
    ],
  },
  DEVELOPER: {
    role_name: "DEVELOPER",
    role_code: "DEVELOPER",
    role_description: "Developer role with API access permissions",
    permissions: [
      PERMISSIONS.GROUP_VIEW,
      PERMISSIONS.API_ACCESS,
      PERMISSIONS.TOKEN_GENERATE,
      PERMISSIONS.TOKEN_MANAGE,
      PERMISSIONS.DATA_VIEW,
      PERMISSIONS.DATA_EXPORT,
      PERMISSIONS.DEVICE_VIEW,
      PERMISSIONS.SITE_VIEW,
      PERMISSIONS.DASHBOARD_VIEW,
    ],
  },
  VIEWER: {
    role_name: "VIEWER",
    role_code: "VIEWER",
    role_description: "Viewer role with read-only access",
    permissions: [
      PERMISSIONS.GROUP_VIEW,
      PERMISSIONS.DEVICE_VIEW,
      PERMISSIONS.SITE_VIEW,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DATA_VIEW,
      PERMISSIONS.MEMBER_VIEW,
    ],
  },
};

const DEFAULTS = {
  SUPER_ADMIN: DEFAULT_ROLE_DEFINITIONS.AIRQO_SUPER_ADMIN.permissions,
  DEFAULT_ADMIN: DEFAULT_ROLE_DEFINITIONS.AIRQO_ADMIN.permissions,
  DEFAULT_USER: DEFAULT_ROLE_DEFINITIONS.AIRQO_DEFAULT_USER.permissions,
  DEFAULT_MEMBER: DEFAULT_ROLE_DEFINITIONS.DEFAULT_MEMBER.permissions,
};

const DEFAULT_NETWORK_MEMBER_PERMISSIONS = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.DATA_VIEW,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.DATA_EXPORT,
  PERMISSIONS.SITE_VIEW,
  PERMISSIONS.DEVICE_VIEW,
  PERMISSIONS.DEVICE_CLAIM,
  PERMISSIONS.DEVICE_DEPLOY,
  PERMISSIONS.NETWORK_VIEW,
  PERMISSIONS.API_ACCESS,
  PERMISSIONS.TOKEN_GENERATE,
];

const DEFAULT_MEMBER_PERMISSIONS = [
  PERMISSIONS.GROUP_VIEW,
  PERMISSIONS.MEMBER_VIEW,
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.DATA_VIEW,
  PERMISSIONS.DEVICE_VIEW,
  PERMISSIONS.SITE_VIEW,
];

// Deprecated roles that should be cleaned up (must match Role.role_name exactly)
const DEPRECATED_ROLE_NAMES = Object.freeze([
  "AIRQO_DEFAULT_PRODUCTION",
  "AIRQO_AIRQO_ADMIN",
  "AIRQO_DEFAULT_STAGING",
]);

// Step 3: Define system-wide constants related to authentication
const AUTH_CONSTANTS = {
  // Date until which initial logins will receive a 30-day token to support mobile app transition.
  TOKEN_TRANSITION_CUTOFF_DATE: "2025-10-15T00:00:00Z",
  // Default token expiration period after the transition cutoff date.
  DEFAULT_TOKEN_EXPIRATION: "24h",
};

// Step 4: Assemble the final export object
const permissionsExport = {
  ...PERMISSIONS,
  ALL: ALL_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_DEFINITIONS,
  DEFAULTS,
  DEFAULT_NETWORK_MEMBER_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  DEPRECATED_ROLE_NAMES,
  // do not mix AUTH constants into the flat "permissions" bag
};

// Step 5: System Administration Constants
const SYSTEM_ADMIN_CONSTANTS = {
  // The master AirQo group ID - users with admin roles in this group have system-wide privileges
  AIRQO_GROUP_ID: "652ee1f0c619ed8f6e08eec2", // Your AirQo group ID from the profile

  // Role names that grant system-wide administrative privileges
  SYSTEM_ADMIN_ROLE_NAMES: [
    "AIRQO_SUPER_ADMIN",
    "AIRQO_ADMIN",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
  ],

  // Role codes that grant system-wide administrative privileges
  SYSTEM_ADMIN_ROLE_CODES: [
    "AIRQO_SUPER_ADMIN",
    "AIRQO_ADMIN",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
  ],

  // User types in the AirQo group that grant system-wide privileges
  SYSTEM_ADMIN_USER_TYPES: ["admin", "super_admin"],

  // Permissions that grant system-wide administrative access
  SYSTEM_ADMIN_PERMISSIONS: [
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.SUPER_ADMIN,
    PERMISSIONS.DATABASE_ADMIN,
  ],

  // Groups that grant system-wide admin privileges to their admins
  SYSTEM_ADMIN_GROUPS: [
    "652ee1f0c619ed8f6e08eec2", // AirQo group
    // Add other system groups here if needed
  ],
};

// Step 6: RBAC Helper Constants
const RBAC_CONSTANTS = {
  // Cache TTL for permission checks (in milliseconds)
  PERMISSION_CACHE_TTL: 5 * 60 * 1000, // 5 minutes

  // Maximum number of group memberships to check
  MAX_GROUP_MEMBERSHIPS: 50,

  // Default context types
  CONTEXT_TYPES: {
    GROUP: "group",
    NETWORK: "network",
    SYSTEM: "system",
  },

  // Permission check strategies
  PERMISSION_STRATEGIES: {
    ANY: false, // User needs ANY of the specified permissions
    ALL: true, // User needs ALL of the specified permissions
  },
};

module.exports = {
  // Back-compat nested export
  PERMISSIONS: {
    ...PERMISSIONS,
    ALL: ALL_PERMISSIONS,
    PERMISSION_DEFINITIONS,
    DEFAULT_ROLE_DEFINITIONS,
    DEFAULTS,
    DEFAULT_NETWORK_MEMBER_PERMISSIONS,
    DEFAULT_MEMBER_PERMISSIONS,
    DEPRECATED_ROLE_NAMES,
  },

  // New flat export
  ...permissionsExport,

  // System administration constants
  SYSTEM_ADMIN_CONSTANTS,
  RBAC_CONSTANTS,

  // Individual constants for easy access
  AIRQO_GROUP_ID: SYSTEM_ADMIN_CONSTANTS.AIRQO_GROUP_ID,
  SYSTEM_ADMIN_ROLE_NAMES: SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_ROLE_NAMES,
  SYSTEM_ADMIN_ROLE_CODES: SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_ROLE_CODES,
  SYSTEM_ADMIN_USER_TYPES: SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_USER_TYPES,
  SYSTEM_ADMIN_PERMISSIONS: SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_PERMISSIONS,
  SYSTEM_ADMIN_GROUPS: SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_GROUPS,

  // Auth constants
  AUTH: AUTH_CONSTANTS,

  // Helper functions for permission checking
  HELPERS: {
    /**
     * Check if a role name indicates system admin privileges
     */
    isSystemAdminRole: (roleName) => {
      return SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_ROLE_NAMES.includes(roleName);
    },

    /**
     * Check if a user type in AirQo group indicates system admin privileges
     */
    isSystemAdminUserType: (userType) => {
      return SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_USER_TYPES.includes(userType);
    },

    /**
     * Check if a group ID grants system admin privileges to its admins
     */
    isSystemAdminGroup: (groupId) => {
      return SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_GROUPS.includes(
        groupId?.toString()
      );
    },

    /**
     * Check if a permission grants system admin access
     */
    isSystemAdminPermission: (permission) => {
      return SYSTEM_ADMIN_CONSTANTS.SYSTEM_ADMIN_PERMISSIONS.includes(
        permission
      );
    },
    /**
     * Composite check: only allow system-wide bypass for super-admins in AirQo group.
     */
    isSystemWideBypass: ({
      roleName,
      roleCode,
      userType,
      groupId,
      permissions = [],
    }) => {
      const hasRole =
        module.exports.HELPERS.isSystemAdminRole(roleName) ||
        module.exports.HELPERS.isSystemAdminRole(roleCode);
      const hasPerm = permissions.some((p) =>
        module.exports.HELPERS.isSystemAdminPermission(p)
      );
      const inAirQo = module.exports.HELPERS.isSystemAdminGroup(groupId);
      const isSu = module.exports.HELPERS.isSystemAdminUserType(userType);
      return inAirQo && isSu && (hasRole || hasPerm);
    },
  },
};
