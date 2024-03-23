const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const convertFileUtil = require("@utils/convert-file");
const { logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- convert-file-controller`
);

const convertFile = {
  convertPdfToDocx: async (req, res, next) => {
    try {
      logText("we are listing users with type....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await convertFileUtil.convertPdfToDocx(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=converted.docx"
        );
        const docxStream = result.data;

        // return res.status(httpStatus.OK).json({
        //   success: true,
        //   message: result.message,
        //   docxStream,
        // });

        docxStream.pipe(res);
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Error" },
        });
      }
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
