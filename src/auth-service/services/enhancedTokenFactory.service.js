// services/enhancedTokenFactory.service.js
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- enhanced-token-factory`
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

class EnhancedTokenFactory {
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
    this.strategies.set(
      TOKEN_STRATEGIES.COMPRESSED,
      new CompressedTokenStrategy()
    );
    this.strategies.set(
      TOKEN_STRATEGIES.HASH_BASED,
      new HashBasedTokenStrategy(this.tenant)
    );
    this.strategies.set(
      TOKEN_STRATEGIES.ROLE_ONLY,
      new RoleOnlyTokenStrategy()
    );
    this.strategies.set(
      TOKEN_STRATEGIES.OPTIMIZED_HASH,
      new OptimizedHashTokenStrategy(this.tenant)
    );
    this.strategies.set(
      TOKEN_STRATEGIES.ULTRA_COMPRESSED,
      new UltraCompressedTokenStrategy()
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

    // Strategy detection based on payload structure
    if (
      decoded.oh &&
      typeof decoded.oh === "string" &&
      decoded.oh.length <= 16
    ) {
      return TOKEN_STRATEGIES.OPTIMIZED_HASH;
    }

    if (decoded.uc === 1) {
      return TOKEN_STRATEGIES.ULTRA_COMPRESSED;
    }

    if (
      decoded.ph &&
      typeof decoded.ph === "string" &&
      decoded.ph.length <= 16
    ) {
      return TOKEN_STRATEGIES.HASH_BASED;
    }

    if (
      decoded.sr &&
      Array.isArray(decoded.sr) &&
      typeof decoded.rs === "number"
    ) {
      return TOKEN_STRATEGIES.ROLE_ONLY;
    }

    if (decoded.u && decoded.e && !decoded.username) {
      return TOKEN_STRATEGIES.COMPRESSED;
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
      console.log("🔄 LEGACY: Generating token for user:", user._id);

      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const rbacService = new EnhancedRBACService(tenant);

      const permissions = await rbacService.getUserPermissions(user._id);
      const roles = [user.userType];

      // Add roles from user object
      if (user.roles && user.roles.length > 0) {
        user.roles.forEach((role) => {
          const roleName = typeof role === "object" ? role.role_name : role;
          if (roleName) roles.push(roleName);
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
        country: user.country,
        profilePicture: user.profilePicture,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        rateLimit: user.rateLimit,
        lastLogin: user.lastLogin,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        algorithm: options.algorithm || "HS256",
        issuer: options.issuer || constants.APP_NAME,
        audience: options.audience || tenant,
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
      console.log("📦 STANDARD: Generating token for user:", user._id);

      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const rbacService = new EnhancedRBACService(tenant);

      const permissionData = await rbacService.getUserPermissionsByContext(
        user._id
      );

      console.log("📦 STANDARD: Got permission data:", {
        systemCount: permissionData.systemPermissions.length,
        groupCount: Object.keys(permissionData.groupPermissions).length,
        networkCount: Object.keys(permissionData.networkPermissions).length,
      });

      const tokenPayload = {
        _id: user._id,
        username: user.userName,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        organization: user.organization,
        long_organization: user.long_organization,

        // Enhanced role/permission structure
        systemPermissions: permissionData.systemPermissions,
        groupPermissions: permissionData.groupPermissions,
        networkPermissions: permissionData.networkPermissions,
        groupMemberships: permissionData.groupMemberships,
        networkMemberships: permissionData.networkMemberships,

        allPermissions: [
          ...permissionData.systemPermissions,
          ...Object.values(permissionData.groupPermissions).flat(),
          ...Object.values(permissionData.networkPermissions).flat(),
        ],

        isSuperAdmin: permissionData.isSuperAdmin,
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        algorithm: options.algorithm || "HS256",
        issuer: options.issuer || constants.APP_NAME,
        audience: options.audience || tenant,
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

class CompressedTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      console.log("🗜️ COMPRESSED: Generating token for user:", user._id);

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

      // Compressed field names
      const optimizedPayload = {
        id: user._id,
        u: user.userName,
        e: user.email,
        fn: user.firstName,
        ln: user.lastName,
        t: user.userType,
        o: user.organization,
        lo: user.long_organization,

        // Compressed permissions
        sp: permissionData.systemPermissions,
        gp: permissionData.groupPermissions,
        np: permissionData.networkPermissions,
        ap: [...new Set(allPermissions)],

        // Memberships (compressed)
        gm: permissionData.groupMemberships,
        nm: permissionData.networkMemberships,

        sa: permissionData.isSuperAdmin,

        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      };

      return jwt.sign(optimizedPayload, constants.JWT_SECRET);
    } catch (error) {
      logger.error(`Error generating compressed token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    return {
      _id: decoded.id,
      userId: decoded.id,
      username: decoded.u,
      email: decoded.e,
      firstName: decoded.fn,
      lastName: decoded.ln,
      userType: decoded.t,
      organization: decoded.o,
      long_organization: decoded.lo,

      permissions: decoded.ap || decoded.sp || [],
      systemPermissions: decoded.sp || [],
      groupPermissions: decoded.gp || {},
      networkPermissions: decoded.np || {},
      groupMemberships: decoded.gm || [],
      networkMemberships: decoded.nm || [],
      allPermissions: decoded.ap || decoded.sp || [],

      isSuperAdmin: decoded.sa || false,

      iat: decoded.iat,
      exp: decoded.exp,
    };
  }
}

class HashBasedTokenStrategy extends TokenStrategy {
  constructor(tenant) {
    super();
    this.tenant = tenant;
    this.permissionCache = new Map();
  }

  async generateToken(user, tenant, options) {
    try {
      console.log("🔗 HASH_BASED: Generating token for user:", user._id);

      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const rbacService = new EnhancedRBACService(tenant);

      const permissionData = await rbacService.getUserPermissionsByContext(
        user._id
      );

      const permissionHash = `${user._id}_${Date.now()}`.substring(0, 16);

      // Store permissions externally
      this.permissionCache.set(permissionHash, {
        systemPermissions: permissionData.systemPermissions,
        groupPermissions: permissionData.groupPermissions,
        networkPermissions: permissionData.networkPermissions,
        groupMemberships: permissionData.groupMemberships,
        networkMemberships: permissionData.networkMemberships,
        allPermissions: [
          ...permissionData.systemPermissions,
          ...Object.values(permissionData.groupPermissions).flat(),
          ...Object.values(permissionData.networkPermissions).flat(),
        ],
        isSuperAdmin: permissionData.isSuperAdmin,
      });

      const tokenPayload = {
        _id: user._id,
        username: user.userName,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        organization: user.organization,
        ph: permissionHash, // Permission hash
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        algorithm: options.algorithm || "HS256",
        issuer: options.issuer || constants.APP_NAME,
        audience: options.audience || tenant,
        ...options.jwtOptions,
      };

      return jwt.sign(tokenPayload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating hash-based token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    try {
      let permissionData = this.permissionCache.get(decoded.ph);

      if (!permissionData) {
        // Fallback to fresh calculation
        console.log("🔄 HASH_BASED: Cache miss, recalculating permissions");
        const EnhancedRBACService = require("@services/enhancedRBAC.service");
        const rbacService = new EnhancedRBACService(tenant);
        const freshData = await rbacService.getUserPermissionsByContext(
          decoded._id
        );

        permissionData = {
          systemPermissions: freshData.systemPermissions || [],
          groupPermissions: freshData.groupPermissions || {},
          networkPermissions: freshData.networkPermissions || {},
          groupMemberships: freshData.groupMemberships || [],
          networkMemberships: freshData.networkMemberships || [],
          allPermissions: [
            ...(freshData.systemPermissions || []),
            ...Object.values(freshData.groupPermissions || {}).flat(),
            ...Object.values(freshData.networkPermissions || {}).flat(),
          ],
          isSuperAdmin: freshData.isSuperAdmin || false,
        };
      }

      return {
        _id: decoded._id,
        userId: decoded._id,
        username: decoded.username,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        userType: decoded.userType,
        organization: decoded.organization,

        permissions: permissionData.allPermissions,
        systemPermissions: permissionData.systemPermissions,
        groupPermissions: permissionData.groupPermissions,
        networkPermissions: permissionData.networkPermissions,
        groupMemberships: permissionData.groupMemberships,
        networkMemberships: permissionData.networkMemberships,
        allPermissions: permissionData.allPermissions,

        isSuperAdmin: permissionData.isSuperAdmin,

        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      logger.error(`Error decoding hash-based token: ${error.message}`);
      throw error;
    }
  }
}

class RoleOnlyTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      console.log("🎭 ROLE_ONLY: Generating token for user:", user._id);

      // Store minimal role information, derive permissions on decode
      const tokenPayload = {
        _id: user._id,
        username: user.userName,
        email: user.email,
        userType: user.userType,
        organization: user.organization,

        // Role snapshots for permission derivation
        groupRoles: (user.group_roles || []).map((gr) => ({
          group: gr.group,
          role: gr.role,
          userType: gr.userType,
        })),
        networkRoles: (user.network_roles || []).map((nr) => ({
          network: nr.network,
          role: nr.role,
          userType: nr.userType,
        })),

        rs: Date.now(), // Role snapshot timestamp
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        algorithm: options.algorithm || "HS256",
        issuer: options.issuer || constants.APP_NAME,
        audience: options.audience || tenant,
        ...options.jwtOptions,
      };

      return jwt.sign(tokenPayload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating role-only token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    try {
      console.log("🎭 ROLE_ONLY: Decoding token, deriving fresh permissions");

      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const rbacService = new EnhancedRBACService(tenant);

      // Get fresh permissions based on current role configuration
      const permissionData = await rbacService.getUserPermissionsByContext(
        decoded._id
      );

      return {
        _id: decoded._id,
        userId: decoded._id,
        username: decoded.username,
        email: decoded.email,
        userType: decoded.userType,
        organization: decoded.organization,

        permissions: [
          ...permissionData.systemPermissions,
          ...Object.values(permissionData.groupPermissions).flat(),
          ...Object.values(permissionData.networkPermissions).flat(),
        ],
        systemPermissions: permissionData.systemPermissions,
        groupPermissions: permissionData.groupPermissions,
        networkPermissions: permissionData.networkPermissions,
        groupMemberships: permissionData.groupMemberships,
        networkMemberships: permissionData.networkMemberships,
        allPermissions: [
          ...permissionData.systemPermissions,
          ...Object.values(permissionData.groupPermissions).flat(),
          ...Object.values(permissionData.networkPermissions).flat(),
        ],

        isSuperAdmin: permissionData.isSuperAdmin,

        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      logger.error(`Error decoding role-only token: ${error.message}`);
      throw error;
    }
  }
}

class OptimizedHashTokenStrategy extends TokenStrategy {
  constructor(tenant) {
    super();
    this.tenant = tenant;
    this.permissionCache = new Map();
    this.hashCounter = 0;
  }

  generateShortHash(userId) {
    this.hashCounter = (this.hashCounter + 1) % 10000;
    return `${userId.toString().slice(-4)}${this.hashCounter
      .toString()
      .padStart(4, "0")}`;
  }

  async generateToken(user, tenant, options) {
    try {
      console.log("🔗 OPTIMIZED_HASH: Generating ultra-compressed token");

      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const rbacService = new EnhancedRBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsByContext(
        user._id
      );

      const hash = this.generateShortHash(user._id);

      // Store all data externally
      this.permissionCache.set(hash, {
        systemPermissions: permissionData.systemPermissions,
        groupPermissions: permissionData.groupPermissions,
        networkPermissions: permissionData.networkPermissions,
        groupMemberships: permissionData.groupMemberships,
        networkMemberships: permissionData.networkMemberships,
        allPermissions: [
          ...permissionData.systemPermissions,
          ...Object.values(permissionData.groupPermissions).flat(),
          ...Object.values(permissionData.networkPermissions).flat(),
        ],
        isSuperAdmin: permissionData.isSuperAdmin,
        user: {
          userName: user.userName,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          organization: user.organization,
        },
      });

      // Ultra-minimal token payload
      const tokenPayload = {
        _id: user._id,
        oh: hash, // Optimized hash
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        algorithm: options.algorithm || "HS256",
        issuer: options.issuer || constants.APP_NAME,
        audience: options.audience || tenant,
        ...options.jwtOptions,
      };

      return jwt.sign(tokenPayload, constants.JWT_SECRET, jwtOptions);
    } catch (error) {
      logger.error(`Error generating optimized hash token: ${error.message}`);
      throw error;
    }
  }

  async decodeToken(decoded, tenant) {
    try {
      const cachedData = this.permissionCache.get(decoded.oh);

      if (!cachedData) {
        // Fallback to fresh calculation
        const EnhancedRBACService = require("@services/enhancedRBAC.service");
        const rbacService = new EnhancedRBACService(tenant);
        const permissionData = await rbacService.getUserPermissionsByContext(
          decoded._id
        );

        return {
          _id: decoded._id,
          userId: decoded._id,
          permissions: [
            ...permissionData.systemPermissions,
            ...Object.values(permissionData.groupPermissions).flat(),
            ...Object.values(permissionData.networkPermissions).flat(),
          ],
          systemPermissions: permissionData.systemPermissions,
          groupPermissions: permissionData.groupPermissions,
          networkPermissions: permissionData.networkPermissions,
          iat: decoded.iat,
          exp: decoded.exp,
        };
      }

      return {
        _id: decoded._id,
        userId: decoded._id,
        username: cachedData.user.userName,
        email: cachedData.user.email,
        firstName: cachedData.user.firstName,
        lastName: cachedData.user.lastName,
        userType: cachedData.user.userType,
        organization: cachedData.user.organization,

        permissions: cachedData.allPermissions,
        systemPermissions: cachedData.systemPermissions,
        groupPermissions: cachedData.groupPermissions,
        networkPermissions: cachedData.networkPermissions,
        groupMemberships: cachedData.groupMemberships,
        networkMemberships: cachedData.networkMemberships,

        isSuperAdmin: cachedData.isSuperAdmin,

        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      logger.error(`Error decoding optimized hash token: ${error.message}`);
      throw error;
    }
  }
}

class UltraCompressedTokenStrategy extends TokenStrategy {
  async generateToken(user, tenant, options) {
    try {
      // Store only user ID - everything else derived on decode
      const tokenPayload = {
        _id: user._id,
        uc: 1, // Ultra compressed marker
      };

      const jwtOptions = {
        expiresIn: options.expiresIn || "24h",
        algorithm: options.algorithm || "HS256",
        issuer: options.issuer || constants.APP_NAME,
        audience: options.audience || tenant,
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
      // Fetch everything fresh from database
      const UserModel = require("@models/User");
      const EnhancedRBACService = require("@services/enhancedRBAC.service");

      const user = await UserModel(tenant).findById(decoded._id).lean();
      const rbacService = new EnhancedRBACService(tenant);
      const permissionData = await rbacService.getUserPermissionsByContext(
        decoded._id
      );

      return {
        _id: decoded._id,
        userId: decoded._id,
        username: user?.userName,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        userType: user?.userType,
        organization: user?.organization,

        permissions: [
          ...permissionData.systemPermissions,
          ...Object.values(permissionData.groupPermissions).flat(),
          ...Object.values(permissionData.networkPermissions).flat(),
        ],
        systemPermissions: permissionData.systemPermissions,
        groupPermissions: permissionData.groupPermissions,
        networkPermissions: permissionData.networkPermissions,
        groupMemberships: permissionData.groupMemberships,
        networkMemberships: permissionData.networkMemberships,

        isSuperAdmin: permissionData.isSuperAdmin,

        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (error) {
      logger.error(`Error decoding ultra compressed token: ${error.message}`);
      throw error;
    }
  }
}

module.exports = {
  EnhancedTokenFactory,
  TOKEN_STRATEGIES,
};
