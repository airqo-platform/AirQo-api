// users.routes.js
const express = require("express");
const router = express.Router();
const userController = require("@controllers/user.controller");
const userValidations = require("@validators/users.validators");
const { validate, headers, pagination } = require("@validators/common");
const {
  setLocalAuth,
  setGoogleAuth,
  authGoogleCallback,
  setGuestToken,
  authLocal,
  authGuest,
  authGoogle,
  enhancedJWTAuth,
} = require("@middleware/passport");
const rateLimiter = require("@middleware/rate-limiter");
const captchaMiddleware = require("@middleware/captcha");
const analyticsMiddleware = require("@middleware/analytics");

const {
  requirePermissions,
  requireAllPermissions,
  requireGroupPermissions,
  requireNetworkPermissions,
  requireGroupMembership,
  requireNetworkMembership,
  debugPermissions,
} = require("@middleware/permissionAuth");

router.use(headers);
router.use(userValidations.pagination);

// ================================
// AUTHENTICATION ROUTES
// ================================

/**
 * @route POST /api/v2/users/login-enhanced
 * @desc Enhanced login with comprehensive role/permission data and optimized tokens
 * @access Public
 * @body {string} email - User email
 * @body {string} password - User password
 * @body {string} [preferredStrategy] - Token strategy preference
 * @body {boolean} [includeDebugInfo] - Include debug information (dev only)
 * @query {string} [tenant] - Tenant identifier
 */
router.post(
  "/login-enhanced",
  userValidations.loginEnhanced,
  validate,
  userController.loginEnhanced
);

/**
 * @route POST /api/v2/users/login-legacy-compatible
 * @desc Legacy compatible login endpoint
 * @access Public
 */
router.post(
  "/login-legacy-compatible",
  userValidations.loginLegacyCompatible,
  validate,
  userController.loginLegacyCompatible
);

/**
 * @route POST /api/v2/users/admin/cleanup
 * @desc Perform administrative cleanup tasks on user data.
 * @access Private - Requires SYSTEM_ADMIN permission
 * @body {string} cleanupType - The type of cleanup to perform (e.g., "fix-missing-group-roles").
 * @body {boolean} [dryRun=true] - If true, simulates the cleanup without making changes.
 */
router.post(
  "/admin/cleanup",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  userValidations.userCleanup,
  userController.cleanup
);

// ================================
// TOKEN MANAGEMENT ROUTES
// ================================

/**
 * @route POST /api/v2/users/generate-token
 * @desc Generate optimized token for existing session
 * @access Private
 * @body {string} userId - User ID
 * @body {string} [strategy] - Token strategy
 * @body {object} [options] - Token options
 */
router.post(
  "/generate-token",
  enhancedJWTAuth,
  userValidations.generateToken,
  requirePermissions(["TOKEN_GENERATE"]),
  validate,
  userController.generateOptimizedToken
);

/**
 * @route POST /api/v2/users/refresh-permissions
 * @desc Refresh user permissions and optionally regenerate token
 * @access Private
 * @body {string} [userId] - User ID (defaults to authenticated user)
 * @body {string} [strategy] - Token strategy for regeneration
 */
router.post(
  "/refresh-permissions",
  enhancedJWTAuth,
  userValidations.refreshPermissions,
  validate,
  userController.refreshPermissions
);

/**
 * @route GET /api/v2/users/analyze-tokens/:userId
 * @desc Analyze token sizes across different strategies
 * @access Private - Admin only
 * @params {string} userId - User ID to analyze
 */
router.get(
  "/analyze-tokens/:userId",
  enhancedJWTAuth,
  userValidations.analyzeTokenStrategies,
  requirePermissions(["SYSTEM_ADMIN"]),
  validate,
  userController.analyzeTokenStrategies
);

/**
 * @route PUT /api/v2/users/token-strategy
 * @desc Update user's preferred token strategy
 * @access Private
 * @body {string} [userId] - User ID (defaults to authenticated user)
 * @body {string} strategy - New token strategy
 */
router.put(
  "/token-strategy",
  enhancedJWTAuth,
  userValidations.updateTokenStrategy,
  validate,
  userController.updateTokenStrategy
);

// ================================
// PERMISSION & CONTEXT ROUTES
// ================================

/**
 * @route GET /api/v2/users/context-permissions
 * @desc Get user permissions in specific context (group/network)
 * @access Private
 * @query {string} [userId] - User ID (defaults to authenticated user)
 * @query {string} [contextId] - Context ID (group/network ID)
 * @query {string} [contextType] - Context type ('group' or 'network')
 */
router.get(
  "/context-permissions",
  enhancedJWTAuth,
  userValidations.getContextPermissions,
  validate,
  userController.getContextPermissions
);

/**
 * @route GET /api/v2/users/profile/enhanced
 * @desc Get comprehensive user profile with all permissions and roles
 * @access Private
 */
router.get(
  "/profile/enhanced",
  enhancedJWTAuth,
  userController.getEnhancedProfile
);

// ================================
// GROUP-SPECIFIC ROUTES
// ================================

/**
 * @route GET /api/v2/users/groups/:grp_id/permissions
 * @desc Get user's permissions within a specific group
 * @access Private - Group members only
 */
router.get(
  "/groups/:grp_id/permissions",
  enhancedJWTAuth,
  // requireGroupMembership("grp_id"),
  (req, res) => {
    req.query.contextId = req.params.grp_id;
    req.query.contextType = "group";
    userController.getContextPermissions(req, res);
  }
);

// ================================
// NETWORK-SPECIFIC ROUTES
// ================================

/**
 * @route GET /api/v2/users/networks/:network_id/permissions
 * @desc Get user's permissions within a specific network
 * @access Private - Network members only
 */
router.get(
  "/networks/:network_id/permissions",
  enhancedJWTAuth,
  // requireNetworkMembership("network_id"),
  (req, res) => {
    req.query.contextId = req.params.network_id;
    req.query.contextType = "network";
    userController.getContextPermissions(req, res);
  }
);

/**
 * @route GET /api/v2/users/networks/:network_id/members
 * @desc Get all members of a specific network with their roles
 * @access Private - Network members with USER_VIEW permission
 */
router.get(
  "/networks/:network_id/members",
  enhancedJWTAuth,
  // requireNetworkPermissions(["USER_VIEW"], "network_id"),
  async (req, res) => {
    try {
      const UserModel = require("@models/User");
      const networkId = req.params.network_id;
      const tenant = req.query.tenant || "airqo";

      // Get basic user data without populate
      const users = await UserModel(tenant)
        .find({ "network_roles.network": networkId })
        .select("-password -resetPasswordToken -resetPasswordExpires")
        .lean();

      if (users.length === 0) {
        return res.json({
          success: true,
          message: "No network members found",
          data: {
            networkId,
            members: [],
            totalMembers: 0,
          },
        });
      }

      // Manually populate network_roles.network and network_roles.role
      const processedUsers = [];

      for (const user of users) {
        const processedUser = { ...user };

        if (user.network_roles && user.network_roles.length > 0) {
          // Get unique network and role IDs for this user
          const networkIds = [
            ...new Set(user.network_roles.map((nr) => nr.network)),
          ];
          const roleIds = [
            ...new Set(user.network_roles.map((nr) => nr.role).filter(Boolean)),
          ];

          // Fetch networks
          let networks = [];
          try {
            const NetworkModel = require("@models/Network");
            networks = await NetworkModel(tenant)
              .find({ _id: { $in: networkIds } })
              .select("net_name net_status")
              .lean();
          } catch (error) {
            console.warn(`Could not fetch networks: ${error.message}`);
          }

          // Fetch roles
          let roles = [];
          try {
            const RoleModel = require("@models/Role");
            roles = await RoleModel(tenant)
              .find({ _id: { $in: roleIds } })
              .select("role_name role_permissions")
              .lean();
          } catch (error) {
            console.warn(`Could not fetch roles: ${error.message}`);
          }

          // Map populated data back to network_roles
          processedUser.network_roles = user.network_roles.map(
            (networkRole) => ({
              ...networkRole,
              network:
                networks.find(
                  (n) => n._id.toString() === networkRole.network.toString()
                ) || networkRole.network,
              role:
                roles.find(
                  (r) => r._id.toString() === networkRole.role?.toString()
                ) || networkRole.role,
            })
          );
        }

        processedUsers.push(processedUser);
      }

      res.json({
        success: true,
        message: "Network members retrieved successfully",
        data: {
          networkId,
          members: processedUsers.map((user) => ({
            ...user,
            networkRole: user.network_roles.find(
              (nr) =>
                nr.network._id?.toString() === networkId ||
                nr.network.toString() === networkId
            ),
          })),
          totalMembers: processedUsers.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to retrieve network members",
        error: error.message,
      });
    }
  }
);

// ================================
// ADMIN & DEBUG ROUTES
// ================================

/**
 * @route GET /api/v2/users/debug/permissions/:userId
 * @desc Debug user permissions (development only)
 * @access Private - Admin only
 */
router.get(
  "/debug/permissions/:userId",
  enhancedJWTAuth,
  userValidations.debugPermissions,
  requirePermissions(["SYSTEM_ADMIN"]),
  debugPermissions(),
  async (req, res) => {
    try {
      const RBACService = require("@services/rbac.service");
      const userId = req.params.userId;
      const tenant = req.query.tenant || "airqo";

      const rbacService = new RBACService(tenant);
      const debugInfo = await rbacService.debugUserPermissions(userId);

      res.json({
        success: true,
        message: "Debug information retrieved successfully",
        data: debugInfo,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to retrieve debug information",
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/v2/users/admin/token-analytics
 * @desc Get token strategy analytics across all users
 * @access Private - Admin only
 */
router.get(
  "/admin/token-analytics",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  async (req, res) => {
    try {
      const { tokenConfig } = require("@config/tokenStrategyConfig");
      const UserModel = require("@models/User");
      const tenant = req.query.tenant || "airqo";

      // Get strategy distribution
      const strategyDistribution = await UserModel(tenant).aggregate([
        {
          $group: {
            _id: "$preferredTokenStrategy",
            count: { $sum: 1 },
            users: { $push: { id: "$_id", email: "$email" } },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      // Get performance metrics
      const performanceMetrics = tokenConfig.getPerformanceMetrics();
      const recommendations = tokenConfig.getPerformanceBasedRecommendations();

      res.json({
        success: true,
        message: "Token analytics retrieved successfully",
        data: {
          strategyDistribution,
          performanceMetrics,
          recommendations,
          configSnapshot: tokenConfig.exportConfig(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to retrieve token analytics",
        error: error.message,
      });
    }
  }
);

// Get organization by slug (for branded login page)
router.get(
  "/organizations/:org_slug",
  userValidations.getOrganizationBySlug,
  userController.getOrganizationBySlug
);

// Register via branded URL
router.post(
  "/register/:org_slug",
  rateLimiter.registration,
  captchaMiddleware.verify,
  analyticsMiddleware.trackRegistration,
  userValidations.registerViaOrgSlug,
  userController.registerViaOrgSlug
);

router.get(
  "/deleteMobileUserData/:userId/:token",
  userValidations.deleteMobileUserData,
  userController.deleteMobileUserData
);

router.post(
  "/loginUser",
  userValidations.login,
  setLocalAuth,
  authLocal,
  userController.login
);

router.post(
  "/login",
  userValidations.login,
  setLocalAuth,
  authLocal,
  userController.login
);

router.post(
  "/login-with-details",
  userValidations.login,
  setLocalAuth,
  authLocal,
  userController.loginWithDetails
);

router.get(
  "/logout",
  userValidations.tenant,
  enhancedJWTAuth,
  userController.logout
);

router.post(
  "/guest",
  userValidations.tenant,
  setGuestToken,
  authGuest,
  userController.guest
);

router.post(
  "/emailLogin",
  userValidations.emailLogin,
  userController.loginInViaEmail
);

router.post(
  "/emailAuth/:purpose?",
  userValidations.emailAuth,
  userController.emailAuth
);

router.post("/feedback", userValidations.feedback, userController.sendFeedback);

router.post(
  "/firebase/lookup",
  userValidations.firebaseLookup,
  userController.lookUpFirebaseUser
);

router.post(
  "/firebase/create",
  userValidations.firebaseCreate,
  userController.createFirebaseUser
);

router.post(
  "/firebase/login",
  userValidations.firebaseLogin,
  userController.loginWithFirebase
);

router.post(
  "/firebase/signup",
  userValidations.firebaseSignup,
  userController.signUpWithFirebase
);

router.post(
  "/syncAnalyticsAndMobile",
  userValidations.syncAnalyticsAndMobile,
  userController.syncAnalyticsAndMobile
);

router.post(
  "/emailReport",
  userValidations.emailReport,
  enhancedJWTAuth,
  userController.emailReport
);

router.post(
  "/firebase/verify",
  userValidations.firebaseVerify,
  userController.verifyFirebaseCustomToken
);

router.post("/verify", enhancedJWTAuth, userController.verify);

router.get(
  "/combined",
  userValidations.tenant,
  enhancedJWTAuth,
  userController.listUsersAndAccessRequests
);

router.get(
  "/verify/:user_id/:token",
  userValidations.verifyEmail,
  userController.verifyEmail
);

router.get(
  "/auth/google/callback",
  setGoogleAuth,
  authGoogleCallback,
  userController.googleCallback
);

router.get("/auth/google", setGoogleAuth, authGoogle, userController.login);

router.get("/", userValidations.tenant, enhancedJWTAuth, userController.list);

router.post(
  "/registerUser",
  userValidations.registerUser,
  userController.register
);

router.post("/", userValidations.createUser, userController.create);

router.put(
  "/updatePasswordViaEmail",
  userValidations.updatePasswordViaEmail,
  userController.updateForgottenPassword
);

router.put(
  "/updatePassword",
  userValidations.updatePassword,
  enhancedJWTAuth,
  userController.updateKnownPassword
);

router.post(
  "/forgotPassword",
  userValidations.forgotPassword,
  userController.forgot
);

router.post(
  "/reset-password-request",
  userValidations.resetPasswordRequest,
  userController.resetPasswordRequest
);

router.post(
  "/reset-password/:token",
  userValidations.resetPassword,
  userController.resetPassword
);

router.post(
  "/register",
  userValidations.createUser,
  userController.registerMobileUser
);

router.post(
  "/verify-email/:token",
  userValidations.verifyMobileEmail,
  userController.verifyMobileEmail
);

router.put("/", userValidations.updateUser, userController.update);

router.put("/:user_id", userValidations.updateUserById, userController.update);

router.delete(
  "/",
  userValidations.deleteUser,
  enhancedJWTAuth,
  userController.delete
);

router.delete(
  "/:user_id",
  userValidations.deleteUserById,
  enhancedJWTAuth,
  userController.delete
);

router.post(
  "/newsletter/subscribe",
  userValidations.newsletterSubscribe,
  userController.subscribeToNewsLetter
);

router.post(
  "/newsletter/resubscribe",
  userValidations.newsletterResubscribe,
  userController.reSubscribeToNewsLetter
);

router.post(
  "/newsletter/unsubscribe",
  userValidations.newsletterUnsubscribe,
  userController.unSubscribeFromNewsLetter
);

router.get(
  "/stats",
  userValidations.tenant,
  enhancedJWTAuth,
  userController.listStatistics
);

router.get(
  "/cache",
  userValidations.cache,
  enhancedJWTAuth,
  userController.listCache
);

router.get(
  "/logs",
  userValidations.tenant,
  enhancedJWTAuth,
  userController.listLogs
);

router.get(
  "/user-stats",
  userValidations.tenant,
  enhancedJWTAuth,
  userController.getUserStats
);

router.post(
  "/subscribe/:type",
  userValidations.subscribeToNotifications,
  userController.subscribeToNotifications
);

router.post(
  "/unsubscribe/:type",
  userValidations.unSubscribeFromNotifications,
  userController.unSubscribeFromNotifications
);

router.post(
  "/notification-status/:type",
  userValidations.notificationStatus,
  userController.checkNotificationStatus
);

router.get(
  "/:user_id",
  userValidations.getUser,
  enhancedJWTAuth,
  userController.list
);

// ================================
// ERROR HANDLING
// ================================

// Handle 404 for undefined routes
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "user route endpoint not found",
    availableEndpoints: [
      "POST /login-enhanced",
      "POST /generate-token",
      "POST /refresh-permissions",
      "GET /analyze-tokens/:userId",
      "PUT /token-strategy",
      "GET /context-permissions",
      "GET /profile/enhanced",
      "GET /groups/:grp_id/permissions",
      "GET /networks/:network_id/permissions",
    ],
  });
});

module.exports = router;
