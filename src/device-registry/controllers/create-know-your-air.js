const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const errors = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-kya-controller`
);
const { validationResult } = require("express-validator");
const createKnowYourAirUtil = require("@utils/create-know-your-air");
const isEmpty = require("is-empty");

const createKnowYourAir = {
  /*********** lessons ********************************/
  listLessons: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
      const responseFromListKYALesson = await createKnowYourAirUtil.listLesson(
        request
      );
      logObject(
        "responseFromListKYALesson in controller",
        responseFromListKYALesson
      );

      if (responseFromListKYALesson.success === true) {
        const status = responseFromListKYALesson.status
          ? responseFromListKYALesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListKYALesson.message,
          kya_lessons: responseFromListKYALesson.data,
        });
      } else if (responseFromListKYALesson.success === false) {
        const status = responseFromListKYALesson.status
          ? responseFromListKYALesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListKYALesson.message,
          errors: responseFromListKYALesson.errors
            ? responseFromListKYALesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  createLesson: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      logElement("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromCreateKYALesson = await createKnowYourAirUtil.createLesson(
        request
      );
      logObject("responseFromCreateKYALesson", responseFromCreateKYALesson);
      if (responseFromCreateKYALesson.success === true) {
        const status = responseFromCreateKYALesson.status
          ? responseFromCreateKYALesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateKYALesson.message,
          created_kya_lesson: responseFromCreateKYALesson.data
            ? responseFromCreateKYALesson.data
            : [],
        });
      } else if (responseFromCreateKYALesson.success === false) {
        const status = responseFromCreateKYALesson.status
          ? responseFromCreateKYALesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateKYALesson.message,
          errors: responseFromCreateKYALesson.errors
            ? responseFromCreateKYALesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  deleteLesson: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
      const responseFromDeleteKYALesson = await createKnowYourAirUtil.deleteLesson(
        request
      );

      logObject("responseFromDeleteKYALesson", responseFromDeleteKYALesson);

      if (responseFromDeleteKYALesson.success === true) {
        const status = responseFromDeleteKYALesson.status
          ? responseFromDeleteKYALesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteKYALesson.message,
          deleted_kya_lesson: responseFromDeleteKYALesson.data,
        });
      } else if (responseFromDeleteKYALesson.success === false) {
        const status = responseFromDeleteKYALesson.status
          ? responseFromDeleteKYALesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteKYALesson.message,
          errors: responseFromDeleteKYALesson.errors
            ? responseFromDeleteKYALesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  updateLesson: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromUpdateKYALesson = await createKnowYourAirUtil.updateLesson(
        request
      );

      logObject("responseFromUpdateKYALesson", responseFromUpdateKYALesson);

      if (responseFromUpdateKYALesson.success === true) {
        const status = responseFromUpdateKYALesson.status
          ? responseFromUpdateKYALesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateKYALesson.message,
          updated_kya_lesson: responseFromUpdateKYALesson.data,
        });
      } else if (responseFromUpdateKYALesson.success === false) {
        const status = responseFromUpdateKYALesson.status
          ? responseFromUpdateKYALesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateKYALesson.message,
          errors: responseFromUpdateKYALesson.errors
            ? responseFromUpdateKYALesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  /************ tracking KYA user progress *****************************/
  listUserLessonProgress: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromListUserLessonProgress = await createKnowYourAirUtil.listUserLessonProgress(
        request
      );
      logObject(
        "responseFromListUserLessonProgress in controller",
        responseFromListUserLessonProgress
      );

      if (responseFromListUserLessonProgress.success === true) {
        const status = responseFromListUserLessonProgress.status
          ? responseFromListUserLessonProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListUserLessonProgress.message,
          kya_user_progress: responseFromListUserLessonProgress.data,
        });
      } else if (responseFromListUserLessonProgress.success === false) {
        const status = responseFromListUserLessonProgress.status
          ? responseFromListUserLessonProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListUserLessonProgress.message,
          errors: responseFromListUserLessonProgress.errors
            ? responseFromListUserLessonProgress.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  deleteUserLessonProgress: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromDeleteUserLessonProgress = await createKnowYourAirUtil.deleteUserLessonProgress(
        request
      );
      logObject(
        "responseFromDeleteUserLessonProgress in controller",
        responseFromDeleteUserLessonProgress
      );

      if (responseFromDeleteUserLessonProgress.success === true) {
        const status = responseFromDeleteUserLessonProgress.status
          ? responseFromDeleteUserLessonProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteUserLessonProgress.message,
          deleted_kya_user_progress: responseFromDeleteUserLessonProgress.data,
        });
      } else if (responseFromDeleteUserLessonProgress.success === false) {
        const status = responseFromDeleteUserLessonProgress.status
          ? responseFromDeleteUserLessonProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteUserLessonProgress.message,
          errors: responseFromDeleteUserLessonProgress.errors
            ? responseFromDeleteUserLessonProgress.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  updateUserLessonProgress: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromUpdateUserLessonProgress = await createKnowYourAirUtil.updateUserLessonProgress(
        request
      );
      logObject(
        "responseFromUpdateUserLessonProgress in controller",
        responseFromUpdateUserLessonProgress
      );

      if (responseFromUpdateUserLessonProgress.success === true) {
        const status = responseFromUpdateUserLessonProgress.status
          ? responseFromUpdateUserLessonProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateUserLessonProgress.message,
          kya_user_progress: responseFromUpdateUserLessonProgress.data,
        });
      } else if (responseFromUpdateUserLessonProgress.success === false) {
        const status = responseFromUpdateUserLessonProgress.status
          ? responseFromUpdateUserLessonProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateUserLessonProgress.message,
          errors: responseFromUpdateUserLessonProgress.errors
            ? responseFromUpdateUserLessonProgress.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  createUserLessonProgress: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromCreateUserLessonProgress = await createKnowYourAirUtil.createUserLessonProgress(
        request
      );
      logObject(
        "responseFromCreateUserLessonProgress in controller",
        responseFromCreateUserLessonProgress
      );

      if (responseFromCreateUserLessonProgress.success === true) {
        const status = responseFromCreateUserLessonProgress.status
          ? responseFromCreateUserLessonProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateUserLessonProgress.message,
          kya_user_progress: responseFromCreateUserLessonProgress.data,
        });
      } else if (responseFromCreateUserLessonProgress.success === false) {
        const status = responseFromCreateUserLessonProgress.status
          ? responseFromCreateUserLessonProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateUserLessonProgress.message,
          errors: responseFromCreateUserLessonProgress.errors
            ? responseFromCreateUserLessonProgress.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  syncUserLessonProgress: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromSyncUserLessonProgress = await createKnowYourAirUtil.syncUserLessonProgress(
        request
      );
      logObject(
        "responseFromSyncUserLessonProgress in controller",
        responseFromSyncUserLessonProgress
      );

      if (responseFromSyncUserLessonProgress.success === true) {
        const status = responseFromSyncUserLessonProgress.status
          ? responseFromSyncUserLessonProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromSyncUserLessonProgress.message,
          kya_user_progress: responseFromSyncUserLessonProgress.data,
        });
      } else if (responseFromSyncUserLessonProgress.success === false) {
        const status = responseFromSyncUserLessonProgress.status
          ? responseFromSyncUserLessonProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromSyncUserLessonProgress.message,
          errors: responseFromSyncUserLessonProgress.errors
            ? responseFromSyncUserLessonProgress.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  /****************** tasks ********************************/
  listTask: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
      const responseFromListKYATask = await createKnowYourAirUtil.listTask(
        request
      );
      logObject(
        "responseFromListKYATask in controller",
        responseFromListKYATask
      );

      if (responseFromListKYATask.success === true) {
        const status = responseFromListKYATask.status
          ? responseFromListKYATask.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListKYATask.message,
          kya_tasks: responseFromListKYATask.data,
        });
      } else if (responseFromListKYATask.success === false) {
        const status = responseFromListKYATask.status
          ? responseFromListKYATask.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListKYATask.message,
          errors: responseFromListKYATask.errors
            ? responseFromListKYATask.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  createTask: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      logElement("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromCreateKYATask = await createKnowYourAirUtil.createTask(
        request
      );
      logObject("responseFromCreateKYATask", responseFromCreateKYATask);
      if (responseFromCreateKYATask.success === true) {
        const status = responseFromCreateKYATask.status
          ? responseFromCreateKYATask.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateKYATask.message,
          created_kya_task: responseFromCreateKYATask.data
            ? responseFromCreateKYATask.data
            : [],
        });
      } else if (responseFromCreateKYATask.success === false) {
        const status = responseFromCreateKYATask.status
          ? responseFromCreateKYATask.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateKYATask.message,
          errors: responseFromCreateKYATask.errors
            ? responseFromCreateKYATask.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  deleteTask: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
      const responseFromDeleteKYATask = await createKnowYourAirUtil.deleteTask(
        request
      );

      logObject("responseFromDeleteKYATask", responseFromDeleteKYATask);

      if (responseFromDeleteKYATask.success === true) {
        const status = responseFromDeleteKYATask.status
          ? responseFromDeleteKYATask.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteKYATask.message,
          deleted_kya_task: responseFromDeleteKYATask.data,
        });
      } else if (responseFromDeleteKYATask.success === false) {
        const status = responseFromDeleteKYATask.status
          ? responseFromDeleteKYATask.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteKYATask.message,
          errors: responseFromDeleteKYATask.errors
            ? responseFromDeleteKYATask.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  updateTask: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromUpdateKYATask = await createKnowYourAirUtil.updateTask(
        request
      );

      logObject("responseFromUpdateKYATask", responseFromUpdateKYATask);

      if (responseFromUpdateKYATask.success === true) {
        const status = responseFromUpdateKYATask.status
          ? responseFromUpdateKYATask.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateKYATask.message,
          updated_kya_task: responseFromUpdateKYATask.data,
        });
      } else if (responseFromUpdateKYATask.success === false) {
        const status = responseFromUpdateKYATask.status
          ? responseFromUpdateKYATask.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateKYATask.message,
          errors: responseFromUpdateKYATask.errors
            ? responseFromUpdateKYATask.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  /******************* manage ********************************/
  assignTaskToLesson: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromAssignTaskToLesson = await createKnowYourAirUtil.assignTaskToLesson(
        request
      );

      logObject(
        "responseFromAssignTaskToLesson",
        responseFromAssignTaskToLesson
      );

      if (responseFromAssignTaskToLesson.success === true) {
        const status = responseFromAssignTaskToLesson.status
          ? responseFromAssignTaskToLesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignTaskToLesson.message,
          updated_kya: responseFromAssignTaskToLesson.data,
        });
      } else if (responseFromAssignTaskToLesson.success === false) {
        const status = responseFromAssignTaskToLesson.status
          ? responseFromAssignTaskToLesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignTaskToLesson.message,
          errors: responseFromAssignTaskToLesson.errors
            ? responseFromAssignTaskToLesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  assignManyTasksToLesson: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromAssignManyTasksToLesson = await createKnowYourAirUtil.assignManyTasksToLesson(
        request
      );

      logObject(
        "responseFromAssignManyTasksToLesson",
        responseFromAssignManyTasksToLesson
      );

      if (responseFromAssignManyTasksToLesson.success === true) {
        const status = responseFromAssignManyTasksToLesson.status
          ? responseFromAssignManyTasksToLesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignManyTasksToLesson.message,
          updated_kya: responseFromAssignManyTasksToLesson.data,
        });
      } else if (responseFromAssignManyTasksToLesson.success === false) {
        const status = responseFromAssignManyTasksToLesson.status
          ? responseFromAssignManyTasksToLesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignManyTasksToLesson.message,
          errors: responseFromAssignManyTasksToLesson.errors
            ? responseFromAssignManyTasksToLesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  removeTaskFromLesson: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromRemoveTaskFromLesson = await createKnowYourAirUtil.removeTaskFromLesson(
        request
      );

      logObject(
        "responseFromRemoveTaskFromLesson",
        responseFromRemoveTaskFromLesson
      );

      if (responseFromRemoveTaskFromLesson.success === true) {
        const status = responseFromRemoveTaskFromLesson.status
          ? responseFromRemoveTaskFromLesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveTaskFromLesson.message,
          updated_kya_task: responseFromRemoveTaskFromLesson.data,
        });
      } else if (responseFromRemoveTaskFromLesson.success === false) {
        const status = responseFromRemoveTaskFromLesson.status
          ? responseFromRemoveTaskFromLesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveTaskFromLesson.message,
          errors: responseFromRemoveTaskFromLesson.errors
            ? responseFromRemoveTaskFromLesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  removeManyTasksFromLesson: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromRemoveManyTasksFromLesson = await createKnowYourAirUtil.removeManyTasksFromLesson(
        request
      );

      logObject(
        "responseFromRemoveManyTasksFromLesson",
        responseFromRemoveManyTasksFromLesson
      );

      if (responseFromRemoveManyTasksFromLesson.success === true) {
        const status = responseFromRemoveManyTasksFromLesson.status
          ? responseFromRemoveManyTasksFromLesson.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveManyTasksFromLesson.message,
          updated_kya: responseFromRemoveManyTasksFromLesson.data,
        });
      } else if (responseFromRemoveManyTasksFromLesson.success === false) {
        const status = responseFromRemoveManyTasksFromLesson.status
          ? responseFromRemoveManyTasksFromLesson.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveManyTasksFromLesson.message,
          errors: responseFromRemoveManyTasksFromLesson.errors
            ? responseFromRemoveManyTasksFromLesson.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listAvailableTasks: async (req, res) => {
    try {
      logText("listing available tasks....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListAvailableTasks = await createKnowYourAirUtil.listAvailableTasks(
        request
      );

      logObject(
        "responseFromListAvailableTasks in controller",
        responseFromListAvailableTasks
      );

      if (responseFromListAvailableTasks.success === true) {
        const status = responseFromListAvailableTasks.status
          ? responseFromListAvailableTasks.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListAvailableTasks.message,
          available_tasks: responseFromListAvailableTasks.data,
        });
      } else if (responseFromListAvailableTasks.success === false) {
        const status = responseFromListAvailableTasks.status
          ? responseFromListAvailableTasks.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableTasks.message,
          errors: responseFromListAvailableTasks.errors
            ? responseFromListAvailableTasks.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listAssignedTasks: async (req, res) => {
    try {
      logText("listing assigned tasks....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);

      request.query.tenant = tenant;

      const responseFromListAssignedTasks = await createKnowYourAirUtil.listAssignedTasks(
        request
      );

      logObject(
        "responseFromListAssignedTasks in controller",
        responseFromListAssignedTasks
      );

      if (responseFromListAssignedTasks.success === true) {
        const status = responseFromListAssignedTasks.status
          ? responseFromListAssignedTasks.status
          : httpStatus.OK;
        if (responseFromListAssignedTasks.data.length === 0) {
          return res.status(status).json({
            success: true,
            message: "no assigned tasks to this network",
            assigned_tasks: [],
          });
        }
        return res.status(status).json({
          success: true,
          message: "successfully retrieved the assigned tasks for this network",
          assigned_tasks: responseFromListAssignedTasks.data,
        });
      } else if (responseFromListAssignedTasks.success === false) {
        const status = responseFromListAssignedTasks.status
          ? responseFromListAssignedTasks.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListAssignedTasks.message,
          errors: responseFromListAssignedTasks.errors
            ? responseFromListAssignedTasks.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createKnowYourAir;
