const mongoose = require("mongoose");

const staticLists = {
  SUPER_ADMIN_EMAIL_ALLOWLIST: process.env.SUPER_ADMIN_EMAIL_ALLOWLIST
    ? process.env.SUPER_ADMIN_EMAIL_ALLOWLIST.split(",")
        .map((email) => email.trim())
        .filter((email) => email !== "")
    : [],
  VALID_ORGANIZATION_TYPES: [
    "academic",
    "government",
    "ngo",
    "private",
    "other",
  ],
  SUPER_ADMIN_PERMISSIONS: process.env.SUPER_ADMIN_PERMISSIONS
    ? process.env.SUPER_ADMIN_PERMISSIONS.split(",")
        .map((value) => value.trim())
        .filter((value) => value !== "")
    : [],
  DEFAULT_MEMBER_PERMISSIONS: process.env.DEFAULT_MEMBER_PERMISSIONS
    ? process.env.DEFAULT_MEMBER_PERMISSIONS.split(",")
        .map((value) => value.trim())
        .filter((value) => value !== "")
    : [],
  TENANTS: process.env.TENANTS
    ? process.env.TENANTS.split(",")
        .map((value) => value.trim())
        .filter((value) => value !== "")
    : [],
  NETWORKS: process.env.NETWORKS
    ? process.env.NETWORKS.split(",")
        .map((value) => value.trim())
        .filter((value) => value !== "")
    : [],
};
module.exports = staticLists;
