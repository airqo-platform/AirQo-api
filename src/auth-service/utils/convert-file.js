const httpStatus = require("http-status");
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- convert-file-util`
);
const { HttpError } = require("@utils/errors");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const convertFile = {
  converPdfToDocx: async (request, next) => {
    try {
      logText(" V3 convertPdfToDocx...");

      // Assuming the Blob contains text that you want to convert to DOCX
      const blobText = request.file.buffer.toString("utf8");

      // Convert the text to DOCX using mammoth
      const docxBuffer = await mammoth.convertToBuffer(blobText, {
        outputFormat: "docx",
      });

      // Save the DOCX file to the server
      const docxPath = path.join(__dirname, "output.docx");
      fs.writeFileSync(docxPath, docxBuffer);

      return {
        success: true,
        message: "Blob successfully converted to docx",
        status: httpStatus.OK,
        data: docxPath,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = convertFile;
