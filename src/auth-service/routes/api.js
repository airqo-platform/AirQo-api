const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join");
const candidateController = require("../controllers/candidate");
const validate = require("express-validation");
const userValidation = require("../utils/validations");
const { authUserLocal, authColabLocal, authJWT } = require("../services/auth");
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
router.post("/loginUser", authUserLocal, joinController.loginUser);
router.get("/", joinController.listAll);
router.post("/registerUser", joinController.registerUser);
router.post("/addWithTenant", joinController.addUserByTenant);
router.get("/email/confirm/", joinController.confirmEmail); //componentDidMount() will handle this one right here....
router.put("/updatePasswordViaEmail", joinController.updatePasswordViaEmail);
router.put("/updatePassword", joinController.updatePassword);
router.get("/reset/you", joinController.resetPassword);
router.post("/forgotPassword", joinController.forgotPassword);
router.put("/", joinController.updateUser);
router.delete("/:id", joinController.deleteUser);
router.put("/defaults/:id", joinController.updateUserDefaults);
router.get("/defaults/:id", joinController.getDefaults);
router.post("/tenants/addUser", joinController.addUserByTenant);

//************************ candidates ***********************************************
//could this be the one where we just load people with inactive status?
router.post("/register/new/candidate", candidateController.registerCandidate);
router.get("/candidates/fetch", candidateController.getAllCandidates);

//params
//router.param("userId", joinController.findUserById);

module.exports = router;
