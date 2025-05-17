// users.routes.js
const express = require("express");
const router = express.Router();
const userController = require("@controllers/user.controller");
const userValidations = require("@validators/users.validators");
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

module.exports = router;
