// utils/organization-request.util.js
const OrganizationRequestModel = require("@models/OrganizationRequest");
const GroupModel = require("@models/Group");
const UserModel = require("@models/User");
const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- organization-request-util`
);
const createGroupUtil = require("@utils/group.util");
const { mailer } = require("@utils/common");
const isEmpty = require("is-empty");

const organizationRequest = {
  createOrganizationRequest: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      // Validate that slug doesn't already exist in groups
      const existingGroup = await GroupModel(tenant).findOne({
        organization_slug: body.organization_slug,
      });

      if (existingGroup) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Organization slug already exists",
          })
        );
        return;
      }

      const responseFromCreateRequest = await OrganizationRequestModel(
        tenant
      ).register(body, next);

      if (responseFromCreateRequest.success === true) {
        // Send notification to AirQo Admins
        await mailer.notifyAdminsOfNewOrgRequest({
          organization_name: body.organization_name,
          contact_name: body.contact_name,
          contact_email: body.contact_email,
          tenant,
        });

        // Send confirmation to requestor
        await mailer.confirmOrgRequestReceived({
          organization_name: body.organization_name,
          contact_name: body.contact_name,
          contact_email: body.contact_email,
        });
      }

      return responseFromCreateRequest;
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

  listOrganizationRequests: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip, status } = query;

      // Verify admin permissions
      if (!request.user || request.user.privilege !== "admin") {
        next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Only admins can view organization requests",
          })
        );
        return;
      }

      const filter = {};
      if (status) {
        filter.status = status;
      }

      const responseFromListRequests = await OrganizationRequestModel(
        tenant
      ).list({ filter, limit, skip }, next);

      return responseFromListRequests;
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

  approveOrganizationRequest: async (request, next) => {
    try {
      const { params, query, user } = request;
      const { request_id } = params;
      const { tenant } = query;

      // Verify admin permissions
      if (!user || user.privilege !== "admin") {
        next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Only admins can approve organization requests",
          })
        );
        return;
      }

      const orgRequest = await OrganizationRequestModel(tenant).findById(
        request_id
      );

      if (!orgRequest) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Organization request not found",
          })
        );
      }

      if (orgRequest.status !== "pending") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Request has already been processed",
          })
        );
      }

      // Create the group
      const groupBody = {
        grp_title: orgRequest.organization_name,
        grp_description: orgRequest.use_case,
        organization_slug: orgRequest.organization_slug,
        grp_profile_picture: orgRequest.branding_settings?.logo_url,
      };

      // Create the initial admin user
      const userBody = {
        firstName: orgRequest.contact_name.split(" ")[0],
        lastName: orgRequest.contact_name.split(" ").slice(1).join(" ") || "",
        email: orgRequest.contact_email,
        organization: orgRequest.organization_name,
        tenant,
      };

      // Create group with the user as manager
      const createGroupRequest = {
        body: { ...groupBody, user_id: null },
        query: { tenant },
        user: null,
      };

      // First create the user
      const userResponse = await UserModel(tenant).register(userBody, next);

      if (userResponse.success === true) {
        createGroupRequest.body.user_id = userResponse.data._id;

        const groupResponse = await createGroupUtil.create(
          createGroupRequest,
          next
        );

        if (groupResponse.success === true) {
          // Update the organization request
          const update = {
            status: "approved",
            approved_by: user._id,
            approved_at: new Date(),
          };

          const responseFromUpdate = await OrganizationRequestModel(
            tenant
          ).modify({ filter: { _id: request_id }, update }, next);

          if (responseFromUpdate.success === true) {
            // Send approval email
            await mailer.notifyOrgRequestApproved({
              organization_name: orgRequest.organization_name,
              contact_name: orgRequest.contact_name,
              contact_email: orgRequest.contact_email,
              login_url: `${constants.PLATFORM_URL}/login/${orgRequest.organization_slug}`,
            });

            return {
              success: true,
              message: "Organization request approved successfully",
              data: {
                request: responseFromUpdate.data,
                group: groupResponse.data,
                user: userResponse.data,
              },
              status: httpStatus.OK,
            };
          }
        }
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
    }
  },

  rejectOrganizationRequest: async (request, next) => {
    try {
      const { params, query, body, user } = request;
      const { request_id } = params;
      const { tenant } = query;
      const { rejection_reason } = body;

      // Verify admin permissions
      if (!user || user.privilege !== "admin") {
        next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Only admins can reject organization requests",
          })
        );
      }

      const orgRequest = await OrganizationRequestModel(tenant).findById(
        request_id
      );

      if (!orgRequest) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Organization request not found",
          })
        );
      }

      if (orgRequest.status !== "pending") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Request has already been processed",
          })
        );
      }

      const update = {
        status: "rejected",
        rejection_reason,
        rejected_by: user._id,
        rejected_at: new Date(),
      };

      const responseFromUpdate = await OrganizationRequestModel(tenant).modify(
        { filter: { _id: request_id }, update },
        next
      );

      if (responseFromUpdate.success === true) {
        // Send rejection email
        await mailer.notifyOrgRequestRejected({
          organization_name: orgRequest.organization_name,
          contact_name: orgRequest.contact_name,
          contact_email: orgRequest.contact_email,
          rejection_reason,
        });

        return responseFromUpdate;
      }
      return {
        success: false,
        message: "Failed to reject organization request",
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
    }
  },

  getOrganizationRequestById: async (request, next) => {
    try {
      const { params, query } = request;
      const { request_id } = params;
      const { tenant } = query;

      const filter = { _id: request_id };
      const responseFromListRequests = await OrganizationRequestModel(
        tenant
      ).list({ filter, limit: 1, skip: 0 }, next);

      if (
        responseFromListRequests.success === true &&
        responseFromListRequests.data.length > 0
      ) {
        return {
          success: true,
          message: "Successfully retrieved organization request",
          data: responseFromListRequests.data[0],
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Organization request not found",
          })
        );
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
    }
  },
};

module.exports = organizationRequest;
