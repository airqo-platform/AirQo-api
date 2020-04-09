const express = require("express");
const router = express.Router();
const joinController = require("../controllers/join");
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

router.post("/loginUser", authUserLocal, joinController.loginUser);
router.post(
  "/loginCollaborator",
  authColabLocal,
  joinController.loginCollaborator
);
router.post("/logout", joinController.logout);

//admin users
router.get("/", authJWT, joinController.listAll);
router.get("/:id", authJWT, joinController.listOne);
router.post(
  "/register",
  validate(userValidation.register),
  joinController.register
);
router.delete("/:id", authJWT, joinController.deleteUser);
router.put("/:id", authJWT, joinController.updateUser);
router.post("/logout/:id", authJWT, joinController.logout);
router.get("/email/confirm/:id", joinController.confirmEmail); //componentDidMount() will handle this one right here....
router.put("/updatePasswordViaEmail", joinController.updatePasswordViaEmail);
router.get("/reset/:resetPasswordToken", joinController.resetPassword);
router.post("/forgotPassword/:email", authJWT, joinController.forgotPassword);
router.get("/findUser", joinController.findUser);

//collaborators
router.post(
  "/register/collab",
  authJWT,
  privileges.isColabAdmin,
  joinController.addCollaborator
);
router.put(
  "/update/collab/:id",
  authJWT,
  privileges.isColabAdmin,
  joinController.updateCollaborator
);
router.delete(
  "/delete/collab/:id",
  authJWT,
  privileges.isColabAdmin,
  joinController.deleteCollaborator
);

//params
router.param("userId", joinController.findUserById);

module.exports = router;
