const UserSchema = require("../models/User");
const AccessTokenSchema = require("../models/AccessToken");
const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");

const UserModel = (tenant) => {
  try {
    let users = mongoose.model("users");
    return users;
  } catch (error) {
    let users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};

const AccessTokenModel = (tenant) => {
  try {
    let tokens = mongoose.model("access_token");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(tenant, "access_token", AccessTokenSchema);
    return tokens;
  }
};

const controlAccess = {
  /**access tokens */
  updateAccessToken: async () => {
    try {
      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
    } catch (error) {}
  },

  deleteAccessToken: async () => {
    try {
      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
    } catch (error) {}
  },

  verifyAccessToken: async () => {
    try {
      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
    } catch (error) {}
  },

  listAccessTokens: async () => {
    try {
      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
    } catch (error) {}
  },

  /** roles */
  listRole: async () => {},

  deleteRole: async () => {},

  updateRole: async () => {},

  createRole: async () => {},

  /** permissions */
  listPermission: async () => {},

  deletePermission: async () => {},

  updatePermission: async () => {},

  createPermission: async () => {},

  /** RolePermissions */
  listRolePermission: async () => {},

  deleteRolePermission: async () => {},

  updateRolePermission: async () => {},

  createRolePermission: async () => {},

  /** UserPermissions */
  listUserPermission: async () => {},

  deleteUserPermission: async () => {},

  updateUserPermission: async () => {},

  createUserPermission: async () => {},

  /** UserRole */
  listUserRole: async () => {},

  deleteUserRole: async () => {},

  updateUserRole: async () => {},

  createUserRole: async () => {},
};

module.exports = controlAccess;
