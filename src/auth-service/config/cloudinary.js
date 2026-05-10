const cloudinary = require("cloudinary").v2;

const missing = [
  "CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
].filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Cloudinary configuration is incomplete — missing env var(s): ${missing.join(", ")}`,
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
