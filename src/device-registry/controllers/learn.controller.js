const httpStatus = require("http-status");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- learn-controller`);
const learnUtil = require("@utils/learn.util");
const isEmpty = require("is-empty");

const learnController = {
  // ---------------------------------------------------------------------------
  // Option 1 — Content
  // ---------------------------------------------------------------------------

  getCatalog: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.getCatalog(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          catalog_version: result.data.catalog_version,
          stages: result.data.stages,
          courses: result.data.courses,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message || "no published learn catalog available",
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  getLesson: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.getLesson(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          lesson: result.data,
        });
      }
      return res.status(result.status || httpStatus.NOT_FOUND).json({
        success: false,
        message: result.message || "lesson not found",
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  // ---------------------------------------------------------------------------
  // Option 2 — Guest Progress
  // ---------------------------------------------------------------------------

  createAnonymousSession: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.createAnonymousSession(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.CREATED).json({
          success: true,
          guest_id: result.data.guest_id,
          display_name: result.data.display_name,
          avatar_icon: result.data.avatar_icon,
          avatar_image_url: result.data.avatar_image_url,
          username: result.data.username,
          event_id: result.data.event_id,
          created_at: result.data.created_at,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  getProgress: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.getProgress(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          ...result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  updateLessonProgress: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.updateLessonProgress(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          ...result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  syncProgress: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.syncProgress(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          ...result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  // ---------------------------------------------------------------------------
  // Option 3 — Account Link
  // ---------------------------------------------------------------------------

  linkGuestProgress: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.linkGuestProgress(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          user_id: result.data.user_id,
          merged: result.data.merged,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  // ---------------------------------------------------------------------------
  // Option 3 — Certificates & Leaderboard
  // ---------------------------------------------------------------------------

  issueCertificate: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.issueCertificate(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.CREATED).json({
          success: true,
          ...result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  listCertificates: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.listCertificates(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          certificates: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  verifyCertificate: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.verifyCertificate(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          ...result.data,
        });
      }
      return res.status(result.status || httpStatus.NOT_FOUND).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  getLeaderboard: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.getLeaderboard(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          ...result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  getCourseProgress: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.getCourseProgress(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          courses: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  // ---------------------------------------------------------------------------
  // Admin — Course Authoring
  // ---------------------------------------------------------------------------

  createCourse: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.createCourse(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.CREATED).json({
          success: true,
          course: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  addUnit: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.addUnit(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.CREATED).json({
          success: true,
          unit: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  addLesson: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.addLesson(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.CREATED).json({
          success: true,
          lesson: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  addActivity: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.addActivity(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.CREATED).json({
          success: true,
          activity: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  listCourses: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.listCourses(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          courses: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  getCourse: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.getCourse(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          course: result.data,
        });
      }
      return res.status(result.status || httpStatus.NOT_FOUND).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  deleteCourse: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.deleteCourse(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          message: result.message,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  updateUnit: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.updateUnit(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          unit: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  deleteUnit: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.deleteUnit(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          message: result.message,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  updateLesson: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.updateLesson(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          lesson: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  deleteLesson: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.deleteLesson(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          message: result.message,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  updateActivity: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.updateActivity(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          activity: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  deleteActivity: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.deleteActivity(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          message: result.message,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },

  updateCourse: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      }
      const result = await learnUtil.updateCourse(req, next);
      if (isEmpty(result) || res.headersSent) return;
      if (result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          course: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: result.message },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
    }
  },
};

module.exports = learnController;
