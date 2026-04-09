// users.routes.js
const express = require("express");
const router = express.Router();
const userController = require("@controllers/user.controller");
const userValidations = require("@validators/users.validators");
const { validate, headers, pagination } = require("@validators/common");
const constants = require("@config/constants");
const {
  setLocalAuth,
  setGoogleAuth,
  setOAuthProvider,
  authGoogleCallback,
  authOAuth,
  authOAuthCallback,
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

// ================================
// AUTHENTICATION ROUTES
// ================================

router.post(
  "/login-enhanced",
  userValidations.loginEnhanced,
  validate,
  userController.loginEnhanced,
);

router.post(
  "/login-legacy-compatible",
  userValidations.loginLegacyCompatible,
  validate,
  userController.loginLegacyCompatible,
);

router.post(
  "/admin/cleanup",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  userValidations.userCleanup,
  userController.cleanup,
);

// ================================
// TOKEN MANAGEMENT ROUTES
// ================================

router.post(
  "/generate-token",
  enhancedJWTAuth,
  userValidations.generateToken,
  requirePermissions(["TOKEN_GENERATE"]),
  validate,
  userController.generateOptimizedToken,
);

router.post(
  "/refresh-permissions",
  enhancedJWTAuth,
  userValidations.refreshPermissions,
  validate,
  userController.refreshPermissions,
);

router.get(
  "/analyze-tokens/:userId",
  enhancedJWTAuth,
  userValidations.analyzeTokenStrategies,
  requirePermissions(["SYSTEM_ADMIN"]),
  validate,
  userController.analyzeTokenStrategies,
);

router.put(
  "/token-strategy",
  enhancedJWTAuth,
  userValidations.updateTokenStrategy,
  validate,
  userController.updateTokenStrategy,
);

// ================================
// PERMISSION & CONTEXT ROUTES
// ================================

router.get(
  "/context-permissions",
  enhancedJWTAuth,
  userValidations.getContextPermissions,
  validate,
  userController.getContextPermissions,
);

router.get(
  "/profile/enhanced",
  enhancedJWTAuth,
  userController.getEnhancedProfile,
);

// ================================
// GROUP-SPECIFIC ROUTES
// ================================

router.get(
  "/groups/:grp_id/permissions",
  enhancedJWTAuth,
  requireGroupMembership("grp_id"),
  (req, res) => {
    req.query.contextId = req.params.grp_id;
    req.query.contextType = "group";
    userController.getContextPermissions(req, res);
  },
);

// ================================
// NETWORK-SPECIFIC ROUTES
// ================================

router.get(
  "/networks/:network_id/permissions",
  enhancedJWTAuth,
  requireNetworkMembership("network_id"),
  (req, res) => {
    req.query.contextId = req.params.network_id;
    req.query.contextType = "network";
    userController.getContextPermissions(req, res);
  },
);

router.get(
  "/networks/:network_id/members",
  enhancedJWTAuth,
  requireNetworkPermissions([constants.MEMBER_VIEW], "network_id"),
  async (req, res) => {
    try {
      const UserModel = require("@models/User");
      const networkId = req.params.network_id;
      const tenant = req.query.tenant || "airqo";

      const users = await UserModel(tenant)
        .find({ "network_roles.network": networkId })
        .select("-password -resetPasswordToken -resetPasswordExpires")
        .lean();

      if (users.length === 0) {
        return res.json({
          success: true,
          message: "No network members found",
          data: { networkId, members: [], totalMembers: 0 },
        });
      }

      const processedUsers = [];
      for (const user of users) {
        const processedUser = { ...user };
        if (user.network_roles && user.network_roles.length > 0) {
          const networkIds = [
            ...new Set(user.network_roles.map((nr) => nr.network)),
          ];
          const roleIds = [
            ...new Set(user.network_roles.map((nr) => nr.role).filter(Boolean)),
          ];

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

          processedUser.network_roles = user.network_roles.map(
            (networkRole) => ({
              ...networkRole,
              network:
                networks.find(
                  (n) => n._id.toString() === networkRole.network.toString(),
                ) || networkRole.network,
              role:
                roles.find(
                  (r) => r._id.toString() === networkRole.role?.toString(),
                ) || networkRole.role,
            }),
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
                nr.network.toString() === networkId,
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
  },
);

// ================================
// DASHBOARD & ANALYTICS ROUTES
// ================================

router.get(
  "/dashboard/analytics",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  userController.getDashboardAnalyticsFromCache,
);

router.get(
  "/dashboard/analytics/live",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  userController.getDashboardAnalyticsDirect,
);

// ================================
// ADMIN & DEBUG ROUTES
// ================================

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
  },
);

router.get(
  "/admin/token-analytics",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  async (req, res) => {
    try {
      const { tokenConfig } = require("@config/tokenStrategyConfig");
      const UserModel = require("@models/User");
      const tenant = req.query.tenant || "airqo";
      const strategyDistribution = await UserModel(tenant).aggregate([
        {
          $group: {
            _id: "$preferredTokenStrategy",
            count: { $sum: 1 },
            users: { $push: { id: "$_id", email: "$email" } },
          },
        },
        { $sort: { count: -1 } },
      ]);
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
  },
);

// ================================
// ORGANIZATION ROUTES
// ================================

router.get(
  "/organizations/:org_slug",
  userValidations.getOrganizationBySlug,
  userController.getOrganizationBySlug,
);

router.post(
  "/register/:org_slug",
  rateLimiter.registration,
  captchaMiddleware.verify,
  analyticsMiddleware.trackRegistration,
  userValidations.registerViaOrgSlug,
  userController.registerViaOrgSlug,
);

// ================================
// GOOGLE OAUTH ROUTES
// Legacy routes kept for backward compatibility with existing frontends.
// These must be declared before the generic /auth/:provider routes so that
// Express matches them first (more specific → less specific).
// ================================

router.get(
  "/auth/google/callback",
  setGoogleAuth,
  authGoogleCallback,
  userController.googleCallback,
);

router.get("/auth/google", setGoogleAuth, authGoogle);

// ================================
// GENERIC OAUTH ROUTES (new providers)
// These handle any future provider: /auth/linkedin, /auth/callback/linkedin, etc.
// Placed after the specific Google routes to avoid shadowing them.
// ================================

router.get(
  "/auth/callback/:provider",
  setOAuthProvider,
  authOAuthCallback,
  userController.oauthCallback,
);

router.get("/auth/:provider", setOAuthProvider, authOAuth);

// ================================
// USER CRUD & AUTH ROUTES
// ================================

router.get(
  "/deleteMobileUserData/:userId/:token",
  userValidations.deleteMobileUserData,
  userController.deleteMobileUserData,
);

router.post(
  "/loginUser",
  userValidations.login,
  setLocalAuth,
  authLocal,
  userController.login,
);

router.post(
  "/login",
  userValidations.login,
  setLocalAuth,
  authLocal,
  userController.login,
);

router.post(
  "/login-with-details",
  userValidations.login,
  setLocalAuth,
  authLocal,
  userController.loginWithDetails,
);

router.get(
  "/logout",
  userValidations.tenant,
  enhancedJWTAuth,
  userController.logout,
);

router.post(
  "/guest",
  userValidations.tenant,
  setGuestToken,
  authGuest,
  userController.guest,
);

router.post(
  "/emailLogin",
  userValidations.emailLogin,
  userController.loginInViaEmail,
);

router.post(
  "/emailAuth/:purpose?",
  userValidations.emailAuth,
  userController.emailAuth,
);

router.post("/feedback", userValidations.feedback, userController.sendFeedback);

// ================================
// PERSISTENT FEEDBACK / RATING ROUTES
// POST   /feedback/submit      – public; saves to DB and dispatches support email
// GET    /feedback/submissions  – admin; list all feedback with filtering
// GET    /feedback/submissions/:feedback_id – admin; get single submission
// PATCH  /feedback/submissions/:feedback_id/status – admin; update status
// ================================

router.post(
  "/feedback/submit",
  userValidations.submitFeedback,
  validate,
  userController.submitFeedback,
);

router.get(
  "/feedback/submissions",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.listFeedbackSubmissions,
  validate,
  userController.listFeedbackSubmissions,
);

router.get(
  "/feedback/submissions/:feedback_id",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.getFeedbackById,
  validate,
  userController.getFeedbackSubmission,
);

router.patch(
  "/feedback/submissions/:feedback_id/status",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.updateFeedbackStatus,
  validate,
  userController.updateFeedbackStatus,
);

router.post(
  "/firebase/lookup",
  userValidations.firebaseLookup,
  userController.lookUpFirebaseUser,
);

router.post(
  "/firebase/create",
  userValidations.firebaseCreate,
  userController.createFirebaseUser,
);

router.post(
  "/firebase/login",
  userValidations.firebaseLogin,
  userController.loginWithFirebase,
);

router.post(
  "/firebase/signup",
  userValidations.firebaseSignup,
  userController.signUpWithFirebase,
);

router.post(
  "/syncAnalyticsAndMobile",
  userValidations.syncAnalyticsAndMobile,
  userController.syncAnalyticsAndMobile,
);

router.post(
  "/emailReport",
  userValidations.emailReport,
  enhancedJWTAuth,
  userController.emailReport,
);

router.post(
  "/firebase/verify",
  userValidations.firebaseVerify,
  userController.verifyFirebaseCustomToken,
);

router.post("/verify", enhancedJWTAuth, userController.verify);

router.get(
  "/combined",
  userValidations.tenant,
  enhancedJWTAuth,
  pagination(),
  userController.listUsersAndAccessRequests,
);

router.get(
  "/verify/:user_id/:token",
  userValidations.verifyEmail,
  userController.verifyEmail,
);

router.get("/", userValidations.tenant, enhancedJWTAuth, userController.list);

router.post(
  "/registerUser",
  userValidations.registerUser,
  userController.register,
);

router.post("/", userValidations.createUser, userController.create);

router.put(
  "/updatePasswordViaEmail",
  userValidations.updatePasswordViaEmail,
  userController.updateForgottenPassword,
);

router.put(
  "/updatePassword",
  userValidations.updatePassword,
  enhancedJWTAuth,
  userController.updateKnownPassword,
);

router.post(
  "/forgotPassword",
  userValidations.forgotPassword,
  userController.forgot,
);

router.post(
  "/reset-password-request",
  userValidations.resetPasswordRequest,
  userController.resetPasswordRequest,
);

router.post(
  "/reset-password/:token",
  userValidations.resetPassword,
  userController.resetPassword,
);

router.post(
  "/register",
  userValidations.createUser,
  userController.registerMobileUser,
);

router.patch(
  "/consent",
  enhancedJWTAuth,
  userValidations.updateConsent,
  validate,
  userController.updateConsent,
);

router.post(
  "/verify-email/:token",
  userValidations.verifyMobileEmail,
  userController.verifyMobileEmail,
);

router.put("/", userValidations.updateUser, userController.update);

router.put("/:user_id", userValidations.updateUserById, userController.update);

router.delete(
  "/",
  userValidations.deleteUser,
  enhancedJWTAuth,
  requirePermissions([constants.USER_DELETE]),
  userController.delete,
);

router.post(
  "/delete/initiate",
  enhancedJWTAuth,
  userValidations.initiateAccountDeletion,
  validate,
  userController.initiateAccountDeletion,
);

router.post(
  "/delete/confirm/:token",
  userValidations.confirmAccountDeletion,
  validate,
  userController.confirmAccountDeletion,
);

router.post(
  "/delete/mobile/initiate",
  enhancedJWTAuth,
  userValidations.initiateAccountDeletion,
  validate,
  userController.initiateMobileAccountDeletion,
);

router.post(
  "/delete/mobile/confirm",
  userValidations.confirmMobileAccountDeletion,
  validate,
  userController.confirmMobileAccountDeletion,
);

router.delete(
  "/:user_id",
  userValidations.deleteUserById,
  enhancedJWTAuth,
  requirePermissions([constants.USER_DELETE]),
  userController.delete,
);

router.post(
  "/newsletter/subscribe",
  userValidations.newsletterSubscribe,
  userController.subscribeToNewsLetter,
);

router.post(
  "/newsletter/resubscribe",
  userValidations.newsletterResubscribe,
  userController.reSubscribeToNewsLetter,
);

router.post(
  "/newsletter/unsubscribe",
  userValidations.newsletterUnsubscribe,
  userController.unSubscribeFromNewsLetter,
);

router.get(
  "/stats",
  userValidations.tenant,
  enhancedJWTAuth,
  pagination(),
  requirePermissions([constants.SYSTEM_ADMIN]),
  userController.listStatistics,
);

router.get(
  "/cache",
  userValidations.cache,
  enhancedJWTAuth,
  pagination(),
  requirePermissions([constants.SYSTEM_ADMIN]),
  userController.listCache,
);

router.get(
  "/logs",
  userValidations.tenant,
  enhancedJWTAuth,
  pagination(),
  requirePermissions([constants.SYSTEM_ADMIN]),
  userController.listLogs,
);

router.post(
  "/subscribe/:type",
  userValidations.subscribeToNotifications,
  userController.subscribeToNotifications,
);

router.post(
  "/unsubscribe/:type",
  userValidations.unSubscribeFromNotifications,
  userController.unSubscribeFromNotifications,
);

router.post(
  "/notification-status/:type",
  userValidations.notificationStatus,
  userController.checkNotificationStatus,
);

router.get(
  "/:user_id/profile/enhanced",
  enhancedJWTAuth,
  userValidations.getEnhancedProfileForUser,
  validate,
  userController.getEnhancedProfileForUser,
);

router.get(
  "/:user_id",
  userValidations.getUser,
  pagination(),
  enhancedJWTAuth,
  userController.list,
);

router.post(
  "/:user_id/cohorts/assign",
  enhancedJWTAuth,
  userValidations.assignCohorts,
  validate,
  userController.assignCohorts,
);

router.get(
  "/:user_id/cohorts",
  enhancedJWTAuth,
  userValidations.getUser,
  pagination(),
  validate,
  userController.listCohorts,
);

// ================================
// ERROR HANDLING
// ================================

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
      "GET /auth/google",
      "GET /auth/google/callback",
      "GET /auth/:provider",
      "GET /auth/callback/:provider",
      "POST /feedback/submit",
      "GET /feedback/submissions",
      "GET /feedback/submissions/:feedback_id",
      "PATCH /feedback/submissions/:feedback_id/status",
    ],
  });
});

module.exports = router;
