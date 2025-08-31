// services/atf.service.js
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- abstract-token-factory`
);

const TOKEN_STRATEGIES = {
  LEGACY: "legacy",
  STANDARD: "standard",
  COMPRESSED: "compressed",
  HASH_BASED: "hash_based",
  ROLE_ONLY: "role_only",
  OPTIMIZED_HASH: "optimized_hash",
  ULTRA_COMPRESSED: "ultra_compressed",
};

class AbstractTokenFactory {
  constructor(tenant = "airqo") {
    this.tenant = tenant;
    this.strategies = new Map();
    this.permissionCache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    this.initializeStrategies();
  }

  initializeStrategies() {
    this.strategies.set(TOKEN_STRATEGIES.LEGACY, new LegacyTokenStrategy());
    this.strategies.set(TOKEN_STRATEGIES.STANDARD, new StandardTokenStrategy());
    // ... other strategies would be added here
  }

  async createToken(user, strategy = TOKEN_STRATEGIES.STANDARD, options = {}) {
    try {
      const tokenStrategy = this.strategies.get(strategy);
      if (!tokenStrategy) {
        throw new Error(`Unknown token strategy: ${strategy}`);
      }

      console.log(`🔐 Creating token using strategy: ${strategy}`);
      return await tokenStrategy.generateToken(user, this.tenant, options);
    } catch (error) {
      logger.error(
        `Error creating token with strategy ${strategy}: ${error.message}`
      );
      throw error;
    }
  }

  async decodeToken(token) {
    try {
      const cleanToken = token.replace("JWT ", "");
      const decoded = jwt.verify(cleanToken, constants.JWT_SECRET);

      const strategy = this.detectTokenStrategy(decoded);
      const tokenStrategy = this.strategies.get(strategy);

      if (!tokenStrategy) {
        throw new Error(`Cannot decode token - unknown strategy: ${strategy}`);
      }

      console.log(`🔓 Decoding token using strategy: ${strategy}`);
      const decodedUser = await tokenStrategy.decodeToken(decoded, this.tenant);

      return {
        ...decodedUser,
        _tokenStrategy: strategy,
        _decodedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error decoding token: ${error.message}`);
      throw error;
    }
  }

  detectTokenStrategy(decoded) {
    if (!decoded || typeof decoded !== "object") {
      throw new Error("Invalid token payload structure");
    }

    if (
      decoded.username &&
      (decoded.groupPermissions || decoded.networkPermissions)
    ) {
      return TOKEN_STRATEGIES.STANDARD;
    }

    return TOKEN_STRATEGIES.LEGACY;
  }
}

class TokenStrategy {
  async generateToken(user, tenant, options) {
    throw new Error("generateToken method must be implemented");
  }

  async decodeToken(decoded, tenant) {
    throw new Error("decodeToken method must be implemented");
  }
}

class LegacyTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const rbacService = new EnhancedRBACService(tenant);

      const permissions = await rbacService.getUserPermissions(user._id);
      const roles = [user.userType, user.privilege];

      if (user.group_roles && user.group_roles.length > 0) {
        user.group_roles.forEach((groupRole) => {
          if (groupRole.role && groupRole.role.role_name) {
            roles.push(groupRole.role.role_name);
          }
        });
      }

      const tokenPayload = {
        _id: user._id,
        username: user.userName,
        roles: [...new Set(roles)],
        permissions: permissions,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userType: user.userType,
        organization: user.organization,
        long_organization: user.long_organization,
        privilege: user.privilege,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };

      return jwt.sign(tokenPayload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating legacy token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    return {
      ...decoded,
      userId: decoded._id,
    };
  }
}

class StandardTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const rbacService = new EnhancedRBACService(tenant);

      const permissionData = await rbacService.getUserPermissionsByContext(
        user._id
      );

      const allPermissions = [
        ...permissionData.systemPermissions,
        ...Object.values(permissionData.groupPermissions).flat(),
        ...Object.values(permissionData.networkPermissions).flat(),
      ];

      const tokenPayload = {
        _id: user._id,
        username: user.userName,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        organization: user.organization,
        systemPermissions: permissionData.systemPermissions,
        groupPermissions: permissionData.groupPermissions,
        networkPermissions: permissionData.networkPermissions,
        groupMemberships: permissionData.groupMemberships,
        networkMemberships: permissionData.networkMemberships,
        allPermissions: [...new Set(allPermissions)],
        isSuperAdmin: permissionData.isSuperAdmin,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };

      return jwt.sign(tokenPayload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating standard token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    return {
      ...decoded,
      userId: decoded._id,
      permissions: decoded.allPermissions || decoded.systemPermissions || [],
    };
  }
}

module.exports = {
  AbstractTokenFactory,
  TOKEN_STRATEGIES,
};
