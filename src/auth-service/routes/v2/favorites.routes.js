// favorites.routes.js
const express = require("express");
const router = express.Router();
const createFavoriteController = require("@controllers/favorite.controller");
const favoriteValidations = require("@validators/favorites.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(favoriteValidations.pagination);

router.get(
  "/",
  favoriteValidations.list,
  enhancedJWTAuth,
  createFavoriteController.list
);

router.get(
  "/users/:firebase_user_id",
  favoriteValidations.listByUserId,
  enhancedJWTAuth,
  createFavoriteController.list
);

router.post(
  "/",
  favoriteValidations.create,
  enhancedJWTAuth,
  createFavoriteController.create
);

router.post(
  "/syncFavorites/:firebase_user_id",
  favoriteValidations.syncFavorites,
  enhancedJWTAuth,
  createFavoriteController.syncFavorites
);

router.put(
  "/:favorite_id",
  favoriteValidations.update,
  enhancedJWTAuth,
  createFavoriteController.update
);

router.delete(
  "/:favorite_id",
  favoriteValidations.deleteFavorite,
  enhancedJWTAuth,
  createFavoriteController.delete
);

router.get(
  "/:favorite_id",
  favoriteValidations.getById,
  enhancedJWTAuth,
  createFavoriteController.list
);

module.exports = router;
