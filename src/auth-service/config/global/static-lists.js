const mongoose = require("mongoose");

const staticLists = {
  SUPER_ADMIN_PERMISSIONS: process.env.SUPER_ADMIN_PERMISSIONS
    ? process.env.SUPER_ADMIN_PERMISSIONS.split(",").filter(
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
