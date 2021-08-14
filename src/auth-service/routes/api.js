const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join");
const requestController = require("../controllers/request");
const defaultsController = require("../controllers/defaults");

const {
  setJWTAuth,
  authJWT,
  setLocalAuth,
  authLocal,
} = require("../services/auth");
const privileges = require("../utils/privileges");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);

//************************* users ***************************************************
router.post("/loginUser", setLocalAuth, authLocal, joinController.login);
router.get("/", setJWTAuth, authJWT, joinController.list);
router.post("/verify", setJWTAuth, authJWT, joinController.verify);
router.post("/registerUser", joinController.register);
router.get("/email/confirm/", setJWTAuth, authJWT, joinController.confirmEmail);
router.put(
  "/updatePasswordViaEmail",
  setJWTAuth,
  joinController.updateForgottenPassword
);
router.put(
  "/updatePassword",
  setJWTAuth,
  authJWT,
  joinController.updateKnownPassword
);
router.post("/forgotPassword", joinController.forgot);
router.put("/", setJWTAuth, authJWT, joinController.update);
router.delete("/", setJWTAuth, authJWT, joinController.delete);

/************************* settings/defaults **********************************/
router.put("/defaults/", setJWTAuth, authJWT, defaultsController.update);
router.get("/defaults/", setJWTAuth, authJWT, defaultsController.list);

//************************ candidates ***********************************************
router.post("/candidates/register", requestController.create);
router.get("/candidates", setJWTAuth, authJWT, requestController.list);
router.post(
  "/candidates/confirm",
  setJWTAuth,
  authJWT,
  requestController.confirm
);
router.delete("/candidates", setJWTAuth, authJWT, requestController.delete);
router.put("/candidates", setJWTAuth, authJWT, requestController.update);

module.exports = router;
