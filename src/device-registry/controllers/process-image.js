const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const HTTPStatus = require("http-status");

const processImage = {
  uploadMany: async (req, res) => {
    const uploader = async (path) => {
      await cloudinary.uploads(path, "Images");
    };
    const urls = [];
    const files = req.files;

    for (const file of files) {
      const { path } = file;
      const newPath = await uploader(path);
      urls.push(newPath);
      fs.unlinkSync(path);
    }

    res.status(HTTPStatus.OK).json({
      success: true,
      message: "images uploaded successfully",
      data: urls,
    });
  },
};

module.exports = processImage;
