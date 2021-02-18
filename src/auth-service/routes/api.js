const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join");
const candidateController = require("../controllers/candidate");
const validate = require("express-validation");
const userValidation = require("../utils/validations");
const {
  checkTenancy,
  authJWT,
  login,
  authUserLocal,
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
  checkTenancy,
  authJWT,
  grantAccess("readAny", "users"),
  joinController.listAll
);
router.post("/registerUser", joinController.registerUser);
router.post(
  "/addWithTenant",
  checkTenancy,
  authJWT,
  joinController.addUserByTenant
);
router.get(
  "/email/confirm/",
  checkTenancy,
  authJWT,
  joinController.confirmEmail
); //componentDidMount() will handle this one right here....
router.put(
  "/updatePasswordViaEmail",
  checkTenancy,
  joinController.updatePasswordViaEmail
);
router.put(
  "/updatePassword",
  checkTenancy,
  authJWT,
  joinController.updatePassword
);
router.get("/reset/you", checkTenancy, authJWT, joinController.resetPassword);
router.post("/forgotPassword", checkTenancy, joinController.forgotPassword);
router.put("/", checkTenancy, authJWT, joinController.updateUser);
router.delete("/", checkTenancy, authJWT, joinController.deleteUser);
router.put(
  "/defaults/",
  checkTenancy,
  authJWT,
  joinController.updateUserDefaults
);
router.get("/defaults/", checkTenancy, authJWT, joinController.getDefaults);

//************************ candidates ***********************************************
//could this be the one where we just load people with inactive status?
router.post("/register/new/candidate", candidateController.registerCandidate);
router.get(
  "/candidates/fetch",
  checkTenancy,
  authJWT,
  grantAccess("readAny", "users"),
  candidateController.getAllCandidates
);

module.exports = router;
