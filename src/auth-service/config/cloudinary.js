const cloudinary = require("cloudinary").v2;

const missing = [
  "CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
].filter((key) => !process.env[key]);

// Under NODE_ENV=test, requiring this module (transitively, e.g. via
// utils/user.util.js) shouldn't crash unit tests just because real Cloudinary
// credentials aren't configured — no test exercises real image uploads.
if (missing.length > 0 && process.env.NODE_ENV !== "test") {
  throw new Error(
    `Cloudinary configuration is incomplete — missing env var(s): ${missing.join(", ")}`,
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || "test",
  api_key: process.env.CLOUDINARY_API_KEY || "test",
  api_secret: process.env.CLOUDINARY_API_SECRET || "test",
});

module.exports = cloudinary;
