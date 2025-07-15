// users.routes.js
const express = require("express");
const router = express.Router();
const userController = require("@controllers/user.controller");
const userValidations = require("@validators/users.validators");
const { validate } = require("@validators/common");
const {
  setJWTAuth,
  authJWT,
  setLocalAuth,
  setGoogleAuth,
  authGoogleCallback,
  setGuestToken,
  authLocal,
  authGuest,
  authGoogle,
} = require("@middleware/passport");
const rateLimiter = require("@middleware/rate-limiter");
const captchaMiddleware = require("@middleware/captcha");
const analyticsMiddleware = require("@middleware/analytics");

const {
  enhancedAuth,
  requirePermissions,
  requireAllPermissions,
  requireGroupPermissions,
  requireNetworkPermissions,
  requireGroupMembership,
  requireNetworkMembership,
  debugPermissions,
} = require("@middleware/enhancedPermissionAuth");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

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
router.post("/login-enhanced", validate, userController.loginEnhanced);

/**
 * @route POST /api/v2/users/login-legacy-compatible
 * @desc Legacy compatible login endpoint
 * @access Public
 */
router.post(
  "/login-legacy-compatible",
  setLocalAuth,
  authLocal,
  userController.loginLegacyCompatible
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
  enhancedAuth,
  requirePermissions(["USER_MANAGE", "TOKEN_GENERATE"]),
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
  enhancedAuth,
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
  enhancedAuth,
  requirePermissions(["ADMIN_FULL_ACCESS", "TOKEN_ANALYZE"]),
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
  enhancedAuth,
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
  enhancedAuth,
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
  enhancedAuth,
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
  enhancedAuth,
  requireGroupMembership("grp_id"),
  (req, res) => {
    req.query.contextId = req.params.grp_id;
    req.query.contextType = "group";
    userController.getContextPermissions(req, res);
  }
);

/**
 * @route GET /api/v2/users/groups/:grp_id/members
 * @desc Get all members of a specific group with their roles
 * @access Private - Group members with USER_VIEW permission
 */
router.get(
  "/groups/:grp_id/members",
  enhancedAuth,
  requireGroupPermissions(["USER_VIEW"], "grp_id"),
  async (req, res) => {
    try {
      const UserModel = require("@models/User");
      const groupId = req.params.grp_id;
      const tenant = req.query.tenant || "airqo";

      const users = await UserModel(tenant)
        .find({ "group_roles.group": groupId })
        .select("-password -resetPasswordToken -resetPasswordExpires")
        .populate({
          path: "group_roles.group",
          select: "grp_title grp_status",
        })
        .populate({
          path: "group_roles.role",
          select: "role_name role_permissions",
        })
        .lean();

      res.json({
        success: true,
        message: "Group members retrieved successfully",
        data: {
          groupId,
          members: users.map((user) => ({
            ...user,
            groupRole: user.group_roles.find(
              (gr) => gr.group._id.toString() === groupId
            ),
          })),
          totalMembers: users.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to retrieve group members",
        error: error.message,
      });
    }
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
  enhancedAuth,
  requireNetworkMembership("network_id"),
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
  enhancedAuth,
  requireNetworkPermissions(["USER_VIEW"], "network_id"),
  async (req, res) => {
    try {
      const UserModel = require("@models/User");
      const networkId = req.params.network_id;
      const tenant = req.query.tenant || "airqo";

      const users = await UserModel(tenant)
        .find({ "network_roles.network": networkId })
        .select("-password -resetPasswordToken -resetPasswordExpires")
        .populate({
          path: "network_roles.network",
          select: "net_name net_status",
        })
        .populate({
          path: "network_roles.role",
          select: "role_name role_permissions",
        })
        .lean();

      res.json({
        success: true,
        message: "Network members retrieved successfully",
        data: {
          networkId,
          members: users.map((user) => ({
            ...user,
            networkRole: user.network_roles.find(
              (nr) => nr.network._id.toString() === networkId
            ),
          })),
          totalMembers: users.length,
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
  enhancedAuth,
  requirePermissions(["ADMIN_FULL_ACCESS"]),
  debugPermissions(),
  async (req, res) => {
    try {
      const EnhancedRBACService = require("@services/enhancedRBAC.service");
      const userId = req.params.userId;
      const tenant = req.query.tenant || "airqo";

      const rbacService = new EnhancedRBACService(tenant);
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
  enhancedAuth,
  requirePermissions(["ADMIN_FULL_ACCESS"]),
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
  rateLimiter.brandedLogin,
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
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
  userController.emailReport
);

router.post(
  "/firebase/verify",
  userValidations.firebaseVerify,
  userController.verifyFirebaseCustomToken
);

router.post("/verify", setJWTAuth, authJWT, userController.verify);

router.get(
  "/combined",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
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

router.get(
  "/",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  userController.list
);

router.post(
  "/registerUser",
  userValidations.registerUser,
  userController.register
);

router.post("/", userValidations.createUser, userController.create);

router.put(
  "/updatePasswordViaEmail",
  userValidations.updatePasswordViaEmail,
  setJWTAuth,
  userController.updateForgottenPassword
);

router.put(
  "/updatePassword",
  userValidations.updatePassword,
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
  userController.delete
);

router.delete(
  "/:user_id",
  userValidations.deleteUserById,
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
  userController.listStatistics
);

router.get(
  "/cache",
  userValidations.cache,
  setJWTAuth,
  authJWT,
  userController.listCache
);

router.get(
  "/logs",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  userController.listLogs
);

router.get(
  "/user-stats",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
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

// Global error handler for this router
router.use((error, req, res, next) => {
  console.error("User Routes Error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error in user routes",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      details: error.details || {},
    }),
  });
});

module.exports = router;
