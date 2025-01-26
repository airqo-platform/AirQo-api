// photos.routes.js
const express = require("express");
const router = express.Router();
const photoController = require("@controllers/photo.controller");
const photoValidations = require("@validators/photos.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.delete("/", photoValidations.deletePhoto, photoController.delete);

router.post("/", photoValidations.createPhoto, photoController.create);

router.put("/", photoValidations.updatePhoto, photoController.update);

router.get("/", photoValidations.listPhotos, photoController.list);

router.post(
  "/soft",
  photoValidations.createPhotoOnPlatform,
  photoController.createPhotoOnPlatform
);

router.put(
  "/soft",
  photoValidations.updatePhotoOnPlatform,
  photoController.updatePhotoOnPlatform
);

router.delete(
  "/soft",
  photoValidations.deletePhotoOnPlatform,
  photoController.deletePhotoOnPlatform
);

router.post(
  "/cloud",
  photoValidations.createPhotoOnCloudinary,
  photoController.createPhotoOnCloudinary
);

router.delete(
  "/cloud",
  photoValidations.deletePhotoOnCloudinary,
  photoController.deletePhotoOnCloudinary
);

router.put(
  "/cloud",
  photoValidations.updatePhotoOnCloudinary,
  photoController.updatePhotoOnCloudinary
);

module.exports = router;
