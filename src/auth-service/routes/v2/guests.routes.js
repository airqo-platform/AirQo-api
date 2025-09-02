const express = require("express");
const router = express.Router();
const guestUserController = require("@controllers/guest-user.controller");
const guestUserValidations = require("@validators/guest-user.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
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
  enhancedJWTAuth,
  validate,
  guestUserController.convertGuest
);
router.get(
  "/",
  guestUserValidations.list,
  enhancedJWTAuth,
  validate,
  guestUserController.list
);
router.put(
  "/:id",
  guestUserValidations.update,
  enhancedJWTAuth,
  validate,
  guestUserController.update
);
router.delete(
  "/:id",
  guestUserValidations.delete,
  enhancedJWTAuth,
  validate,
  guestUserController.delete
);
router.get(
  "/:id",
  guestUserValidations.getOne,
  enhancedJWTAuth,
  validate,
  guestUserController.getOne
);

module.exports = router;
