const mongoose = require("mongoose");

const staticLists = {
  SUPER_ADMIN_EMAIL_ALLOWLIST: process.env.SUPER_ADMIN_EMAIL_ALLOWLIST
    ? process.env.SUPER_ADMIN_EMAIL_ALLOWLIST.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  VALID_ORGANIZATION_TYPES: [
    "academic",
    "government",
    "ngo",
    "private",
    "other",
  ],
  SUPER_ADMIN_PERMISSIONS: process.env.SUPER_ADMIN_PERMISSIONS
    ? process.env.SUPER_ADMIN_PERMISSIONS.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  DEFAULT_MEMBER_PERMISSIONS: process.env.DEFAULT_MEMBER_PERMISSIONS
    ? process.env.DEFAULT_MEMBER_PERMISSIONS.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  TENANTS: process.env.TENANTS
    ? process.env.TENANTS.split(",").filter((value) => value.trim() !== "")
    : [],
  NETWORKS: process.env.NETWORKS
    ? process.env.NETWORKS.split(",").filter((value) => value.trim() !== "")
    : [],
};
module.exports = staticLists;
