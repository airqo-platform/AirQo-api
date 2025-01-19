const DepartmentModel = require("@models/Department");
const httpStatus = require("http-status");
const { logText, HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- department-util`);

const department = {
  createDepartment: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = Object.assign({}, body);
      const responseFromRegisterDepartment = await DepartmentModel(
        tenant.toLowerCase()
      ).register(modifiedBody, next);
      return responseFromRegisterDepartment;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateDepartment: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = {
        ...query,
        ...params,
      };
      const update = Object.assign({}, body);
      const filter = generateFilter.departments(request, next);
      const responseFromModifyDepartment = await DepartmentModel(
        tenant.toLowerCase()
      ).modify({ update, filter }, next);
      return responseFromModifyDepartment;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteDepartment: async (request, next) => {
    try {
      logText("the delete operation.....");
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.departments(request, next);
      const responseFromRemoveNetwork = await DepartmentModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      return responseFromRemoveNetwork;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listDepartment: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.departments(request, next);
      const responseFromListDepartments = await DepartmentModel(
        tenant.toLowerCase()
      ).list({ filter, limit, skip }, next);
      return responseFromListDepartments;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateDepartmentStatus: async (request, next) => {
    try {
      const { tenant } = {
        ...request.params,
        ...request.query,
        ...request.body,
      };
      const department = await DepartmentModel(tenant).findByIdAndUpdate(
        request.params.department_id,
        { dep_status: request.body.dep_status },
        { new: true }
      );
    } catch (error) {}
  },

  addDepartmentUsers: async (request, next) => {
    try {
      const { tenant } = {
        ...request.params,
        ...request.query,
        ...request.body,
      };
      const department = await DepartmentModel(tenant).findByIdAndUpdate(
        request.params.department_id,
        { $addToSet: { dep_users: { $each: request.body.dep_users } } },
        { new: true }
      );
    } catch (error) {}
  },

  removeDepartmentUsers: async (request, next) => {
    try {
      const { tenant } = {
        ...request.params,
        ...request.query,
        ...request.body,
      };
      const department = await DepartmentModel(tenant).findByIdAndUpdate(
        request.params.department_id,
        { $pullAll: { dep_users: request.body.dep_users } },
        { new: true }
      );
    } catch (error) {}
  },

  updateDepartmentManager: async (request, next) => {
    try {
      const { tenant } = {
        ...request.params,
        ...request.query,
        ...request.body,
      };
      const department = await DepartmentModel(tenant).findByIdAndUpdate(
        request.params.department_id,
        {
          dep_manager: request.body.dep_manager,
          dep_manager_username: request.body.dep_manager_username,
          dep_manager_firstname: request.body.dep_manager_firstname,
          dep_manager_lastname: request.body.dep_manager_lastname,
        },
        { new: true }
      );
    } catch (error) {}
  },

  getDepartment: async (request, next) => {
    try {
      const { tenant } = {
        ...request.params,
        ...request.query,
        ...request.body,
      };
      const department = await DepartmentModel(tenant).findById(
        req.params.department_id
      );
      if (!department) {
      }
    } catch (error) {}
  },
};

module.exports = department;
