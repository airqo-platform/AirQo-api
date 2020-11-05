const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join");
const candidateController = require("../controllers/candidate");
const validate = require("express-validation");
const userValidation = require("../utils/validations");
const {
  jwtAuth,
  authJWT,
  login,
  authUserLocal,
  allowIfLoggedin,
  grantAccess,
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
    return authUserLocal;
  }
};

//************************* users ***************************************************
router.post("/loginUser", login, authUserLocal, joinController.loginUser);
router.get(
  "/",
  jwtAuth,
  authJWT,
  grantAccess("readAny", "users"),
  joinController.listAll
);
router.post("/registerUser", joinController.registerUser);
router.post("/addWithTenant", jwtAuth, authJWT, joinController.addUserByTenant);
router.get("/email/confirm/", jwtAuth, authJWT, joinController.confirmEmail); //componentDidMount() will handle this one right here....
router.put(
  "/updatePasswordViaEmail",
  jwtAuth,
  authJWT,
  joinController.updatePasswordViaEmail
);
router.put("/updatePassword", jwtAuth, authJWT, joinController.updatePassword);
router.get("/reset/you", jwtAuth, authJWT, joinController.resetPassword);
router.post("/forgotPassword", jwtAuth, joinController.forgotPassword);
router.put(
  "/",
  jwtAuth,
  authJWT,
  grantAccess("updateAny", "profile"),
  joinController.updateUser
);
router.delete(
  "/",
  jwtAuth,
  authJWT,
  grantAccess("deleteAny", "profile"),
  joinController.deleteUser
);
router.put("/defaults/", jwtAuth, authJWT, joinController.updateUserDefaults);
router.get("/defaults/", jwtAuth, authJWT, joinController.getDefaults);

//************************ candidates ***********************************************
//could this be the one where we just load people with inactive status?
router.post("/register/new/candidate", candidateController.registerCandidate);
router.get(
  "/candidates/fetch",
  jwtAuth,
  authJWT,
  grantAccess("readAny", "users"),
  candidateController.getAllCandidates
);

module.exports = router;
