const express = require("express");
const router = express.Router();
const guestUserController = require("@controllers/guest-user.controller");
const guestUserValidations = require("@validators/guest-user.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
router.use(guestUserValidations.pagination);

router.post("/", guestUserValidations.create, guestUserController.create);
router.post("/convert", setJWTAuth, authJWT, guestUserController.convertGuest);
router.get(
  "/",
  guestUserValidations.list,
  setJWTAuth,
  authJWT,
  guestUserController.list
);
router.put(
  "/:id",
  guestUserValidations.update,
  setJWTAuth,
  authJWT,
  guestUserController.update
);
router.delete(
  "/:id",
  guestUserValidations.delete,
  setJWTAuth,
  authJWT,
  guestUserController.delete
);
router.get(
  "/:id",
  guestUserValidations.getOne,
  setJWTAuth,
  authJWT,
  guestUserController.getOne
);

module.exports = router;
