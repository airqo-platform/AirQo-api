//src/auth-service/utils/request.util.js
const UserModel = require("@models/User");
const crypto = require("crypto");
const AccessRequestModel = require("@models/AccessRequest");
const GroupModel = require("@models/Group");
const NetworkModel = require("@models/Network");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { mailer, generateFilter } = require("@utils/common");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-request-util`,
);
const createNetworkUtil = require("@utils/network.util");
const createGroupUtil = require("@utils/group.util");
const { logObject, HttpError, logText } = require("@utils/shared");

const createAccessRequest = {
  requestAccessToGroup: async (request, next) => {
    try {
      const {
        user: { _doc: user },
        query,
      } = request;
      const { tenant } = query;
      const { grp_id } = request.params;
      logObject("the user", user);
      logObject("grp_id", grp_id);

      const group = await GroupModel(tenant).findById(grp_id);
      logObject("group", group);
      logObject("user._id", user._id);

      if (isEmpty(group) || isEmpty(user._id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group or User not found",
          }),
        );
        return;
      }

      // Check if user is already a member
      const userDetails = await UserModel(tenant).findById(user._id).lean();
      if (userDetails && userDetails.group_roles) {
        const isAlreadyMember = userDetails.group_roles.some(
          (gr) => gr.group.toString() === grp_id.toString(),
        );
        if (isAlreadyMember) {
          return {
            success: false,
            message: "You are already a member of this group",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "You are already a member of this group",
            },
          };
        }
      }

      // Check for existing pending request
      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: grp_id,
        requestType: "group",
        status: "pending",
      });

      if (!isEmpty(existingRequest)) {
        return {
          success: false,
          message: "You already have a pending access request for this group",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "You already have a pending access request for this group",
            existing_request_id: existingRequest._id,
            requested_at: existingRequest.createdAt,
          },
        };
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant,
      ).register(
        {
          user_id: user._id,
          email: user.email,
          targetId: grp_id,
          status: "pending",
          requestType: "group",
        },
        next,
      );

      if (responseFromCreateAccessRequest.success === true) {
        const createdAccessRequest = await responseFromCreateAccessRequest.data;
        const firstName = user.firstName ? user.firstName : "Unknown";
        const lastName = user.lastName ? user.lastName : "Unknown";
        if (isEmpty(user.email)) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: "Unable to retrieve the requester's email address" },
            ),
          );
          return;
        }
        const responseFromSendEmail = await mailer.request(
          {
            firstName,
            lastName,
            email: user.email,
            tenant,
            entity_title: group.grp_title,
          },
          next,
        );

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: "Access Request completed successfully",
            data: createdAccessRequest,
            status: responseFromSendEmail.status
              ? responseFromSendEmail.status
              : httpStatus.OK,
          };
        } else if (responseFromSendEmail.success === false) {
          logger.error(`${responseFromSendEmail.message}`);
          // Don't fail the entire operation if email fails
          return {
            success: true,
            message:
              "Access Request completed successfully (notification email failed)",
            data: createdAccessRequest,
            status: httpStatus.OK,
          };
        }
      } else {
        logger.error(`${responseFromCreateAccessRequest.message}`);
        return responseFromCreateAccessRequest;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  requestAccessToGroupByEmail: async (request, next) => {
    try {
      const { tenant, emails, user, grp_id } = {
        ...request,
        ...request.body,
        ...request.query,
        ...request.params,
      };

      logObject("requestAccessToGroupByEmail", { tenant, emails, grp_id });

      const inviter = user;

      if (isEmpty(inviter) || !inviter._id) {
        next(
          new HttpError("Authentication Error", httpStatus.UNAUTHORIZED, {
            message:
              "Inviter authentication failed. User details not found in token.",
          }),
        );
        return;
      }

      const inviterEmail = inviter.email;
      const inviterId = inviter._id;

      if (!ObjectId.isValid(inviterId)) {
        next(
          new HttpError("Authentication Error", httpStatus.UNAUTHORIZED, {
            message: "Invalid inviter id in token.",
          }),
        );
        return;
      }

      const inviterDetails = await UserModel(tenant).findById(inviterId).lean();
      if (isEmpty(inviterDetails)) {
        next(
          new HttpError("Authentication Error", httpStatus.UNAUTHORIZED, {
            message: "Inviter details not found in the database.",
          }),
        );
        return;
      }

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (isEmpty(group)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id} not found`,
          }),
        );
        return;
      }

      const inviterGroupMembership = inviterDetails.group_roles?.find(
        (gr) => gr.group.toString() === grp_id.toString(),
      );

      if (
        !inviterGroupMembership &&
        group.grp_manager?.toString() !== inviterId.toString()
      ) {
        logger.warn(
          `User ${inviterId} attempted to invite to group ${grp_id} without permission`,
        );
        next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You do not have permission to invite users to this group",
          }),
        );
        return;
      }

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Emails array is required and must not be empty",
          }),
        );
        return;
      }

      const invalidEmails = emails.filter(
        (email) => !email || typeof email !== "string" || !email.includes("@"),
      );
      if (invalidEmails.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid email formats: ${invalidEmails.join(", ")}`,
          }),
        );
        return;
      }

      const uniqueEmails = [
        ...new Set(emails.map((email) => email.toLowerCase())),
      ];
      if (uniqueEmails.length !== emails.length) {
        logger.warn("Duplicate emails found in invitation request", {
          emails,
          uniqueEmails,
        });
      }

      // CRITICAL: Check all emails at once for existing users and requests
      const existingUsers = await UserModel(tenant)
        .find({ email: { $in: uniqueEmails } })
        .lean();

      const existingUsersMap = new Map(
        existingUsers.map((user) => [user.email.toLowerCase(), user]),
      );

      const existingPendingRequests = await AccessRequestModel(tenant)
        .find({
          email: { $in: uniqueEmails },
          targetId: grp_id,
          requestType: "group",
          status: "pending",
        })
        .lean();

      const existingRequestsMap = new Map(
        existingPendingRequests.map((req) => [req.email.toLowerCase(), req]),
      );

      const existingRequests = [];
      const successResponses = [];
      const failureResponses = [];
      const alreadyMembers = [];

      for (const email of uniqueEmails) {
        try {
          const normalizedEmail = email.toLowerCase();
          const existingUser = existingUsersMap.get(normalizedEmail);

          if (existingUser) {
            const isAlreadyMember = existingUser.group_roles?.some(
              (gr) => gr.group.toString() === grp_id.toString(),
            );

            if (isAlreadyMember) {
              alreadyMembers.push(email);
              continue;
            }
          }

          // Check for existing pending requests
          const existingRequest = existingRequestsMap.get(normalizedEmail);
          if (existingRequest) {
            existingRequests.push({
              email,
              request_id: existingRequest._id,
              created_at: existingRequest.createdAt,
            });
            continue;
          }

          // Generate a secure, unique token for the invitation link
          const invitationToken = crypto.randomBytes(32).toString("hex");
          const invitationTokenExpires = new Date();
          invitationTokenExpires.setDate(invitationTokenExpires.getDate() + 7); // Token valid for 7 days

          const accessRequestData = {
            email: normalizedEmail,
            targetId: grp_id,
            status: "pending",
            requestType: "group",
            inviter_id: inviterId,
            inviter_email: inviterEmail,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invitationToken,
            invitationTokenExpires,
          };

          if (existingUser) {
            accessRequestData.user_id = existingUser._id;
          }

          const responseFromCreateAccessRequest = await AccessRequestModel(
            tenant,
          ).register(accessRequestData, next);

          logObject("Access request created", {
            email,
            request_id: responseFromCreateAccessRequest.data?._id,
            has_user_id: !!existingUser,
          });

          if (responseFromCreateAccessRequest.success === true) {
            const createdAccessRequest = responseFromCreateAccessRequest.data;

            const userExists = !!existingUser;

            const responseFromSendEmail =
              await mailer.requestToJoinGroupByEmail(
                {
                  email,
                  tenant,
                  entity_title: group.grp_title,
                  targetId: grp_id,
                  inviterEmail,
                  userExists,
                  inviter_name: `${inviterDetails.firstName} ${inviterDetails.lastName}`,
                  request_id: createdAccessRequest._id,
                  group_description: group.grp_description,
                  expires_at: accessRequestData.expires_at,
                  token: invitationToken, // Pass token to email template
                },
                next,
              );

            logObject("Email sending result", {
              email,
              success: responseFromSendEmail.success,
              status: responseFromSendEmail.status,
            });

            if (responseFromSendEmail.success === true) {
              successResponses.push({
                email,
                success: true,
                message: "Invitation sent successfully",
                request_id: createdAccessRequest._id,
                user_exists: userExists,
                expires_at: accessRequestData.expires_at,
                status: responseFromSendEmail.status || httpStatus.OK,
              });
            } else {
              logger.error(
                `Failed to send email to ${email}:`,
                responseFromSendEmail,
              );
              // Email failure shouldn't fail the invitation creation
              successResponses.push({
                email,
                success: true,
                message: "Invitation created but email notification failed",
                request_id: createdAccessRequest._id,
                user_exists: userExists,
                expires_at: accessRequestData.expires_at,
                status: httpStatus.OK,
              });
            }
          } else {
            logger.error(
              `Failed to create access request for ${email}:`,
              responseFromCreateAccessRequest,
            );
            failureResponses.push({
              email,
              success: false,
              message: `Failed to create invitation: ${responseFromCreateAccessRequest.message}`,
              error: responseFromCreateAccessRequest.error,
            });
          }
        } catch (emailError) {
          logger.error(`Error processing email ${email}:`, emailError);
          failureResponses.push({
            email,
            success: false,
            message: `Failed to process invitation: ${emailError.message}`,
            error: emailError.message,
          });
        }
      }

      const totalProcessed = uniqueEmails.length;
      const successCount = successResponses.length;
      const failureCount = failureResponses.length;
      const existingCount = existingRequests.length;
      const memberCount = alreadyMembers.length;

      const responseData = {
        summary: {
          total_emails: emails.length,
          unique_emails: uniqueEmails.length,
          successful_invitations: successCount,
          failed_invitations: failureCount,
          existing_requests: existingCount,
          already_members: memberCount,
        },
        group_info: {
          id: grp_id,
          name: group.grp_title,
        },
        results: {
          successful: successResponses,
          failed: failureResponses,
          existing_requests: existingRequests,
          already_members: alreadyMembers,
        },
      };

      let statusCode = httpStatus.OK;
      let message = `Invitations processed: ${successCount} sent, ${failureCount} failed, ${existingCount} already pending, ${memberCount} already members`;

      if (successCount === 0) {
        if (failureCount > 0) {
          statusCode = httpStatus.BAD_REQUEST;
          message = "All invitations failed to send";
        } else if (existingCount > 0 || memberCount > 0) {
          statusCode = httpStatus.OK;
          message =
            "No new invitations sent - all users already invited or are members";
        }
      } else if (failureCount > 0) {
        statusCode = httpStatus.MULTI_STATUS;
      }

      if (
        statusCode === httpStatus.BAD_REQUEST &&
        successCount === 0 &&
        failureCount > 0
      ) {
        next(
          new HttpError("Bad Request Error", statusCode, {
            message,
            details: responseData,
          }),
        );
        return;
      }

      return {
        success: true,
        message,
        data: responseData,
        status: statusCode,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in requestAccessToGroupByEmail: ${error.message}`,
        error,
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  /**
   * Deletes all expired pending access requests for the specified tenant.
   *
   * @param {Object} request - The Express request object, containing query parameters.
   * @param {Function} next - The Express next middleware function for error handling.
   * @returns {Object} An object containing the success status, message, count of deleted records, and HTTP status code.
   */

  cleanupExpiredRequests: async (request, next) => {
    try {
      const { tenant } = request.query;

      const result = await AccessRequestModel(tenant).deleteMany({
        expires_at: { $lt: new Date() },
        status: "pending",
      });

      return {
        success: true,
        message: `Cleaned up ${result.deletedCount} expired access requests`,
        data: {
          deleted_count: result.deletedCount,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  acceptInvitation: async (request, next) => {
    try {
      const {
        tenant,
        email,
        firstName,
        lastName,
        password,
        grids,
        target_id,
        token,
      } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const authUser = request.user;

      const accessRequest = await AccessRequestModel(tenant).findOne({
        _id: target_id,
        ...(token && {
          invitationToken: token,
          invitationTokenExpires: { $gt: new Date() },
        }),
      });

      // Security guard: Reject if neither a JWT session nor an invitation token is provided.
      if (!authUser && !token) {
        return {
          success: false,
          message: "Authentication required.",
          status: httpStatus.UNAUTHORIZED,
          errors: {
            message:
              "A valid session or invitation token is required to perform this action.",
          },
        };
      }

      // If using token auth, the user's email comes from the access request itself.
      // This must happen before the existingUser lookup.
      if (token && accessRequest) {
        request.body.email = accessRequest.email;
      }

      const normalizedEmail = (request.body.email || email || "").toLowerCase();

      const existingUser = await UserModel(tenant).findOne({
        email: normalizedEmail,
      });

      logObject("acceptInvitation - accessRequest", {
        _id: accessRequest?._id,
        status: accessRequest?.status,
      });

      if (isEmpty(accessRequest)) {
        return {
          success: false,
          message:
            "Access Request not found, please crosscheck provided details",
          status: httpStatus.NOT_FOUND,
          errors: {
            message:
              "Access Request not found, please crosscheck provided details",
          },
        };
      }

      // Security check: if logged in via JWT, ensure the user's email matches the invitation email
      if (
        authUser &&
        accessRequest.email &&
        accessRequest.email.toLowerCase() !== authUser.email.toLowerCase()
      ) {
        return {
          success: false,
          message: "Authorization Error",
          status: httpStatus.FORBIDDEN,
          errors: {
            message:
              "This invitation is for a different email address. Please log in with the correct account.",
          },
        };
      }

      if (accessRequest.status !== "pending") {
        return {
          success: false,
          message: `This invitation cannot be accepted as it is already in the '${accessRequest.status}' state.`,
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `This invitation has already been ${accessRequest.status}.`,
            current_status: accessRequest.status,
            request_id: accessRequest._id,
          },
        };
      }

      // Check if invitation has expired
      if (
        accessRequest.expires_at &&
        new Date(accessRequest.expires_at) < new Date()
      ) {
        return {
          success: false,
          message: "This invitation has expired",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "This invitation has expired",
            expired_at: accessRequest.expires_at,
          },
        };
      }

      let user = null;
      let isNewUser = !existingUser; // Flag to check if we are creating a new user

      if (existingUser) {
        const requestType = accessRequest.requestType;

        if (requestType === "group") {
          const isAlreadyAssigned = existingUser.group_roles?.some(
            (gr) => gr.group.toString() === target_id.toString(),
          );

          if (isAlreadyAssigned) {
            return {
              success: false,
              message: "User is already a member of this organization",
              status: httpStatus.BAD_REQUEST,
              errors: {
                message: "User is already a member of this organization",
              },
            };
          }
        } else if (requestType === "network") {
          const isAlreadyAssigned = existingUser.network_roles?.some(
            (nr) => nr.network.toString() === target_id.toString(),
          );

          if (isAlreadyAssigned) {
            return {
              success: false,
              message: "User is already a member of this network",
              status: httpStatus.BAD_REQUEST,
              errors: {
                message: "User is already a member of this network",
              },
            };
          }
        }

        user = existingUser;
        isNewUser = false;
      } else {
        // Validate required fields for new user creation
        if (!firstName || !lastName || !password) {
          return {
            success: false,
            message: "Missing required fields for new user creation",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "firstName, lastName, and password are required to create a new account",
            },
          };
        }

        const bodyForCreatingNewUser = {
          email,
          password,
          userName: email,
          firstName,
          lastName,
        };

        const responseFromCreateNewUser = await UserModel(tenant).register(
          bodyForCreatingNewUser,
          next,
        );

        if (
          responseFromCreateNewUser.success !== true ||
          responseFromCreateNewUser.status !== httpStatus.OK
        ) {
          return responseFromCreateNewUser;
        }

        user = responseFromCreateNewUser.data;
        isNewUser = true;
      }

      const originalInvitationToken = accessRequest.invitationToken;

      // Update access request status
      const update = {
        status: "approved",
        user_id: user._id,
        invitationToken: null, // Nullify the token after successful use
      };
      const filter = { _id: target_id };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant,
      ).modify({ filter, update }, next);

      if (responseFromUpdateAccessRequest.success !== true) {
        return responseFromUpdateAccessRequest;
      }

      const requestType = accessRequest.requestType;
      let entity_title;
      let organization_slug;
      let assignmentResult;

      if (requestType === "group") {
        const group = await GroupModel(tenant)
          .findById(accessRequest.targetId)
          .lean();
        if (!group) {
          return {
            success: false,
            message: "Group not found",
            status: httpStatus.NOT_FOUND,
            errors: {
              message: "Group not found",
            },
          };
        }

        entity_title = group.grp_title;
        organization_slug = group.organization_slug;

        const assignUserRequest = {
          params: {
            grp_id: accessRequest.targetId,
            user_id: user._id,
          },
          query: { tenant: tenant },
        };

        try {
          assignmentResult = await createGroupUtil.assignOneUser(
            assignUserRequest,
            next,
          );

          if (!assignmentResult || !assignmentResult.success) {
            // Rollback user creation if this was a new user
            try {
              if (isNewUser) {
                await UserModel(tenant).findByIdAndDelete(user._id);
              }
              // Rollback access request status
              await AccessRequestModel(tenant).modify(
                {
                  filter: { _id: accessRequest._id },
                  update: {
                    status: "pending",
                    user_id: null,
                    invitationToken: originalInvitationToken,
                  },
                },
                next,
              );
            } catch (rollbackError) {
              logger.error(
                `Rollback failed during group assignment: ${rollbackError.message}`,
              );
            }

            return {
              success: false,
              message: `Failed to assign user to group: ${
                assignmentResult?.message || "Unknown error"
              }`,
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: {
                message: `Failed to assign user to group: ${
                  assignmentResult?.message || "Unknown error"
                }`,
              },
            };
          }
        } catch (assignmentError) {
          logger.error(`Group assignment error: ${assignmentError.message}`);
          // Rollback user creation if this was a new user
          try {
            if (isNewUser) {
              await UserModel(tenant).findByIdAndDelete(user._id);
            }
            // Rollback access request status
            await AccessRequestModel(tenant).modify(
              {
                filter: { _id: accessRequest._id },
                update: {
                  status: "pending",
                  user_id: null,
                  invitationToken: originalInvitationToken,
                },
              },
              next,
            );
          } catch (rollbackError) {
            logger.error(`Rollback failed: ${rollbackError.message}`);
          }

          return {
            success: false,
            message: `Group assignment failed: ${assignmentError.message}`,
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: `Group assignment failed: ${assignmentError.message}`,
            },
          };
        }
      } else if (requestType === "network") {
        const network = await NetworkModel(tenant)
          .findById(accessRequest.targetId)
          .lean();
        if (!network) {
          return {
            success: false,
            message: "Network not found",
            status: httpStatus.NOT_FOUND,
            errors: {
              message: "Network not found",
            },
          };
        }

        entity_title = network.net_name;

        const assignUserRequest = {
          params: {
            net_id: accessRequest.targetId,
            user_id: user._id,
          },
          query: { tenant: tenant },
        };

        try {
          assignmentResult = await createNetworkUtil.assignOneUser(
            assignUserRequest,
            next,
          );

          if (!assignmentResult || !assignmentResult.success) {
            // Rollback user creation if this was a new user
            if (isNewUser) {
              await UserModel(tenant).findByIdAndDelete(user._id);
            }
            // Rollback access request status
            await AccessRequestModel(tenant).modify(
              {
                filter: { _id: accessRequest._id },
                update: {
                  status: "pending",
                  user_id: null,
                  invitationToken: originalInvitationToken,
                },
              },
              next,
            );

            return {
              success: false,
              message: `Failed to assign user to network: ${
                assignmentResult?.message || "Unknown error"
              }`,
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: {
                message: `Failed to assign user to network: ${
                  assignmentResult?.message || "Unknown error"
                }`,
              },
            };
          }
        } catch (assignmentError) {
          logger.error(`Network assignment error: ${assignmentError.message}`);
          // Rollback user creation if this was a new user
          if (isNewUser) {
            await UserModel(tenant).findByIdAndDelete(user._id);
          }
          // Rollback access request status
          await AccessRequestModel(tenant).modify(
            {
              filter: { _id: accessRequest._id },
              update: {
                status: "pending",
                user_id: null,
                invitationToken: originalInvitationToken,
              },
            },
            next,
          );

          return {
            success: false,
            message: `Network assignment failed: ${assignmentError.message}`,
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: `Network assignment failed: ${assignmentError.message}`,
            },
          };
        }
      }

      if (assignmentResult && assignmentResult.success === true) {
        let login_url;
        if (requestType === "group" && organization_slug) {
          login_url = `${constants.ANALYTICS_BASE_URL}/org/${organization_slug}/login`;
        } else {
          login_url = `${constants.ANALYTICS_BASE_URL}/user/login`;
        }

        const responseFromSendEmail = await mailer.afterAcceptingInvitation(
          {
            firstName: user.firstName,
            username: user.email,
            email: user.email,
            entity_title,
            login_url: login_url,
            isNewUser,
          },
          next,
        );

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: isNewUser
              ? "Account created and organization invitation accepted successfully"
              : "Organization invitation accepted successfully",
            data: {
              user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              },
              organization: {
                id: accessRequest.targetId,
                name: entity_title,
                type: requestType,
              },
              isNewUser,
            },
            status: httpStatus.OK,
          };
        } else {
          // Don't fail the entire operation if email fails
          logger.error(
            `Failed to send acceptance email: ${responseFromSendEmail.message}`,
          );
          return {
            success: true,
            message: isNewUser
              ? "Account created and organization invitation accepted successfully (notification email failed)"
              : "Organization invitation accepted successfully (notification email failed)",
            data: {
              user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              },
              organization: {
                id: accessRequest.targetId,
                name: entity_title,
                type: requestType,
              },
              isNewUser,
            },
            status: httpStatus.OK,
          };
        }
      } else {
        return assignmentResult;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },

  requestAccessToNetwork: async (request, next) => {
    try {
      const {
        user: { _doc: user },
        query,
      } = request;
      const { tenant } = query;
      const { net_id } = request.params;

      const network = await NetworkModel(tenant).findById(net_id);
      if (isEmpty(network) || isEmpty(user._id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network or User not found",
          }),
        );
        return;
      }

      // Check if user is already a member
      const userDetails = await UserModel(tenant).findById(user._id).lean();
      if (userDetails && userDetails.network_roles) {
        const isAlreadyMember = userDetails.network_roles.some(
          (nr) => nr.network.toString() === net_id.toString(),
        );
        if (isAlreadyMember) {
          return {
            success: false,
            message: "You are already a member of this network",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "You are already a member of this network",
            },
          };
        }
      }

      // Check for existing pending request
      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: net_id,
        requestType: "network",
        status: "pending",
      });

      if (!isEmpty(existingRequest)) {
        return {
          success: false,
          message: "You already have a pending access request for this network",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "You already have a pending access request for this network",
            existing_request_id: existingRequest._id,
            requested_at: existingRequest.createdAt,
          },
        };
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant,
      ).register(
        {
          user_id: user._id,
          email: user.email,
          targetId: net_id,
          status: "pending",
          requestType: "network",
        },
        next,
      );

      if (responseFromCreateAccessRequest.success === true) {
        const createdAccessRequest = await responseFromCreateAccessRequest.data;
        const firstName = user.firstName ? user.firstName : "";
        const lastName = user.lastName ? user.lastName : "";
        if (isEmpty(user.email)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: {
              message:
                "Unable to retrieve the requester's email address, please crosscheck security token details",
            },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }

        const responseFromSendEmail = await mailer.request(
          {
            firstName,
            lastName,
            email: user.email,
            tenant,
            entity_title: network.net_name,
          },
          next,
        );

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: "Access Request completed successfully",
            data: createdAccessRequest,
            status: responseFromSendEmail.status
              ? responseFromSendEmail.status
              : httpStatus.OK,
          };
        } else if (responseFromSendEmail.success === false) {
          logger.error(`${responseFromSendEmail.message}`);
          // Don't fail the entire operation if email fails
          return {
            success: true,
            message:
              "Access Request completed successfully (notification email failed)",
            data: createdAccessRequest,
            status: httpStatus.OK,
          };
        }
      } else {
        logger.error(`${responseFromCreateAccessRequest.message}`);
        return responseFromCreateAccessRequest;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  approveAccessRequest: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { request_id } = params;

      // Check if request exists
      const accessRequest =
        await AccessRequestModel(tenant).findById(request_id);

      if (isEmpty(accessRequest)) {
        return {
          success: false,
          message: "Access request does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: "Access request does not exist, please crosscheck",
          },
        };
      }

      // Check if request is still pending
      if (accessRequest.status !== "pending") {
        return {
          success: false,
          message: `Cannot approve request - it has already been ${accessRequest.status}`,
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `This access request has already been ${accessRequest.status} and cannot be approved again`,
            current_status: accessRequest.status,
            request_id: accessRequest._id,
          },
        };
      }

      // Check if invitation has expired
      if (
        accessRequest.expires_at &&
        new Date(accessRequest.expires_at) < new Date()
      ) {
        return {
          success: false,
          message: "This invitation has expired and cannot be approved",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "This invitation has expired and cannot be approved",
            expired_at: accessRequest.expires_at,
            request_id: accessRequest._id,
          },
        };
      }

      // Handle case where user_id might not exist (email invitations)
      let user;
      if (accessRequest.user_id) {
        user = await UserModel(tenant).findById(accessRequest.user_id);
        if (isEmpty(user)) {
          return {
            success: false,
            message: "User Details in Access Request Not Found",
            status: httpStatus.NOT_FOUND,
            errors: {
              message: "User Details in Access Request Not Found",
            },
          };
        }
      } else if (accessRequest.email) {
        // Try to find user by email for email invitations
        user = await UserModel(tenant).findOne({
          email: accessRequest.email.toLowerCase(),
        });
        if (isEmpty(user)) {
          return {
            success: false,
            message:
              "User has not yet created an account. They must accept the invitation first.",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "User has not yet created an account. They must accept the invitation first.",
              email: accessRequest.email,
            },
          };
        }
        // Update access request with user_id
        accessRequest.user_id = user._id;
      } else {
        return {
          success: false,
          message: "Invalid access request - missing both user_id and email",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Invalid access request - missing both user_id and email",
          },
        };
      }

      // Check if user is already a member
      if (accessRequest.requestType === "group") {
        const isAlreadyMember =
          user.group_roles &&
          user.group_roles.some(
            (gr) => gr.group.toString() === accessRequest.targetId.toString(),
          );
        if (isAlreadyMember) {
          return {
            success: false,
            message: "User is already a member of this group",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "User is already a member of this group",
            },
          };
        }
      } else if (accessRequest.requestType === "network") {
        const isAlreadyMember =
          user.network_roles &&
          user.network_roles.some(
            (nr) => nr.network.toString() === accessRequest.targetId.toString(),
          );
        if (isAlreadyMember) {
          return {
            success: false,
            message: "User is already a member of this network",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "User is already a member of this network",
            },
          };
        }
      }

      const update = { status: "approved", user_id: user._id };
      const filter = { _id: ObjectId(accessRequest._id) };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant,
      ).modify(
        {
          filter,
          update,
        },
        next,
      );

      if (responseFromUpdateAccessRequest.success === true) {
        const { firstName, lastName, email } = user;
        if (accessRequest.requestType === "group") {
          const assignUserRequest = {
            params: {
              grp_id: accessRequest.targetId,
              user_id: user._id,
            },
            query: { tenant: tenant },
          };
          const responseFromAssignUserToGroup =
            await createGroupUtil.assignOneUser(assignUserRequest, next);

          logObject(
            "responseFromAssignUserToGroup",
            responseFromAssignUserToGroup,
          );

          if (responseFromAssignUserToGroup.success === true) {
            const updatedUserDetails = { groups: 1 };
            const responseFromSendEmail = await mailer.update(
              {
                email,
                firstName,
                lastName,
                updatedUserDetails,
              },
              next,
            );

            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "Access request approved successfully",
                status: httpStatus.OK,
                data: responseFromUpdateAccessRequest.data,
              };
            } else if (responseFromSendEmail.success === false) {
              logger.error(
                `Failed to send approval email: ${responseFromSendEmail.message}`,
              );
              // Don't fail the entire operation if email fails
              return {
                success: true,
                message:
                  "Access request approved successfully (email notification failed)",
                status: httpStatus.OK,
                data: responseFromUpdateAccessRequest.data,
              };
            }
          } else if (responseFromAssignUserToGroup.success === false) {
            // Rollback the status update
            try {
              await AccessRequestModel(tenant).modify(
                {
                  filter: { _id: ObjectId(accessRequest._id) },
                  update: { status: "pending" },
                },
                next,
              );
            } catch (rollbackError) {
              logger.error(`Rollback failed: ${rollbackError.message}`);
            }
            return responseFromAssignUserToGroup;
          }
        } else if (accessRequest.requestType === "network") {
          const assignUserRequest = {
            params: {
              net_id: accessRequest.targetId,
              user_id: user._id,
            },
            query: { tenant: tenant },
          };
          const responseFromAssignUserToNetwork =
            await createNetworkUtil.assignOneUser(assignUserRequest, next);

          if (responseFromAssignUserToNetwork.success === true) {
            const updatedUserDetails = { networks: 1 };
            const responseFromSendEmail = await mailer.update(
              { email, firstName, lastName, updatedUserDetails },
              next,
            );

            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "Access request approved successfully",
                status: httpStatus.OK,
                data: responseFromUpdateAccessRequest.data,
              };
            } else if (responseFromSendEmail.success === false) {
              logger.error(
                `Failed to send approval email: ${responseFromSendEmail.message}`,
              );
              // Don't fail the entire operation if email fails
              return {
                success: true,
                message:
                  "Access request approved successfully (email notification failed)",
                status: httpStatus.OK,
                data: responseFromUpdateAccessRequest.data,
              };
            }
          } else if (responseFromAssignUserToNetwork.success === false) {
            // Rollback the status update
            await AccessRequestModel(tenant).modify(
              {
                filter: { _id: ObjectId(accessRequest._id) },
                update: { status: "pending" },
              },
              next,
            );
            return responseFromAssignUserToNetwork;
          }
        }
      } else if (responseFromUpdateAccessRequest.success === false) {
        return responseFromUpdateAccessRequest;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  rejectAccessRequest: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { tenant } = query;
      const { request_id } = params;

      // Check if request exists
      const accessRequest =
        await AccessRequestModel(tenant).findById(request_id);

      if (isEmpty(accessRequest)) {
        return {
          success: false,
          message: "Access request does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: "Access request does not exist, please crosscheck",
          },
        };
      }

      // Check if request is still pending
      if (accessRequest.status !== "pending") {
        return {
          success: false,
          message: `Cannot reject request - it has already been ${accessRequest.status}`,
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `This access request has already been ${accessRequest.status} and cannot be rejected`,
            current_status: accessRequest.status,
            request_id: accessRequest._id,
          },
        };
      }

      const filter = { _id: ObjectId(request_id) };
      const update = body;

      const responseFromModifyAccessRequest = await AccessRequestModel(
        tenant.toLowerCase(),
      ).modify(
        {
          filter,
          update,
        },
        next,
      );

      logObject(
        "responseFromModifyAccessRequest",
        responseFromModifyAccessRequest,
      );

      if (responseFromModifyAccessRequest.success === true) {
        // Send rejection notification email
        let userEmail = accessRequest.email;
        let userName = "User";

        // Try to get user details if user_id exists
        if (accessRequest.user_id) {
          try {
            const user = await UserModel(tenant)
              .findById(accessRequest.user_id)
              .select("email firstName lastName");
            if (user) {
              userEmail = user.email;
              userName = user.firstName || user.email;
            }
          } catch (emailError) {
            logger.error(
              `Failed to fetch user details for rejection email: ${emailError.message}`,
            );
          }
        }

        // Get entity details for email
        let entityName = "organization";
        if (accessRequest.requestType === "group") {
          try {
            const group = await GroupModel(tenant)
              .findById(accessRequest.targetId)
              .select("grp_title");
            if (group) {
              entityName = group.grp_title;
            }
          } catch (groupError) {
            logger.error(
              `Failed to fetch group details: ${groupError.message}`,
            );
          }
        } else if (accessRequest.requestType === "network") {
          try {
            const network = await NetworkModel(tenant)
              .findById(accessRequest.targetId)
              .select("net_name");
            if (network) {
              entityName = network.net_name;
            }
          } catch (networkError) {
            logger.error(
              `Failed to fetch network details: ${networkError.message}`,
            );
          }
        }

        // Send rejection email (don't fail if this fails)
        if (userEmail) {
          try {
            await mailer.requestRejected(
              {
                email: userEmail,
                firstName: userName,
                entity_title: entityName,
                requestType: accessRequest.requestType,
              },
              next,
            );
          } catch (emailError) {
            logger.error(
              `Failed to send rejection email: ${emailError.message}`,
            );
          }
        }
      }

      return responseFromModifyAccessRequest;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip, include_expired } = query;
      const filter = generateFilter.requests(request, next);

      if (include_expired !== "true" && include_expired !== true) {
        const expiredOrConditions = [
          { expires_at: { $exists: false } },
          { expires_at: null },
          { expires_at: { $gt: new Date() } },
        ];
        // If filter is not empty, combine with $and
        if (Object.keys(filter).length > 0) {
          // If filter only contains $or, combine both $or arrays
          if (filter.$or && Object.keys(filter).length === 1) {
            filter.$and = [{ $or: filter.$or }, { $or: expiredOrConditions }];
            delete filter.$or;
          } else {
            filter.$and = [{ ...filter }, { $or: expiredOrConditions }];
            // Remove top-level keys except $and
            Object.keys(filter).forEach((key) => {
              if (key !== "$and") {
                delete filter[key];
              }
            });
          }
        } else {
          filter.$or = expiredOrConditions;
        }
      }

      const responseFromListAccessRequest = await AccessRequestModel(
        tenant.toLowerCase(),
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next,
      );
      return responseFromListAccessRequest;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  update: async (request, next) => {
    try {
      const { query, body } = request;
      const filter = generateFilter.requests(request, next);
      const update = body;
      const tenant = query.tenant;

      const responseFromModifyAccessRequest = await AccessRequestModel(
        tenant.toLowerCase(),
      ).modify(
        {
          filter,
          update,
        },
        next,
      );
      logObject(
        "responseFromModifyAccessRequest",
        responseFromModifyAccessRequest,
      );
      return responseFromModifyAccessRequest;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  delete: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { request_id } = params;

      // Check if request exists and get its current status
      const accessRequest =
        await AccessRequestModel(tenant).findById(request_id);

      if (isEmpty(accessRequest)) {
        return {
          success: false,
          message: "Access request does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: "Access request does not exist, please crosscheck",
          },
        };
      }

      // Only allow deletion of pending or rejected requests
      if (accessRequest.status === "approved") {
        return {
          success: false,
          message: "Cannot delete an approved access request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Cannot delete an approved access request. Approved requests must remain for audit purposes.",
            current_status: accessRequest.status,
          },
        };
      }

      const filter = generateFilter.requests(request, next);

      const responseFromRemoveAccessRequest = await AccessRequestModel(
        tenant.toLowerCase(),
      ).remove(
        {
          filter,
        },
        next,
      );

      logObject(
        "responseFromRemoveAccessRequest",
        responseFromRemoveAccessRequest,
      );
      return responseFromRemoveAccessRequest;
    } catch (error) {
      logObject("delete util error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
};

module.exports = createAccessRequest;
