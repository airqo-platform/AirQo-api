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
const { mailer, slugUtils } = require("@utils/common");
const { sanitizeEmailString } = require("@utils/shared");
const isEmpty = require("is-empty");

const organizationRequest = {
  createOrganizationRequest: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;

      // Check if user already has access to this organization (if user is authenticated)
      if (user && user._id) {
        const userAccess =
          await organizationRequest.checkUserOrganizationAccess(request, next);

        if (userAccess && userAccess.hasAccess) {
          return {
            success: false,
            message: "You already have access to this organization",
            data: {
              existingGroup: userAccess.group,
              suggestedAction:
                "Please use your existing access or contact support for assistance.",
            },
            status: httpStatus.CONFLICT,
          };
        }
      }

      // Sanitize input values - using safe string handling
      if (body.organization_name) {
        body.organization_name = sanitizeEmailString(body.organization_name);
      }
      if (body.contact_name) {
        body.contact_name = sanitizeEmailString(body.contact_name);
      }

      // Store original slug for reference
      const originalSlug = body.organization_slug;

      // Define maximum slug length to prevent excessively long slugs
      const MAX_SLUG_LENGTH = 50;
      const MAX_RETRIES = 5;
      let currentTry = 0;
      let success = false;
      let responseFromCreateRequest;
      let generatedSlug = originalSlug;

      while (!success && currentTry < MAX_RETRIES) {
        // Generate a unique slug based on retry count
        if (currentTry === 0) {
          generatedSlug = originalSlug;
        } else if (currentTry === 1) {
          // For first retry, use timestamp (predictable length)
          const timestamp = Date.now().toString().slice(-6);
          // Ensure we don't exceed maximum slug length
          const baseSlug =
            originalSlug.length > MAX_SLUG_LENGTH - 7
              ? originalSlug.slice(0, MAX_SLUG_LENGTH - 7)
              : originalSlug;
          generatedSlug = `${baseSlug}-${timestamp}`;
        } else {
          // For subsequent retries, use random string (always 5 chars)
          const randomSuffix = Math.random().toString(36).substring(2, 7);
          // Ensure we don't exceed maximum slug length
          const baseSlug =
            originalSlug.length > MAX_SLUG_LENGTH - 7
              ? originalSlug.slice(0, MAX_SLUG_LENGTH - 7)
              : originalSlug;
          generatedSlug = `${baseSlug}-${randomSuffix}`;
        }

        // Check if the slug already exists in both collections
        const [existingGroup, existingRequest] = await Promise.all([
          GroupModel(tenant)
            .findOne({ organization_slug: generatedSlug })
            .lean(),
          OrganizationRequestModel(tenant)
            .findOne({ organization_slug: generatedSlug })
            .lean(),
        ]);

        if (existingGroup || existingRequest) {
          // Slug already exists, try again with a different one
          currentTry++;
          logger.warn(
            `Slug '${generatedSlug}' already exists, retrying (${currentTry}/${MAX_RETRIES})`
          );
          continue;
        }

        // If we get here, the slug is available
        body.organization_slug = generatedSlug;

        // Now try to register with the available slug
        try {
          responseFromCreateRequest = await OrganizationRequestModel(
            tenant
          ).register(body, next);
          success = true;
        } catch (registrationError) {
          // Enhanced error detection for MongoDB errors
          if (
            (registrationError.code === 11000 ||
              registrationError.name === "MongoServerError") &&
            registrationError.keyPattern &&
            registrationError.keyPattern.organization_slug
          ) {
            currentTry++;
            logger.warn(
              `Race condition detected with slug '${generatedSlug}', retrying (${currentTry}/${MAX_RETRIES})`
            );
          } else {
            // For other errors, just throw them to be caught by the outer catch
            throw registrationError;
          }
        }
      }

      if (!success) {
        return {
          success: false,
          message:
            "Failed to create organization request after multiple retries due to slug collisions",
          status: httpStatus.CONFLICT,
        };
      }

      // Handle slug modification message
      const wasSlugModified = originalSlug !== generatedSlug;
      if (
        wasSlugModified &&
        responseFromCreateRequest &&
        responseFromCreateRequest.success
      ) {
        responseFromCreateRequest.message = `Organization request created successfully. Note: Your slug was modified to '${generatedSlug}' because the original was already taken.`;
      }

      // Send notifications if the request was successful
      if (
        responseFromCreateRequest &&
        responseFromCreateRequest.success === true
      ) {
        try {
          // Run email notifications in parallel for better performance
          await Promise.all([
            // Send notification to AirQo Admins
            mailer.notifyAdminsOfNewOrgRequest({
              organization_name: body.organization_name,
              contact_name: body.contact_name,
              contact_email: body.contact_email,
              tenant,
            }),

            // Send confirmation to requestor
            mailer.confirmOrgRequestReceived({
              organization_name: body.organization_name,
              contact_name: body.contact_name,
              contact_email: body.contact_email,
            }),
          ]);
        } catch (emailError) {
          // Log email sending errors but don't fail the request
          logger.error(`Error sending emails: ${emailError.message}`);
          responseFromCreateRequest.emailSendingIssue = true;
        }
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

  checkUserOrganizationAccess: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;
      const { organization_slug } = body;

      // If user isn't authenticated, no need to check
      if (!user || !user._id) {
        return { hasAccess: false };
      }

      // Check if organization exists and user is a member in a single query
      const existingGroup = await GroupModel(tenant)
        .findOne(
          {
            organization_slug,
            "users.user_id": user._id,
          },
          { _id: 1, grp_title: 1 }
        )
        .lean();

      // Determine if user has access based on query result
      const hasAccess = !!existingGroup;

      // If user has access, get the full group details for the response
      let groupDetails = null;
      if (hasAccess) {
        groupDetails = existingGroup;
      } else {
        // Only check if the group exists if the user doesn't have access
        groupDetails = await GroupModel(tenant)
          .findOne({ organization_slug }, { _id: 1, grp_title: 1 })
          .lean();
      }

      return {
        hasAccess,
        group: groupDetails,
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

  checkSlugAvailability: async (request, next) => {
    try {
      const { params, query } = request;
      const { slug } = params;
      const { tenant } = query;

      // Check if slug exists in Groups collection
      const existingGroup = await GroupModel(tenant).findOne({
        organization_slug: slug,
      });

      // Check if slug exists in OrganizationRequest collection
      const existingRequest = await OrganizationRequestModel(tenant).findOne({
        organization_slug: slug,
      });

      const isAvailable = !existingGroup && !existingRequest;

      // If slug is taken, generate alternative suggestions
      let alternativeSuggestions = [];
      if (!isAvailable) {
        // Generate 3 alternative suggestions
        for (let i = 1; i <= 3; i++) {
          const suggestion = `${slug}-${i}`;
          const suggestionExists =
            (await GroupModel(tenant).findOne({
              organization_slug: suggestion,
            })) ||
            (await OrganizationRequestModel(tenant).findOne({
              organization_slug: suggestion,
            }));

          if (!suggestionExists) {
            alternativeSuggestions.push(suggestion);
          }
        }

        // If we didn't get enough suggestions, add some with timestamp
        if (alternativeSuggestions.length < 3) {
          const timestamp = Math.floor(Date.now() / 1000)
            .toString()
            .substr(-4);
          alternativeSuggestions.push(`${slug}-${timestamp}`);
        }
      }

      return {
        success: true,
        message: isAvailable ? "Slug is available" : "Slug is already taken",
        data: {
          available: isAvailable,
          slug,
          existsInGroups: !!existingGroup,
          existsInRequests: !!existingRequest,
          alternativeSuggestions: isAvailable ? [] : alternativeSuggestions,
        },
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
    }
  },
};

module.exports = organizationRequest;
