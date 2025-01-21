// users.routes.js
const express = require("express");
const router = express.Router();
const createUserController = require("@controllers/user.controller");
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

router.get(
  "/deleteMobileUserData/:userId/:token",
  userValidations.deleteMobileUserData,
  createUserController.deleteMobileUserData
);

router.post(
  "/loginUser",
  userValidations.login,
  setLocalAuth,
  authLocal,
  createUserController.login
);

router.post(
  "/login",
  userValidations.login,
  setLocalAuth,
  authLocal,
  createUserController.login
);

router.post(
  "/login-with-details",
  userValidations.login,
  setLocalAuth,
  authLocal,
  createUserController.loginWithDetails
);

router.get(
  "/logout",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  createUserController.logout
);

router.post(
  "/guest",
  userValidations.tenant,
  setGuestToken,
  authGuest,
  createUserController.guest
);

router.post(
  "/emailLogin",
  userValidations.emailLogin,
  createUserController.loginInViaEmail
);

router.post(
  "/emailAuth/:purpose?",
  userValidations.emailAuth,
  createUserController.emailAuth
);

router.post(
  "/feedback",
  userValidations.feedback,
  createUserController.sendFeedback
);

router.post(
  "/firebase/lookup",
  userValidations.firebaseLookup,
  createUserController.lookUpFirebaseUser
);

router.post(
  "/firebase/create",
  userValidations.firebaseCreate,
  createUserController.createFirebaseUser
);

router.post(
  "/firebase/login",
  userValidations.firebaseLogin,
  createUserController.loginWithFirebase
);

router.post(
  "/firebase/signup",
  userValidations.firebaseSignup,
  createUserController.signUpWithFirebase
);

router.post(
  "/syncAnalyticsAndMobile",
  userValidations.syncAnalyticsAndMobile,
  createUserController.syncAnalyticsAndMobile
);

router.post(
  "/emailReport",
  userValidations.emailReport,
  setJWTAuth,
  authJWT,
  createUserController.emailReport
);

router.post(
  "/firebase/verify",
  userValidations.firebaseVerify,
  createUserController.verifyFirebaseCustomToken
);

router.post("/verify", setJWTAuth, authJWT, createUserController.verify);

router.get(
  "/combined",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  createUserController.listUsersAndAccessRequests
);

router.get(
  "/verify/:user_id/:token",
  userValidations.verifyEmail,
  createUserController.verifyEmail
);

router.get(
  "/auth/google/callback",
  setGoogleAuth,
  authGoogleCallback,
  createUserController.googleCallback
);

router.get(
  "/auth/google",
  setGoogleAuth,
  authGoogle,
  createUserController.login
);

router.get(
  "/",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  createUserController.list
);

router.post(
  "/registerUser",
  userValidations.registerUser,
  createUserController.register
);

router.post("/", userValidations.createUser, createUserController.create);

router.put(
  "/updatePasswordViaEmail",
  userValidations.updatePasswordViaEmail,
  setJWTAuth,
  createUserController.updateForgottenPassword
);

router.put(
  "/updatePassword",
  userValidations.updatePassword,
  setJWTAuth,
  authJWT,
  createUserController.updateKnownPassword
);

router.post(
  "/forgotPassword",
  userValidations.forgotPassword,
  createUserController.forgot
);

router.put("/", userValidations.updateUser, createUserController.update);

router.put(
  "/:user_id",
  userValidations.updateUserById,
  createUserController.update
);

router.delete(
  "/",
  userValidations.deleteUser,
  setJWTAuth,
  authJWT,
  createUserController.delete
);

router.delete(
  "/:user_id",
  userValidations.deleteUserById,
  setJWTAuth,
  authJWT,
  createUserController.delete
);

router.post(
  "/newsletter/subscribe",
  userValidations.newsletterSubscribe,
  createUserController.subscribeToNewsLetter
);

router.post(
  "/newsletter/resubscribe",
  userValidations.newsletterResubscribe,
  createUserController.reSubscribeToNewsLetter
);

router.post(
  "/newsletter/unsubscribe",
  userValidations.newsletterUnsubscribe,
  createUserController.unSubscribeFromNewsLetter
);

router.get(
  "/stats",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  createUserController.listStatistics
);

router.get(
  "/cache",
  userValidations.cache,
  setJWTAuth,
  authJWT,
  createUserController.listCache
);

router.get(
  "/logs",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  createUserController.listLogs
);

router.get(
  "/user-stats",
  userValidations.tenant,
  setJWTAuth,
  authJWT,
  createUserController.getUserStats
);

router.post(
  "/subscribe/:type",
  userValidations.subscribeToNotifications,
  createUserController.subscribeToNotifications
);

router.post(
  "/unsubscribe/:type",
  userValidations.unSubscribeFromNotifications,
  createUserController.unSubscribeFromNotifications
);

router.post(
  "/notification-status/:type",
  userValidations.notificationStatus,
  createUserController.checkNotificationStatus
);

router.get(
  "/:user_id",
  userValidations.getUser,
  setJWTAuth,
  authJWT,
  createUserController.list
);

module.exports = router;
