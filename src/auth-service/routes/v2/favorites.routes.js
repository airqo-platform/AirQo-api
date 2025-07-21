// favorites.routes.js
const express = require("express");
const router = express.Router();
const createFavoriteController = require("@controllers/favorite.controller");
const favoriteValidations = require("@validators/favorites.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
router.use(favoriteValidations.pagination);

router.get(
  "/",
  favoriteValidations.list,
  setJWTAuth,
  authJWT,
  createFavoriteController.list
);

router.get(
  "/users/:firebase_user_id",
  favoriteValidations.listByUserId,
  setJWTAuth,
  authJWT,
  createFavoriteController.list
);

router.post(
  "/",
  favoriteValidations.create,
  setJWTAuth,
  authJWT,
  createFavoriteController.create
);

router.post(
  "/syncFavorites/:firebase_user_id",
  favoriteValidations.syncFavorites,
  setJWTAuth,
  authJWT,
  createFavoriteController.syncFavorites
);

router.put(
  "/:favorite_id",
  favoriteValidations.update,
  setJWTAuth,
  authJWT,
  createFavoriteController.update
);

router.delete(
  "/:favorite_id",
  favoriteValidations.deleteFavorite,
  setJWTAuth,
  authJWT,
  createFavoriteController.delete
);

router.get(
  "/:favorite_id",
  favoriteValidations.getById,
  setJWTAuth,
  authJWT,
  createFavoriteController.list
);

module.exports = router;
