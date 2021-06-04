const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join");
const requestController = require("../controllers/request");
const validate = require("express-validation");
const userValidation = require("../utils/validations");
const {
  setJWTAuth,
  authJWT,
  setLocalAuth,
  authLocal,
} = require("../services/auth");
const privileges = require("../utils/privileges");

//the middleware function
const middleware = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(middleware);

const checkAuth = () => {
  if (privileges.isCollab) {
    return authColabLocal;
  } else if (privileges.isUser) {
    return authLocal;
  }
};

//************************* users ***************************************************
router.post("/loginUser", setLocalAuth, authLocal, joinController.loginUser);
router.get("/", setJWTAuth, authJWT, joinController.listAll);
router.post("/registerUser", joinController.registerUser);
router.post(
  "/addWithTenant",
  setJWTAuth,
  authJWT,
  joinController.addUserByTenant
);
router.get("/email/confirm/", setJWTAuth, authJWT, joinController.confirmEmail); //componentDidMount() will handle this one right here....
router.put(
  "/updatePasswordViaEmail",
  setJWTAuth,
  joinController.updatePasswordViaEmail
);
router.put(
  "/updatePassword",
  setJWTAuth,
  authJWT,
  joinController.updatePassword
);
router.get("/reset/you", setJWTAuth, authJWT, joinController.resetPassword);
router.post("/forgotPassword", setJWTAuth, joinController.forgotPassword);
router.put("/", setJWTAuth, authJWT, joinController.updateUser);
router.delete("/", setJWTAuth, authJWT, joinController.deleteUser);
router.put(
  "/defaults/",
  setJWTAuth,
  authJWT,
  joinController.updateUserDefaults
);
router.get("/defaults/", setJWTAuth, authJWT, joinController.getDefaults);

//************************ candidates ***********************************************
//could this be the one where we just load people with inactive status?
router.post("/register/new/candidate", requestController.registerCandidate);
router.get(
  "/candidates/fetch",
  setJWTAuth,
  authJWT,
  requestController.getAllCandidates
);
router.post("/confirm/new/candidate", requestController.confirmCandidate);

module.exports = router;
