// services/atf.service.js
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const zlib = require("zlib");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- abstract-token-factory`
);

const TOKEN_STRATEGIES = {
  LEGACY: "legacy",
  STANDARD: "standard",
  ULTRA_COMPRESSED: "ultra_compressed",
  COMPRESSED: "compressed",
  HASH_BASED: "hash_based",
  ROLE_ONLY: "role_only",
  OPTIMIZED_HASH: "optimized_hash",
  BIT_FLAGS: "bit_flags",
  OPTIMIZED_BIT_FLAGS: "optimized_bit_flags",
  OPTIMIZED_ROLE_ONLY: "optimized_role_only",
};

class AbstractTokenFactory {
  constructor(tenant = "airqo") {
    this.tenant = tenant;
    this.strategies = new Map();
    this.permissionCache = new Map();
    this.hashCounter = 0;
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    this.initializeStrategies();
  }

  initializeStrategies() {
    this.strategies.set(TOKEN_STRATEGIES.LEGACY, new LegacyTokenStrategy());
    this.strategies.set(TOKEN_STRATEGIES.STANDARD, new StandardTokenStrategy());
    this.strategies.set(
      TOKEN_STRATEGIES.ULTRA_COMPRESSED,
      new UltraCompressedTokenStrategy()
    );
    this.strategies.set(
      TOKEN_STRATEGIES.COMPRESSED,
      new CompressedTokenStrategy()
    );
    this.strategies.set(
      TOKEN_STRATEGIES.HASH_BASED,
      new HashBasedTokenStrategy(this.permissionCache)
    );
    this.strategies.set(
      TOKEN_STRATEGIES.ROLE_ONLY,
      new RoleOnlyTokenStrategy()
    );
    this.strategies.set(
      TOKEN_STRATEGIES.OPTIMIZED_HASH,
      new OptimizedHashTokenStrategy(this.permissionCache, this)
    );
    this.strategies.set(
      TOKEN_STRATEGIES.BIT_FLAGS,
      new BitFlagsTokenStrategy()
    );
    this.strategies.set(
      TOKEN_STRATEGIES.OPTIMIZED_BIT_FLAGS,
      new OptimizedBitFlagsTokenStrategy()
    );
    this.strategies.set(
      TOKEN_STRATEGIES.OPTIMIZED_ROLE_ONLY,
      new OptimizedRoleOnlyTokenStrategy()
    );
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

    if (decoded.oh) return TOKEN_STRATEGIES.OPTIMIZED_HASH;
    if (decoded.sf) return TOKEN_STRATEGIES.OPTIMIZED_BIT_FLAGS;
    if (decoded.os === 1) return TOKEN_STRATEGIES.OPTIMIZED_ROLE_ONLY;
    if (decoded.d) return TOKEN_STRATEGIES.ULTRA_COMPRESSED;
    if (decoded.ph) return TOKEN_STRATEGIES.HASH_BASED;
    if (decoded.spf) return TOKEN_STRATEGIES.BIT_FLAGS;
    if (decoded.rs) return TOKEN_STRATEGIES.ROLE_ONLY;
    if (decoded.u && decoded.e && !decoded.username)
      return TOKEN_STRATEGIES.COMPRESSED;

    if (
      decoded.username &&
      (decoded.groupPermissions || decoded.networkPermissions)
    ) {
      return TOKEN_STRATEGIES.STANDARD;
    }

    // Fallback for older standard tokens
    if (decoded.username && decoded.allPermissions) {
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
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);

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
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);

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

class UltraCompressedTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsForLogin(
        user._id
      );

      // Use shorter keys for smaller payload
      const payload = {
        id: user._id,
        em: user.email,
        f: user.firstName,
        l: user.lastName,
        p: permissionData.allPermissions,
        sp: permissionData.systemPermissions,
        gp: permissionData.groupPermissions,
        np: permissionData.networkPermissions,
        gm: permissionData.groupMemberships,
        nm: permissionData.networkMemberships,
        sa: permissionData.isSuperAdmin,
      };

      const stringifiedPayload = JSON.stringify(payload);
      const compressed = zlib
        .deflateSync(stringifiedPayload)
        .toString("base64");

      const tokenPayload = { d: compressed };
      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };

      return jwt.sign(tokenPayload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating ultra compressed token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    try {
      const compressed = Buffer.from(decoded.d, "base64");
      const decompressed = zlib.inflateSync(compressed).toString();
      const payload = JSON.parse(decompressed);

      return {
        ...payload,
        _id: payload.id,
        userId: payload.id,
        email: payload.em,
        firstName: payload.f,
        lastName: payload.l,
        permissions: payload.p,
        systemPermissions: payload.sp,
        groupPermissions: payload.gp,
        networkPermissions: payload.np,
        groupMemberships: payload.gm,
        networkMemberships: payload.nm,
        isSuperAdmin: payload.sa,
      };
    } catch (error) {
      logger.error(`Error decoding ultra compressed token: ${error.message}`);
      throw error;
    }
  }
}

class CompressedTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsForLogin(
        user._id
      );

      const payload = {
        id: user._id,
        u: user.userName,
        e: user.email,
        t: user.userType,
        v: user.verified,
        p: permissionData.allPermissions,
        sp: permissionData.systemPermissions,
        gp: permissionData.groupPermissions,
        np: permissionData.networkPermissions,
        gm: permissionData.groupMemberships,
        nm: permissionData.networkMemberships,
        sa: permissionData.isSuperAdmin,
        fn: user.firstName,
        ln: user.lastName,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };
      return jwt.sign(payload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating compressed token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    return {
      _id: decoded.id,
      userId: decoded.id,
      userName: decoded.u,
      email: decoded.e,
      userType: decoded.t,
      verified: decoded.v,
      permissions: decoded.p,
      systemPermissions: decoded.sp,
      groupPermissions: decoded.gp,
      networkPermissions: decoded.np,
      groupMemberships: decoded.gm,
      networkMemberships: decoded.nm,
      isSuperAdmin: decoded.sa,
      firstName: decoded.fn,
      lastName: decoded.ln,
    };
  }
}

class HashBasedTokenStrategy extends TokenStrategy {
  constructor(permissionCache) {
    super();
    this.permissionCache = permissionCache;
  }

  async generateToken(user, tenant, options) {
    try {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsForLogin(
        user._id
      );
      const permissionHash = `${user._id}_${Date.now()}`.substring(0, 16);

      this.permissionCache.set(permissionHash, permissionData);

      const payload = {
        _id: user._id,
        ph: permissionHash,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };
      return jwt.sign(payload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating hash-based token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    const permissionData = this.permissionCache.get(decoded.ph);
    if (!permissionData) {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const freshData = await rbacService.getUserPermissionsForLogin(
        decoded._id
      );
      return { userId: decoded._id, ...freshData };
    }
    return { userId: decoded._id, ...permissionData };
  }
}

class RoleOnlyTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      const payload = {
        _id: user._id,
        rs: Date.now(), // Role snapshot timestamp
      };
      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };
      return jwt.sign(payload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating role-only token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    const RBACService = require("@services/rbac.service");
    const rbacService = new RBACService(tenant);
    const permissionData = await rbacService.getUserPermissionsForLogin(
      decoded._id
    );
    const UserModel = require("@models/User");
    const user = await UserModel(tenant).findById(decoded._id).lean();
    return { ...user, ...permissionData, userId: decoded._id };
  }
}

class OptimizedHashTokenStrategy extends TokenStrategy {
  constructor(permissionCache, factoryInstance) {
    super();
    this.permissionCache = permissionCache;
    this.factoryInstance = factoryInstance;
  }

  generateShortHash(userId) {
    this.factoryInstance.hashCounter =
      (this.factoryInstance.hashCounter + 1) % 10000;
    return `${userId.toString().slice(-4)}${this.factoryInstance.hashCounter
      .toString()
      .padStart(4, "0")}`;
  }

  async generateToken(user, tenant, options) {
    try {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsForLogin(
        user._id
      );
      const hash = this.generateShortHash(user._id);

      this.permissionCache.set(hash, {
        ...permissionData,
        user: {
          userName: user.userName,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
        },
      });

      const payload = {
        id: user._id,
        oh: hash,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };
      return jwt.sign(payload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating optimized hash token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    const cachedData = this.permissionCache.get(decoded.oh);
    if (!cachedData) {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const freshData = await rbacService.getUserPermissionsForLogin(
        decoded.id
      );
      return { userId: decoded.id, ...freshData };
    }
    return { userId: decoded.id, ...cachedData.user, ...cachedData };
  }
}

class BitFlagsTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsForLogin(
        user._id
      );

      const payload = {
        id: user._id,
        spf: JSON.stringify(permissionData.systemPermissions),
        gpf: JSON.stringify(permissionData.groupPermissions),
        npf: JSON.stringify(permissionData.networkPermissions),
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };
      return jwt.sign(payload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating bit flags token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    const systemPermissions = JSON.parse(decoded.spf || "[]");
    const groupPermissions = JSON.parse(decoded.gpf || "{}");
    const networkPermissions = JSON.parse(decoded.npf || "{}");
    const allPermissions = [
      ...systemPermissions,
      ...Object.values(groupPermissions).flat(),
      ...Object.values(networkPermissions).flat(),
    ];

    return {
      userId: decoded.id,
      permissions: [...new Set(allPermissions)],
      systemPermissions,
      groupPermissions,
      networkPermissions,
    };
  }
}

class OptimizedRoleOnlyTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      const payload = {
        id: user._id,
        os: 1, // Optimized strategy marker
      };
      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };
      return jwt.sign(payload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(
        `Error generating optimized role-only token: ${error.message}`
      );
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    const RBACService = require("@services/rbac.service");
    const rbacService = new RBACService(tenant);
    const permissionData = await rbacService.getUserPermissionsForLogin(
      decoded.id
    );
    const UserModel = require("@models/User");
    const user = await UserModel(tenant).findById(decoded.id).lean();
    return { ...user, ...permissionData, userId: decoded.id };
  }
}

const getAllPermissions = () => {
  // This is a simplified version. In a real app, this would come from a database or a shared config.
  return [
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "DATABASE_ADMIN",
    "ORG_CREATE",
    "ORG_VIEW",
    "ORG_UPDATE",
    "ORG_DELETE",
    "ORG_APPROVE",
    "ORG_REJECT",
    "GROUP_VIEW",
    "GROUP_CREATE",
    "GROUP_EDIT",
    "GROUP_DELETE",
    "GROUP_MANAGEMENT",
    "USER_VIEW",
    "USER_CREATE",
    "USER_EDIT",
    "USER_DELETE",
    "USER_MANAGEMENT",
    "USER_INVITE",
    "MEMBER_VIEW",
    "MEMBER_INVITE",
    "MEMBER_REMOVE",
    "MEMBER_SEARCH",
    "MEMBER_EXPORT",
    "ROLE_VIEW",
    "ROLE_CREATE",
    "ROLE_EDIT",
    "ROLE_DELETE",
    "ROLE_ASSIGNMENT",
    "DEVICE_VIEW",
    "DEVICE_DEPLOY",
    "DEVICE_CLAIM",
    "DEVICE_RECALL",
    "DEVICE_MAINTAIN",
    "DEVICE_UPDATE",
    "DEVICE_DELETE",
    "SITE_VIEW",
    "SITE_CREATE",
    "SITE_UPDATE",
    "SITE_DELETE",
    "DASHBOARD_VIEW",
    "ANALYTICS_VIEW",
    "ANALYTICS_EXPORT",
    "DATA_VIEW",
    "DATA_EXPORT",
    "DATA_COMPARE",
    "SETTINGS_VIEW",
    "SETTINGS_EDIT",
    "GROUP_SETTINGS",
    "CONTENT_VIEW",
    "CONTENT_CREATE",
    "CONTENT_EDIT",
    "CONTENT_DELETE",
    "CONTENT_MODERATION",
    "ACTIVITY_VIEW",
    "AUDIT_VIEW",
    "AUDIT_EXPORT",
    "REPORT_GENERATE",
    "API_ACCESS",
    "TOKEN_GENERATE",
    "TOKEN_MANAGE",
    "NETWORK_VIEW",
    "NETWORK_CREATE",
    "NETWORK_EDIT",
    "NETWORK_DELETE",
    "NETWORK_MANAGEMENT",
    "CREATE_UPDATE_AND_DELETE_NETWORK_DEVICES",
    "CREATE_UPDATE_AND_DELETE_NETWORK_SITES",
    "VIEW_AIR_QUALITY_FOR_NETWORK",
    "CREATE_UPDATE_AND_DELETE_NETWORK_ROLES",
    "CREATE_UPDATE_AND_DELETE_NETWORK_USERS",
    "MANAGE_NETWORK_SETTINGS",
    "VIEW_NETWORK_DASHBOARD",
    "CREATE_UPDATE_AND_DELETE_GROUP_DEVICES",
    "CREATE_UPDATE_AND_DELETE_GROUP_SITES",
    "VIEW_AIR_QUALITY_FOR_GROUP",
    "CREATE_UPDATE_AND_DELETE_GROUP_ROLES",
    "CREATE_UPDATE_AND_DELETE_GROUP_USERS",
    "MANAGE_GROUP_SETTINGS",
    "VIEW_GROUP_DASHBOARD",
    "ACCESS_PLATFORM",
  ];
};

class OptimizedBitFlagsTokenStrategy extends TokenStrategy {
  constructor() {
    super();
    this.permissionBits = this.createPermissionBitMap();
  }

  createPermissionBitMap() {
    const permissions = getAllPermissions();
    const bitMap = {};
    permissions.forEach((permission, index) => {
      bitMap[permission] = BigInt(1) << BigInt(index);
    });
    return bitMap;
  }

  encodePermissions(permissions) {
    let flags = BigInt(0);
    permissions.forEach((permission) => {
      const bit = this.permissionBits[permission];
      if (bit) flags |= bit;
    });
    return flags.toString(36); // Base36 for smaller string
  }

  decodePermissions(flagsString) {
    if (!flagsString) return [];
    const flags = BigInt("0x" + parseInt(flagsString, 36).toString(16));
    const permissions = [];
    Object.entries(this.permissionBits).forEach(([permission, bit]) => {
      if ((flags & bit) === bit) {
        permissions.push(permission);
      }
    });
    return permissions;
  }

  async generateToken(user, tenant, options) {
    try {
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsForLogin(
        user._id
      );

      const systemFlags = this.encodePermissions(
        permissionData.systemPermissions
      );
      const groupFlags = {};
      for (const groupId in permissionData.groupPermissions) {
        groupFlags[groupId] = this.encodePermissions(
          permissionData.groupPermissions[groupId]
        );
      }
      const networkFlags = {};
      for (const networkId in permissionData.networkPermissions) {
        networkFlags[networkId] = this.encodePermissions(
          permissionData.networkPermissions[networkId]
        );
      }

      const payload = {
        id: user._id,
        sf: systemFlags,
        gf: groupFlags,
        nf: networkFlags,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        ...options.jwtOptions,
      };
      return jwt.sign(payload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(
        `Error generating optimized bit flags token: ${error.message}`
      );
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    const systemPermissions = this.decodePermissions(decoded.sf);
    const groupPermissions = {};
    for (const groupId in decoded.gf) {
      groupPermissions[groupId] = this.decodePermissions(decoded.gf[groupId]);
    }
    const networkPermissions = {};
    for (const networkId in decoded.nf) {
      networkPermissions[networkId] = this.decodePermissions(
        decoded.nf[networkId]
      );
    }

    const allPermissions = [
      ...systemPermissions,
      ...Object.values(groupPermissions).flat(),
      ...Object.values(networkPermissions).flat(),
    ];

    return {
      userId: decoded.id,
      permissions: [...new Set(allPermissions)],
      systemPermissions,
      groupPermissions,
      networkPermissions,
    };
  }
}

module.exports = {
  AbstractTokenFactory,
  TOKEN_STRATEGIES,
};
