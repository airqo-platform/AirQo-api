const UserModel = require("@models/User");
const AccessRequestModel = require("@models/AccessRequest");
const NetworkModel = require("@models/Network");
const { logObject, logElement, logText } = require("./log");
const mailer = require("./mailer");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
constants = require("../config/constants");
const generateFilter = require("@utils/generate-filter");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-request-util`
);

const createAccessRequest = {
  requestAccessToGroup: async (request) => {
    try {
      const { user } = request; // Assuming user information is available in the request object
      const { group_id } = request.params;

      // Check if the user has already requested access to this group
      const existingRequest = await AccessRequestModel.findOne({
        user: user._id,
        group: group_id,
      });

      if (existingRequest) {
        // If a request already exists, you can handle it accordingly
        return {
          success: false,
          message: "Access request already exists for this group",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Create a new access request record
      const newAccessRequest = new AccessRequestModel({
        user: user._id,
        group: group_id,
        status: "Pending", // You can set an initial status as 'Pending'
      });

      // Save the access request to the database
      await newAccessRequest.save();

      // Optionally, notify administrators about the new access request
      // You can use a notification mechanism (email, in-app notification, etc.)

      return {
        success: true,
        message: "Access request submitted successfully",
        status: httpStatus.OK,
      };
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
    }
  },
  requestAccessToNetwork: async (request) => {
    try {
      const { user } = request; // Assuming user information is available in the request object
      const { network_id } = request.params;

      // Check if the user has already requested access to this network
      const existingRequest = await AccessRequestModel.findOne({
        user: user._id,
        network: network_id,
      });

      if (existingRequest) {
        // If a request already exists, you can handle it accordingly
        return {
          success: false,
          message: "Access request already exists for this network",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Create a new access request record
      const newAccessRequest = new AccessRequestModel({
        user: user._id,
        network: network_id,
        status: "Pending", // You can set an initial status as 'Pending'
      });

      // Save the access request to the database
      await newAccessRequest.save();

      // Optionally, notify administrators about the new access request
      // You can use a notification mechanism (email, in-app notification, etc.)

      return {
        success: true,
        message: "Access request submitted successfully",
        status: httpStatus.OK,
      };
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
    }
  },
  approveAccessRequest: async (request) => {
    const { user } = request; // Assuming an authenticated user is available in the request object
    const { request_id } = request.params;

    // Check if the user approving the request has the necessary permissions (e.g., an admin)
    // You can implement a permission check here.

    // Find the access request by ID
    const accessRequest = await AccessRequestModel.findById(request_id);

    if (!accessRequest) {
      return {
        success: false,
        message: "Access request not found",
        status: httpStatus.NOT_FOUND,
      };
    }

    // Check if the requesting user is the group's administrator or has the necessary permissions to approve requests
    // You can implement this authorization logic based on your application's requirements.

    // Update the status of the access request to 'Approved'
    accessRequest.status = "Approved";

    // Save the updated access request
    await accessRequest.save();

    // Optionally, you can add the user to the group's list of members
    const group = accessRequest.group;
    await UserModel.findByIdAndUpdate(accessRequest.user, {
      $addToSet: { groups: group },
    });

    // Notify the user that their access request has been approved
    // You can use a notification mechanism (email, in-app notification, etc.)

    return {
      success: true,
      message: "Access request approved successfully",
      status: httpStatus.OK,
    };
  },
  create: async (request) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const responseFromFilter = generateFilter.requests(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      const responseFromRegisterAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });
      return responseFromRegisterAccessRequest;
    } catch (error) {
      logger.error(`${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;

      const responseFromFilter = generateFilter.requests(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      const responseFromListAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });
      return responseFromListAccessRequest;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      const { query, body } = request;

      const responseFromFilter = generateFilter.requests(request);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }

      const filter = responseFromFilter.data;
      const update = body;
      const tenant = query.tenant;

      const responseFromModifyAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });
      logObject(
        "responseFromModifyAccessRequest",
        responseFromModifyAccessRequest
      );
      return responseFromModifyAccessRequest;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      };
    }
  },
  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const responseFromFilter = generateFilter.requests(request);

      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;
      const responseFromRemoveAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromRemoveAccessRequest;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createAccessRequest;
