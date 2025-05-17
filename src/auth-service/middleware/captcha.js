// middleware/captcha.js
const httpStatus = require("http-status");
const constants = require("@config/constants");
const axios = require("axios");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- captcha-middleware`
);
const { HttpError } = require("@utils/shared");

module.exports = {
  verify: async (req, res, next) => {
    try {
      // Get the captcha token from the request
      const { captchaToken } = req.body;

      // Skip verification in non-production environments if configured
      if (
        constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT" &&
        constants.BYPASS_CAPTCHA
      ) {
        logger.info(
          "Captcha verification bypassed in non-production environment"
        );
        return next();
      }

      // If no token provided
      if (!captchaToken) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Captcha verification failed. Please try again.",
          })
        );
      }

      // Verify the captcha token with Google reCAPTCHA API
      const response = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        null,
        {
          params: {
            secret: constants.RECAPTCHA_SECRET_KEY,
            response: captchaToken,
          },
        }
      );

      // If verification failed
      if (!response.data.success) {
        logger.warn(
          `Captcha verification failed: ${JSON.stringify(response.data)}`
        );
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Captcha verification failed. Please try again.",
          })
        );
      }

      // Verification succeeded
      logger.info("Captcha verification successful");
      return next();
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Error verifying captcha. Please try again." }
        )
      );
    }
  },
};
