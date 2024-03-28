const httpStatus = require("http-status");
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- convert-file-util`
);
const { HttpError } = require("@utils/errors");
const officegen = require("pdf-officegen");

const convertFile = {
  convertPdfToDocx: async (request, next) => {
    try {
      logText("convertPdfToDocx...");
      const { file } = {
        ...request,
      };
      // Convert PDF to DOCX
      const pdfBuffer = Buffer.from(file.buffer);
      const docxStream = officegen("docx").convert(pdfBuffer);
      logObject("docxStream", docxStream);
      return {
        success: true,
        message: "Conversion Successful",
        data: docxStream,
        status: httpStatus.OK,
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
