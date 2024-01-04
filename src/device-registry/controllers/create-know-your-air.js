const httpStatus = require("http-status");
const { logObject, logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-kya-controller`
);
const createKnowYourAirUtil = require("@utils/create-know-your-air");
const isEmpty = require("is-empty");

const createKnowYourAir = {
  /*********** lessons ********************************/
  listLessons: async (req, res, next) => {
    try {
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

      const responseFromListKYALesson = await createKnowYourAirUtil.listLesson(
        request
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
  createLesson: async (req, res, next) => {
    try {
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

      const responseFromCreateKYALesson = await createKnowYourAirUtil.createLesson(
        request
      );

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
  deleteLesson: async (req, res, next) => {
    try {
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
  updateLesson: async (req, res, next) => {
    try {
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

      const responseFromUpdateKYALesson = await createKnowYourAirUtil.updateLesson(
        request
      );

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

  /************ tracking KYA user progress *****************************/
  listUserLessonProgress: async (req, res, next) => {
    try {
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

      const responseFromListUserLessonProgress = await createKnowYourAirUtil.listUserLessonProgress(
        request
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
  deleteUserLessonProgress: async (req, res, next) => {
    try {
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

      const responseFromDeleteUserLessonProgress = await createKnowYourAirUtil.deleteUserLessonProgress(
        request
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
  updateUserLessonProgress: async (req, res, next) => {
    try {
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

      const responseFromUpdateUserLessonProgress = await createKnowYourAirUtil.updateUserLessonProgress(
        request
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
  createUserLessonProgress: async (req, res, next) => {
    try {
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

      const responseFromCreateUserLessonProgress = await createKnowYourAirUtil.createUserLessonProgress(
        request
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
  syncUserLessonProgress: async (req, res, next) => {
    try {
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

      const responseFromSyncUserLessonProgress = await createKnowYourAirUtil.syncUserLessonProgress(
        request
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

  /****************** tasks ********************************/
  listTask: async (req, res, next) => {
    try {
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

      const responseFromListKYATask = await createKnowYourAirUtil.listTask(
        request
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
  createTask: async (req, res, next) => {
    try {
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

      const responseFromCreateKYATask = await createKnowYourAirUtil.createTask(
        request
      );

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
  deleteTask: async (req, res, next) => {
    try {
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

      const responseFromDeleteKYATask = await createKnowYourAirUtil.deleteTask(
        request
      );

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
  updateTask: async (req, res, next) => {
    try {
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

      const responseFromUpdateKYATask = await createKnowYourAirUtil.updateTask(
        request
      );

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

  /******************* manage ********************************/
  assignTaskToLesson: async (req, res, next) => {
    try {
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

      const responseFromAssignTaskToLesson = await createKnowYourAirUtil.assignTaskToLesson(
        request
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
  assignManyTasksToLesson: async (req, res, next) => {
    try {
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

      const responseFromAssignManyTasksToLesson = await createKnowYourAirUtil.assignManyTasksToLesson(
        request
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
  removeTaskFromLesson: async (req, res, next) => {
    try {
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

      const responseFromRemoveTaskFromLesson = await createKnowYourAirUtil.removeTaskFromLesson(
        request
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
  removeManyTasksFromLesson: async (req, res, next) => {
    try {
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

      const responseFromRemoveManyTasksFromLesson = await createKnowYourAirUtil.removeManyTasksFromLesson(
        request
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
  listAvailableTasks: async (req, res, next) => {
    try {
      logText("listing available tasks....");
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

      const responseFromListAvailableTasks = await createKnowYourAirUtil.listAvailableTasks(
        request
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
  listAssignedTasks: async (req, res, next) => {
    try {
      logText("listing assigned tasks....");
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

      const responseFromListAssignedTasks = await createKnowYourAirUtil.listAssignedTasks(
        request
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

  /******************* QUIZ ********************************/
  listQuizzes: async (req, res, next) => {
    try {
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

      const responseFromListKYAQuiz = await createKnowYourAirUtil.listQuiz(
        request
      );

      if (responseFromListKYAQuiz.success === true) {
        const status = responseFromListKYAQuiz.status
          ? responseFromListKYAQuiz.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListKYAQuiz.message,
          kya_quizzes: responseFromListKYAQuiz.data,
        });
      } else if (responseFromListKYAQuiz.success === false) {
        const status = responseFromListKYAQuiz.status
          ? responseFromListKYAQuiz.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListKYAQuiz.message,
          errors: responseFromListKYAQuiz.errors
            ? responseFromListKYAQuiz.errors
            : { message: "" },
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
  createQuiz: async (req, res, next) => {
    try {
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

      const responseFromCreateKYAQuiz = await createKnowYourAirUtil.createQuiz(
        request
      );

      if (responseFromCreateKYAQuiz.success === true) {
        const status = responseFromCreateKYAQuiz.status
          ? responseFromCreateKYAQuiz.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateKYAQuiz.message,
          created_kya_quiz: responseFromCreateKYAQuiz.data
            ? responseFromCreateKYAQuiz.data
            : [],
        });
      } else if (responseFromCreateKYAQuiz.success === false) {
        const status = responseFromCreateKYAQuiz.status
          ? responseFromCreateKYAQuiz.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateKYAQuiz.message,
          errors: responseFromCreateKYAQuiz.errors
            ? responseFromCreateKYAQuiz.errors
            : { message: "" },
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
  deleteQuiz: async (req, res, next) => {
    try {
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

      const responseFromDeleteKYAQuiz = await createKnowYourAirUtil.deleteQuiz(
        request
      );

      if (responseFromDeleteKYAQuiz.success === true) {
        const status = responseFromDeleteKYAQuiz.status
          ? responseFromDeleteKYAQuiz.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteKYAQuiz.message,
          deleted_kya_quiz: responseFromDeleteKYAQuiz.data,
        });
      } else if (responseFromDeleteKYAQuiz.success === false) {
        const status = responseFromDeleteKYAQuiz.status
          ? responseFromDeleteKYAQuiz.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteKYAQuiz.message,
          errors: responseFromDeleteKYAQuiz.errors
            ? responseFromDeleteKYAQuiz.errors
            : { message: "" },
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
  updateQuiz: async (req, res, next) => {
    try {
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

      const responseFromUpdateKYAQuiz = await createKnowYourAirUtil.updateQuiz(
        request
      );

      if (responseFromUpdateKYAQuiz.success === true) {
        const status = responseFromUpdateKYAQuiz.status
          ? responseFromUpdateKYAQuiz.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateKYAQuiz.message,
          updated_kya_quiz: responseFromUpdateKYAQuiz.data,
        });
      } else if (responseFromUpdateKYAQuiz.success === false) {
        const status = responseFromUpdateKYAQuiz.status
          ? responseFromUpdateKYAQuiz.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateKYAQuiz.message,
          errors: responseFromUpdateKYAQuiz.errors
            ? responseFromUpdateKYAQuiz.errors
            : { message: "" },
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

  /************ tracking KYA user progress *****************************/
  listUserQuizProgress: async (req, res, next) => {
    try {
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

      const responseFromListUserQuizProgress = await createKnowYourAirUtil.listUserQuizProgress(
        request
      );

      if (responseFromListUserQuizProgress.success === true) {
        const status = responseFromListUserQuizProgress.status
          ? responseFromListUserQuizProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListUserQuizProgress.message,
          kya_user_progress: responseFromListUserQuizProgress.data,
        });
      } else if (responseFromListUserQuizProgress.success === false) {
        const status = responseFromListUserQuizProgress.status
          ? responseFromListUserQuizProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListUserQuizProgress.message,
          errors: responseFromListUserQuizProgress.errors
            ? responseFromListUserQuizProgress.errors
            : { message: "" },
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
  deleteUserQuizProgress: async (req, res, next) => {
    try {
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

      const responseFromDeleteUserQuizProgress = await createKnowYourAirUtil.deleteUserQuizProgress(
        request
      );

      if (responseFromDeleteUserQuizProgress.success === true) {
        const status = responseFromDeleteUserQuizProgress.status
          ? responseFromDeleteUserQuizProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteUserQuizProgress.message,
          deleted_kya_user_progress: responseFromDeleteUserQuizProgress.data,
        });
      } else if (responseFromDeleteUserQuizProgress.success === false) {
        const status = responseFromDeleteUserQuizProgress.status
          ? responseFromDeleteUserQuizProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteUserQuizProgress.message,
          errors: responseFromDeleteUserQuizProgress.errors
            ? responseFromDeleteUserQuizProgress.errors
            : { message: "" },
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
  updateUserQuizProgress: async (req, res, next) => {
    try {
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

      const responseFromUpdateUserQuizProgress = await createKnowYourAirUtil.updateUserQuizProgress(
        request
      );

      if (responseFromUpdateUserQuizProgress.success === true) {
        const status = responseFromUpdateUserQuizProgress.status
          ? responseFromUpdateUserQuizProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateUserQuizProgress.message,
          kya_user_progress: responseFromUpdateUserQuizProgress.data,
        });
      } else if (responseFromUpdateUserQuizProgress.success === false) {
        const status = responseFromUpdateUserQuizProgress.status
          ? responseFromUpdateUserQuizProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateUserQuizProgress.message,
          errors: responseFromUpdateUserQuizProgress.errors
            ? responseFromUpdateUserQuizProgress.errors
            : { message: "" },
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
  createUserQuizProgress: async (req, res, next) => {
    try {
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

      const responseFromCreateUserQuizProgress = await createKnowYourAirUtil.createUserQuizProgress(
        request
      );

      if (responseFromCreateUserQuizProgress.success === true) {
        const status = responseFromCreateUserQuizProgress.status
          ? responseFromCreateUserQuizProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateUserQuizProgress.message,
          kya_user_progress: responseFromCreateUserQuizProgress.data,
        });
      } else if (responseFromCreateUserQuizProgress.success === false) {
        const status = responseFromCreateUserQuizProgress.status
          ? responseFromCreateUserQuizProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateUserQuizProgress.message,
          errors: responseFromCreateUserQuizProgress.errors
            ? responseFromCreateUserQuizProgress.errors
            : { message: "" },
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
  syncUserQuizProgress: async (req, res, next) => {
    try {
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

      const responseFromSyncUserQuizProgress = await createKnowYourAirUtil.syncUserQuizProgress(
        request
      );

      if (responseFromSyncUserQuizProgress.success === true) {
        const status = responseFromSyncUserQuizProgress.status
          ? responseFromSyncUserQuizProgress.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromSyncUserQuizProgress.message,
          kya_user_progress: responseFromSyncUserQuizProgress.data,
        });
      } else if (responseFromSyncUserQuizProgress.success === false) {
        const status = responseFromSyncUserQuizProgress.status
          ? responseFromSyncUserQuizProgress.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromSyncUserQuizProgress.message,
          errors: responseFromSyncUserQuizProgress.errors
            ? responseFromSyncUserQuizProgress.errors
            : { message: "" },
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

  /****************** QUESTIONS********************************/
  listQuestions: async (req, res, next) => {
    try {
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

      const responseFromListKYAQuestion = await createKnowYourAirUtil.listQuestions(
        request
      );

      if (responseFromListKYAQuestion.success === true) {
        const status = responseFromListKYAQuestion.status
          ? responseFromListKYAQuestion.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListKYAQuestion.message,
          kya_questions: responseFromListKYAQuestion.data,
        });
      } else if (responseFromListKYAQuestion.success === false) {
        const status = responseFromListKYAQuestion.status
          ? responseFromListKYAQuestion.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListKYAQuestion.message,
          errors: responseFromListKYAQuestion.errors
            ? responseFromListKYAQuestion.errors
            : { message: "" },
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
  createQuestion: async (req, res, next) => {
    try {
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

      const responseFromCreateKYAQuestion = await createKnowYourAirUtil.createQuestion(
        request
      );
      logObject("responseFromCreateKYAQuestion", responseFromCreateKYAQuestion);
      if (responseFromCreateKYAQuestion.success === true) {
        const status = responseFromCreateKYAQuestion.status
          ? responseFromCreateKYAQuestion.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateKYAQuestion.message,
          created_kya_question: responseFromCreateKYAQuestion.data
            ? responseFromCreateKYAQuestion.data
            : [],
        });
      } else if (responseFromCreateKYAQuestion.success === false) {
        const status = responseFromCreateKYAQuestion.status
          ? responseFromCreateKYAQuestion.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateKYAQuestion.message,
          errors: responseFromCreateKYAQuestion.errors
            ? responseFromCreateKYAQuestion.errors
            : { message: "" },
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
  deleteQuestion: async (req, res, next) => {
    try {
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

      const responseFromDeleteKYAQuestion = await createKnowYourAirUtil.deleteQuestion(
        request
      );

      if (responseFromDeleteKYAQuestion.success === true) {
        const status = responseFromDeleteKYAQuestion.status
          ? responseFromDeleteKYAQuestion.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteKYAQuestion.message,
          deleted_kya_question: responseFromDeleteKYAQuestion.data,
        });
      } else if (responseFromDeleteKYAQuestion.success === false) {
        const status = responseFromDeleteKYAQuestion.status
          ? responseFromDeleteKYAQuestion.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteKYAQuestion.message,
          errors: responseFromDeleteKYAQuestion.errors
            ? responseFromDeleteKYAQuestion.errors
            : { message: "" },
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
  updateQuestion: async (req, res, next) => {
    try {
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

      const responseFromUpdateKYAQuestion = await createKnowYourAirUtil.updateQuestion(
        request
      );

      if (responseFromUpdateKYAQuestion.success === true) {
        const status = responseFromUpdateKYAQuestion.status
          ? responseFromUpdateKYAQuestion.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateKYAQuestion.message,
          updated_kya_question: responseFromUpdateKYAQuestion.data,
        });
      } else if (responseFromUpdateKYAQuestion.success === false) {
        const status = responseFromUpdateKYAQuestion.status
          ? responseFromUpdateKYAQuestion.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateKYAQuestion.message,
          errors: responseFromUpdateKYAQuestion.errors
            ? responseFromUpdateKYAQuestion.errors
            : { message: "" },
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

  /****************** ANSWERS********************************/
  listAnswers: async (req, res, next) => {
    try {
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

      const responseFromListKYAAnswer = await createKnowYourAirUtil.listAnswers(
        request
      );

      if (responseFromListKYAAnswer.success === true) {
        const status = responseFromListKYAAnswer.status
          ? responseFromListKYAAnswer.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListKYAAnswer.message,
          kya_answers: responseFromListKYAAnswer.data,
        });
      } else if (responseFromListKYAAnswer.success === false) {
        const status = responseFromListKYAAnswer.status
          ? responseFromListKYAAnswer.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListKYAAnswer.message,
          errors: responseFromListKYAAnswer.errors
            ? responseFromListKYAAnswer.errors
            : { message: "" },
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
  createAnswer: async (req, res, next) => {
    try {
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

      const responseFromCreateKYAAnswer = await createKnowYourAirUtil.createAnswer(
        request
      );

      if (responseFromCreateKYAAnswer.success === true) {
        const status = responseFromCreateKYAAnswer.status
          ? responseFromCreateKYAAnswer.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateKYAAnswer.message,
          created_kya_answer: responseFromCreateKYAAnswer.data
            ? responseFromCreateKYAAnswer.data
            : [],
        });
      } else if (responseFromCreateKYAAnswer.success === false) {
        const status = responseFromCreateKYAAnswer.status
          ? responseFromCreateKYAAnswer.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateKYAAnswer.message,
          errors: responseFromCreateKYAAnswer.errors
            ? responseFromCreateKYAAnswer.errors
            : { message: "" },
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
  deleteAnswer: async (req, res, next) => {
    try {
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

      const responseFromDeleteKYAAnswer = await createKnowYourAirUtil.deleteAnswer(
        request
      );

      if (responseFromDeleteKYAAnswer.success === true) {
        const status = responseFromDeleteKYAAnswer.status
          ? responseFromDeleteKYAAnswer.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteKYAAnswer.message,
          deleted_kya_answer: responseFromDeleteKYAAnswer.data,
        });
      } else if (responseFromDeleteKYAAnswer.success === false) {
        const status = responseFromDeleteKYAAnswer.status
          ? responseFromDeleteKYAAnswer.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteKYAAnswer.message,
          errors: responseFromDeleteKYAAnswer.errors
            ? responseFromDeleteKYAAnswer.errors
            : { message: "" },
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
  updateAnswer: async (req, res, next) => {
    try {
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

      const responseFromUpdateKYAAnswer = await createKnowYourAirUtil.updateAnswer(
        request
      );

      if (responseFromUpdateKYAAnswer.success === true) {
        const status = responseFromUpdateKYAAnswer.status
          ? responseFromUpdateKYAAnswer.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateKYAAnswer.message,
          updated_kya_answer: responseFromUpdateKYAAnswer.data,
        });
      } else if (responseFromUpdateKYAAnswer.success === false) {
        const status = responseFromUpdateKYAAnswer.status
          ? responseFromUpdateKYAAnswer.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateKYAAnswer.message,
          errors: responseFromUpdateKYAAnswer.errors
            ? responseFromUpdateKYAAnswer.errors
            : { message: "" },
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

  /******************* manage questions ********************************/
  assignManyQuestionsToQuiz: async (req, res, next) => {
    try {
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

      const responseFromAssignManyQuestionsToQuiz = await createKnowYourAirUtil.assignManyQuestionsToQuiz(
        request
      );

      if (responseFromAssignManyQuestionsToQuiz.success === true) {
        const status = responseFromAssignManyQuestionsToQuiz.status
          ? responseFromAssignManyQuestionsToQuiz.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignManyQuestionsToQuiz.message,
          updated_kya: responseFromAssignManyQuestionsToQuiz.data,
        });
      } else if (responseFromAssignManyQuestionsToQuiz.success === false) {
        const status = responseFromAssignManyQuestionsToQuiz.status
          ? responseFromAssignManyQuestionsToQuiz.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignManyQuestionsToQuiz.message,
          errors: responseFromAssignManyQuestionsToQuiz.errors
            ? responseFromAssignManyQuestionsToQuiz.errors
            : { message: "" },
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
  removeManyQuestionsFromQuiz: async (req, res, next) => {
    try {
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

      const responseFromRemoveManyQuestionsFromQuiz = await createKnowYourAirUtil.removeManyQuestionsFromQuiz(
        request
      );

      if (responseFromRemoveManyQuestionsFromQuiz.success === true) {
        const status = responseFromRemoveManyQuestionsFromQuiz.status
          ? responseFromRemoveManyQuestionsFromQuiz.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveManyQuestionsFromQuiz.message,
          updated_kya: responseFromRemoveManyQuestionsFromQuiz.data,
        });
      } else if (responseFromRemoveManyQuestionsFromQuiz.success === false) {
        const status = responseFromRemoveManyQuestionsFromQuiz.status
          ? responseFromRemoveManyQuestionsFromQuiz.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveManyQuestionsFromQuiz.message,
          errors: responseFromRemoveManyQuestionsFromQuiz.errors
            ? responseFromRemoveManyQuestionsFromQuiz.errors
            : { message: "" },
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
  assignManyAnswersToQuestion: async (req, res, next) => {
    try {
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

      const responseFromAssignManyAnswersToQuestion = await createKnowYourAirUtil.assignManyAnswersToQuestion(
        request
      );

      if (responseFromAssignManyAnswersToQuestion.success === true) {
        const status = responseFromAssignManyAnswersToQuestion.status
          ? responseFromAssignManyAnswersToQuestion.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignManyAnswersToQuestion.message,
          updated_kya: responseFromAssignManyAnswersToQuestion.data,
        });
      } else if (responseFromAssignManyAnswersToQuestion.success === false) {
        const status = responseFromAssignManyAnswersToQuestion.status
          ? responseFromAssignManyAnswersToQuestion.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignManyAnswersToQuestion.message,
          errors: responseFromAssignManyAnswersToQuestion.errors
            ? responseFromAssignManyAnswersToQuestion.errors
            : { message: "" },
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
  removeManyAnswersFromQuestion: async (req, res, next) => {
    try {
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

      const responseFromRemoveManyAnswersFromQuestion = await createKnowYourAirUtil.removeManyAnswersFromQuestion(
        request
      );

      if (responseFromRemoveManyAnswersFromQuestion.success === true) {
        const status = responseFromRemoveManyAnswersFromQuestion.status
          ? responseFromRemoveManyAnswersFromQuestion.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveManyAnswersFromQuestion.message,
          updated_kya: responseFromRemoveManyAnswersFromQuestion.data,
        });
      } else if (responseFromRemoveManyAnswersFromQuestion.success === false) {
        const status = responseFromRemoveManyAnswersFromQuestion.status
          ? responseFromRemoveManyAnswersFromQuestion.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveManyAnswersFromQuestion.message,
          errors: responseFromRemoveManyAnswersFromQuestion.errors
            ? responseFromRemoveManyAnswersFromQuestion.errors
            : { message: "" },
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

module.exports = createKnowYourAir;
