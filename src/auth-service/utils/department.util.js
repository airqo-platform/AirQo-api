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

  listUsersWithDepartment: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };
      const filter = generateFilter.departments(request, next);
      const response = await DepartmentModel(tenant.toLowerCase()).list(
        { filter, limit, skip },
        next
      );
      if (!response.success) return response;
      const dept = response.data && response.data[0];
      return {
        success: true,
        message: "successfully retrieved users with department",
        data: dept ? dept.dep_users || [] : [],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  listAvailableUsersForDepartment: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };
      const filter = generateFilter.departments(request, next);
      const deptResponse = await DepartmentModel(tenant.toLowerCase()).list(
        { filter },
        next
      );
      if (!deptResponse.success) return deptResponse;
      const assignedIds =
        deptResponse.data && deptResponse.data[0]
          ? (deptResponse.data[0].dep_users || []).map((u) => u._id || u)
          : [];
      const UserModel = require("@models/User");
      return await UserModel(tenant.toLowerCase()).list(
        { filter: { _id: { $nin: assignedIds } }, limit, skip },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  assignUserToDepartment: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = { ...query, ...params };
      const { user_id, department_id } = { ...params, ...body };
      const updated = await DepartmentModel(tenant.toLowerCase()).findByIdAndUpdate(
        department_id,
        { $addToSet: { dep_users: user_id } },
        { new: true }
      );
      if (!updated) {
        return {
          success: false,
          message: "Department not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Department not found" },
        };
      }
      return {
        success: true,
        message: "User assigned to department",
        data: updated,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  unAssignUserFromDepartment: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = { ...query, ...params };
      const { user_id, department_id } = { ...params, ...body };
      const updated = await DepartmentModel(tenant.toLowerCase()).findByIdAndUpdate(
        department_id,
        { $pull: { dep_users: user_id } },
        { new: true }
      );
      if (!updated) {
        return {
          success: false,
          message: "Department not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Department not found" },
        };
      }
      return {
        success: true,
        message: "User unassigned from department",
        data: updated,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

module.exports = department;
