const express = require("express");
const router = express.Router();
const guestUserController = require("@controllers/guest-user.controller");
const guestUserValidations = require("@validators/guest-user.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const { validate, headers } = require("@validators/common");

router.use(headers);
router.use(guestUserValidations.pagination);

router.post(
  "/",
  guestUserValidations.create,
  validate,
  guestUserController.create
);
router.post(
  "/convert",
  setJWTAuth,
  authJWT,
  validate,
  guestUserController.convertGuest
);
router.get(
  "/",
  guestUserValidations.list,
  setJWTAuth,
  authJWT,
  validate,
  guestUserController.list
);
router.put(
  "/:id",
  guestUserValidations.update,
  setJWTAuth,
  authJWT,
  validate,
  guestUserController.update
);
router.delete(
  "/:id",
  guestUserValidations.delete,
  setJWTAuth,
  authJWT,
  validate,
  guestUserController.delete
);
router.get(
  "/:id",
  guestUserValidations.getOne,
  setJWTAuth,
  authJWT,
  validate,
  guestUserController.getOne
);

module.exports = router;
