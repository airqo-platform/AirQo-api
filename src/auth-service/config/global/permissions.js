// config/global/permissions.js
module.exports = {
  // Organization request permissions
  ORG_REQUEST_PERMISSIONS: {
    LIST: "LIST_ORGANIZATION_REQUESTS",
    APPROVE: "APPROVE_ORGANIZATION_REQUEST",
    REJECT: "REJECT_ORGANIZATION_REQUEST",
    VIEW: "VIEW_ORGANIZATION_REQUEST",
  },

  // Group permissions
  GROUP_PERMISSIONS: {
    VIEW_DASHBOARD: "VIEW_GROUP_DASHBOARD",
    MANAGE_MEMBERS: "MANAGE_GROUP_MEMBERS",
    MANAGE_SETTINGS: "MANAGE_GROUP_SETTINGS",
    VIEW_MEMBERS: "VIEW_GROUP_MEMBERS",
  },
  DEFAULT_NETWORK_MEMBER_PERMISSIONS: ["READ_NETWORK", "UPDATE_NETWORK"],

  // System & Admin
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  DATABASE_ADMIN: "DATABASE_ADMIN",
  ADMIN_FULL_ACCESS: "ADMIN_FULL_ACCESS",
  SUPER_ADMIN_ACTIONS: "SUPER_ADMIN_ACTIONS",
  SYSTEM_CONFIGURE: "SYSTEM_CONFIGURE",
  SYSTEM_MONITOR: "SYSTEM_MONITOR",

  // Organization Management
  ORG_CREATE: "ORG_CREATE",
  ORG_VIEW: "ORG_VIEW",
  ORG_UPDATE: "ORG_UPDATE",
  ORG_DELETE: "ORG_DELETE",
  ORG_APPROVE: "ORG_APPROVE",
  ORG_REJECT: "ORG_REJECT",

  // Group Management
  GROUP_VIEW: "GROUP_VIEW",
  GROUP_CREATE: "GROUP_CREATE",
  GROUP_EDIT: "GROUP_EDIT",
  GROUP_DELETE: "GROUP_DELETE",
  GROUP_MANAGEMENT: "GROUP_MANAGEMENT",
  GROUP_SETTINGS: "GROUP_SETTINGS",

  // User & Member Management
  USER_VIEW: "USER_VIEW",
  USER_CREATE: "USER_CREATE",
  USER_EDIT: "USER_EDIT",
  USER_DELETE: "USER_DELETE",
  USER_MANAGEMENT: "USER_MANAGEMENT",
  USER_INVITE: "USER_INVITE",
  MEMBER_VIEW: "MEMBER_VIEW",
  MEMBER_INVITE: "MEMBER_INVITE",
  MEMBER_REMOVE: "MEMBER_REMOVE",
  MEMBER_SEARCH: "MEMBER_SEARCH",
  MEMBER_EXPORT: "MEMBER_EXPORT",

  // Role & Permission Management
  ROLE_VIEW: "ROLE_VIEW",
  ROLE_CREATE: "ROLE_CREATE",
  ROLE_EDIT: "ROLE_EDIT",
  ROLE_DELETE: "ROLE_DELETE",
  ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT",

  // Device Management
  DEVICE_VIEW: "DEVICE_VIEW",
  DEVICE_DEPLOY: "DEVICE_DEPLOY",
  DEVICE_RECALL: "DEVICE_RECALL",
  DEVICE_MAINTAIN: "DEVICE_MAINTAIN",
  DEVICE_UPDATE: "DEVICE_UPDATE",
  DEVICE_DELETE: "DEVICE_DELETE",

  // Site Management
  SITE_VIEW: "SITE_VIEW",
  SITE_CREATE: "SITE_CREATE",
  SITE_UPDATE: "SITE_UPDATE",
  SITE_DELETE: "SITE_DELETE",

  // Dashboard & Analytics
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  ANALYTICS_VIEW: "ANALYTICS_VIEW",
  DATA_VIEW: "DATA_VIEW",
  DATA_EXPORT: "DATA_EXPORT",
  DATA_COMPARE: "DATA_COMPARE",

  // API & Integration
  API_ACCESS: "API_ACCESS",
  TOKEN_GENERATE: "TOKEN_GENERATE",
  TOKEN_MANAGE: "TOKEN_MANAGE",

  // Network Management
  NETWORK_VIEW: "NETWORK_VIEW",
  NETWORK_CREATE: "NETWORK_CREATE",
  NETWORK_EDIT: "NETWORK_EDIT",
  NETWORK_DELETE: "NETWORK_DELETE",
  NETWORK_MANAGEMENT: "NETWORK_MANAGEMENT",

  // Legacy Permissions (to be phased out)
  ACCESS_PLATFORM: "ACCESS_PLATFORM",
};
