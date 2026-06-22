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
  refreshTokenAuth,
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
  "/token/refresh",
  rateLimiter.apiGeneral,
  refreshTokenAuth,
  userController.refreshToken,
);

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
// GET    /feedback/upload-url                               – public
// POST   /feedback/submit                                   – public
// GET    /feedback/submissions                              – admin; list with filtering
// PATCH  /feedback/submissions/bulk-status                 – admin; bulk status update
// GET    /feedback/submissions/:feedback_id                – admin; single submission
// PATCH  /feedback/submissions/:feedback_id/status        – admin; status update + notifies submitter
// POST   /feedback/submissions/:feedback_id/reply         – admin; reply email to submitter
// PATCH  /feedback/submissions/:feedback_id/notes         – admin; internal notes
// PATCH  /feedback/submissions/:feedback_id/assign        – admin; assign to an admin user
// POST   /feedback/submissions/:feedback_id/watchers      – admin; add watcher
// DELETE /feedback/submissions/:feedback_id/watchers/:watcher_email – admin; remove watcher
// POST   /feedback/webhooks                               – admin; register webhook
// GET    /feedback/webhooks                               – admin; list webhooks
// PATCH  /feedback/webhooks/:webhook_id                  – admin; update webhook
// DELETE /feedback/webhooks/:webhook_id                  – admin; delete webhook
// ================================

router.get(
  "/feedback/upload-url",
  userValidations.getFeedbackUploadUrl,
  validate,
  rateLimiter.apiGeneral,
  userController.getFeedbackUploadUrl,
);

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

// Must be registered before /:feedback_id routes to prevent "bulk-status" being
// interpreted as a feedback_id param.
router.patch(
  "/feedback/submissions/bulk-status",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.bulkUpdateFeedbackStatus,
  validate,
  userController.bulkUpdateFeedbackStatus,
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
  "/feedback/submissions/:feedback_id/reply",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.replyToFeedback,
  validate,
  userController.replyToFeedback,
);

router.patch(
  "/feedback/submissions/:feedback_id/notes",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.updateFeedbackNotes,
  validate,
  userController.updateFeedbackNotes,
);

router.patch(
  "/feedback/submissions/:feedback_id/assign",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.assignFeedback,
  validate,
  userController.assignFeedback,
);

router.post(
  "/feedback/submissions/:feedback_id/watchers",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.addFeedbackWatcher,
  validate,
  userController.addFeedbackWatcher,
);

router.delete(
  "/feedback/submissions/:feedback_id/watchers/:watcher_email",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.removeFeedbackWatcher,
  validate,
  userController.removeFeedbackWatcher,
);

// ── WEBHOOK MANAGEMENT ────────────────────────────────────────────────────────

router.post(
  "/feedback/webhooks",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.registerWebhook,
  validate,
  userController.registerWebhook,
);

router.get(
  "/feedback/webhooks",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.listWebhooks,
  validate,
  userController.listWebhooks,
);

router.patch(
  "/feedback/webhooks/:webhook_id",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.updateWebhook,
  validate,
  userController.updateWebhook,
);

router.delete(
  "/feedback/webhooks/:webhook_id",
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  userValidations.deleteWebhook,
  validate,
  userController.deleteWebhook,
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
  "/setPassword",
  enhancedJWTAuth,
  userValidations.setPassword,
  userController.setPassword,
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

router.put("/setPassword", (req, res) =>
  res.status(405).json({ success: false, message: "Method not allowed. Use POST /setPassword." })
);
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

// Onboarding checklist
router.patch(
  "/onboarding",
  enhancedJWTAuth,
  userValidations.updateOnboarding,
  validate,
  userController.updateOnboarding,
);

// ================================
// ERROR HANDLING
// ================================

router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "user route endpoint not found",
  });
});

module.exports = router;
