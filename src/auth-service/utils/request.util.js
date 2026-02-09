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

      const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

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

          const existingRequest = existingRequestsMap.get(normalizedEmail);
          if (existingRequest) {
            existingRequests.push({
              email,
              request_id: existingRequest._id,
              created_at: existingRequest.createdAt,
            });
            continue;
          }

          const invitationToken = crypto.randomBytes(32).toString("hex");
          const expiryDate = new Date(Date.now() + INVITATION_EXPIRY_MS);

          const accessRequestData = {
            email: normalizedEmail,
            targetId: grp_id,
            status: "pending",
            requestType: "group",
            inviter_id: inviterId,
            inviter_email: inviterEmail,
            expires_at: expiryDate,
            invitationToken,
            invitationTokenExpires: expiryDate,
          };

          if (existingUser) {
            accessRequestData.user_id = existingUser._id;
          }

          const responseFromCreateAccessRequest = await AccessRequestModel(
            tenant,
          ).register(accessRequestData, next);

          if (responseFromCreateAccessRequest.success === true) {
            const createdAccessRequest = responseFromCreateAccessRequest.data;

            const userExists = !!existingUser;

            const responseFromSendEmail =
              await mailer.requestToJoinGroupByEmail(
                {
                  email,
                  tenant,
                  entity_title: group.grp_title,
                  targetId: group._id,
                  inviterEmail,
                  userExists,
                  inviter_name: `${inviterDetails.firstName} ${inviterDetails.lastName}`,
                  request_id: createdAccessRequest._id,
                  group_description: group.grp_description,
                  expires_at: accessRequestData.expires_at,
                  token: invitationToken,
                },
                next,
              );

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

      // Dynamically build the query based on whether a token is provided
      const query = {};
      if (token) {
        // Token-based flow: Use targetId (group/network ID) and token
        query.targetId = target_id;
        Object.assign(query, {
          invitationToken: token,
          invitationTokenExpires: { $gt: new Date() },
        });
      } else {
        // Session-based flow: Use the access request's own _id
        query._id = target_id;
      }

      const accessRequest = await AccessRequestModel(tenant).findOne(query);

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
        typeof accessRequest.email === "string" &&
        typeof authUser.email === "string" &&
        accessRequest.email.trim().toLowerCase() !==
          authUser.email.trim().toLowerCase()
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

      // If using token auth, the user's email comes from the access request itself.
      let invitationEmail = email;
      if (token && accessRequest) {
        invitationEmail = accessRequest.email;
      }

      const existingUser = await UserModel(tenant).findOne({
        email: invitationEmail.toLowerCase(),
      });

      let user = null;
      let isNewUser = !existingUser;

      if (existingUser) {
        const requestType = accessRequest.requestType;

        if (requestType === "group") {
          const isAlreadyAssigned = existingUser.group_roles?.some(
            (gr) => gr.group.toString() === accessRequest.targetId.toString(),
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
            (nr) => nr.network.toString() === accessRequest.targetId.toString(),
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
          email: invitationEmail,
          password,
          userName: invitationEmail,
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
            try {
              if (isNewUser) {
                await UserModel(tenant).findByIdAndDelete(user._id);
              }
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
          try {
            if (isNewUser) {
              await UserModel(tenant).findByIdAndDelete(user._id);
            }
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
            if (isNewUser) {
              await UserModel(tenant).findByIdAndDelete(user._id);
            }
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
          if (isNewUser) {
            await UserModel(tenant).findByIdAndDelete(user._id);
          }
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
        try {
          // Invalidate the token only after successful assignment
          const invalidationResult = await AccessRequestModel(
            tenant,
          ).findByIdAndUpdate(
            accessRequest._id,
            {
              $set: {
                status: "approved",
                user_id: user._id,
              },
              $unset: { invitationToken: 1, invitationTokenExpires: 1 },
            },
            { new: true },
          );

          if (!invalidationResult) {
            throw new Error("Token invalidation failed: document not found.");
          }
        } catch (invalidationError) {
          logger.error(
            `CRITICAL: Token invalidation failed for access request ${accessRequest._id}. Initiating rollback.`,
            { error: invalidationError.message },
          );

          // Rollback: Remove user from the group/network
          try {
            if (requestType === "group") {
              await createGroupUtil.unAssignUser(
                {
                  params: { grp_id: accessRequest.targetId, user_id: user._id },
                  query: { tenant },
                },
                next,
              );
            } else if (requestType === "network") {
              await createNetworkUtil.unAssignUser(
                {
                  params: { net_id: accessRequest.targetId, user_id: user._id },
                  query: { tenant },
                },
                next,
              );
            }
            logger.info(
              `Rollback successful for user ${user._id} from ${requestType} ${accessRequest.targetId}`,
            );
          } catch (rollbackError) {
            logger.error(
              `CRITICAL-ROLLBACK-FAILURE: Failed to remove user during rollback: ${rollbackError.message}`,
            );
          }

          // Return an error to the user
          return {
            success: false,
            message:
              "Invitation acceptance failed due to a system error. Please try again.",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "A system error occurred during finalization. The operation has been safely rolled back.",
            },
          };
        }
        // Proceed with sending email notification
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
              login_url: login_url,
              isNewUser,
            },
            status: httpStatus.OK,
          };
        } else {
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
              login_url: login_url,
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
  listPendingInvitationsForUser: async (request, next) => {
    try {
      const { user, query } = request;
      const { tenant } = query;

      if (isEmpty(user) || isEmpty(user.email)) {
        return {
          success: false,
          message: "User authentication required",
          status: httpStatus.UNAUTHORIZED,
          errors: {
            message: "User email not found in authentication token",
          },
        };
      }

      const userEmail = user.email.toLowerCase();

      // Find all pending invitations for this user's email
      const pendingInvitations = await AccessRequestModel(tenant)
        .find({
          email: userEmail,
          status: "pending",
          invitationTokenExpires: { $gt: new Date() }, // Only non-expired invitations
        })
        .sort({ createdAt: -1 })
        .lean();

      if (isEmpty(pendingInvitations)) {
        return {
          success: true,
          message: "No pending invitations found",
          data: [],
          status: httpStatus.OK,
        };
      }

      // Enrich invitations with organization/network details
      const enrichedInvitations = await Promise.all(
        pendingInvitations.map(async (invitation) => {
          let entityDetails = null;

          if (invitation.requestType === "group") {
            const group = await GroupModel(tenant)
              .findById(invitation.targetId)
              .select("grp_title grp_description organization_slug")
              .lean();

            if (group) {
              entityDetails = {
                name: group.grp_title,
                description: group.grp_description,
                slug: group.organization_slug,
                type: "organization",
              };
            }
          } else if (invitation.requestType === "network") {
            const network = await NetworkModel(tenant)
              .findById(invitation.targetId)
              .select("net_name net_description")
              .lean();

            if (network) {
              entityDetails = {
                name: network.net_name,
                description: network.net_description,
                type: "network",
              };
            }
          }

          // Get inviter details
          let inviterDetails = null;
          if (invitation.inviter_id) {
            const inviter = await UserModel(tenant)
              .findById(invitation.inviter_id)
              .select("firstName lastName email")
              .lean();

            if (inviter) {
              inviterDetails = {
                name: `${inviter.firstName} ${inviter.lastName}`,
                email: inviter.email,
              };
            }
          }

          return {
            invitation_id: invitation._id,
            entity: entityDetails,
            inviter: inviterDetails,
            invited_at: invitation.createdAt,
            expires_at: invitation.expires_at,
            request_type: invitation.requestType,
            target_id: invitation.targetId,
          };
        }),
      );

      // Filter out invitations where entity no longer exists
      const validInvitations = enrichedInvitations.filter(
        (inv) => inv.entity !== null,
      );

      return {
        success: true,
        message: "Pending invitations retrieved successfully",
        data: validInvitations,
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
      return;
    }
  },
  rejectPendingInvitation: async (request, next) => {
    try {
      const { user, query, params } = request;
      const { tenant } = query;
      const { invitation_id } = params;

      if (isEmpty(user) || isEmpty(user.email)) {
        return {
          success: false,
          message: "User authentication required",
          status: httpStatus.UNAUTHORIZED,
          errors: {
            message: "User email not found in authentication token",
          },
        };
      }

      const userEmail = user.email.toLowerCase();

      // Find the invitation
      const invitation =
        await AccessRequestModel(tenant).findById(invitation_id);

      if (isEmpty(invitation)) {
        return {
          success: false,
          message: "Invitation not found",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: "Invitation not found",
          },
        };
      }

      // Verify this invitation belongs to the authenticated user
      if (invitation.email.toLowerCase() !== userEmail) {
        return {
          success: false,
          message: "Unauthorized to reject this invitation",
          status: httpStatus.FORBIDDEN,
          errors: {
            message: "This invitation does not belong to you",
          },
        };
      }

      // Check if already processed
      if (invitation.status !== "pending") {
        return {
          success: false,
          message: `Invitation has already been ${invitation.status}`,
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `This invitation has already been ${invitation.status}`,
          },
        };
      }

      // Update invitation status to rejected
      const filter = { _id: ObjectId(invitation_id) };
      const update = { status: "rejected" };

      const responseFromModifyAccessRequest = await AccessRequestModel(
        tenant,
      ).modify({ filter, update }, next);

      if (responseFromModifyAccessRequest.success === true) {
        return {
          success: true,
          message: "Invitation rejected successfully",
          data: {
            invitation_id: invitation_id,
            status: "rejected",
          },
          status: httpStatus.OK,
        };
      } else {
        return responseFromModifyAccessRequest;
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
};

module.exports = createAccessRequest;
