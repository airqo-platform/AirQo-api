//src/auth-service/utils/request.util.js
const UserModel = require("@models/User");
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
  `${constants.ENVIRONMENT} -- create-request-util`
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
          })
        );
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: grp_id,
        requestType: "group",
      });

      if (!isEmpty(existingRequest)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Access request already exists for this group",
          })
        );
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant
      ).register(
        {
          user_id: user._id,
          email: user.email,
          targetId: grp_id,
          status: "pending",
          requestType: "group",
        },
        next
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
              { message: "Unable to retrieve the requester's email address" }
            )
          );
        }
        const responseFromSendEmail = await mailer.request(
          {
            firstName,
            lastName,
            email: user.email,
            tenant,
            entity_title: group.grp_title,
          },
          next
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
          return responseFromSendEmail;
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
          { message: error.message }
        )
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

      // The 'user' object comes from the authenticated JWT (req.user)
      // It's a plain object, not a Mongoose document, so it doesn't have ._doc
      const inviter = user;

      if (isEmpty(inviter) || !inviter._id) {
        next(
          new HttpError("Authentication Error", httpStatus.UNAUTHORIZED, {
            message:
              "Inviter authentication failed. User details not found in token.",
          })
        );
        return;
      }

      const inviterEmail = inviter.email;
      const inviterId = inviter._id;

      const inviterDetails = await UserModel(tenant).findById(inviterId).lean();
      if (isEmpty(inviterDetails)) {
        next(
          new HttpError("Authentication Error", httpStatus.UNAUTHORIZED, {
            message: "Inviter details not found in the database.",
          })
        );
        return;
      }

      const group = await GroupModel(tenant).findById(grp_id).lean();
      if (isEmpty(group)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id} not found`,
          })
        );
        return;
      }

      const inviterGroupMembership = inviterDetails.group_roles?.find(
        (gr) => gr.group.toString() === grp_id.toString()
      );

      if (
        !inviterGroupMembership &&
        group.grp_manager?.toString() !== inviterId.toString()
      ) {
        logger.warn(
          `User ${inviterId} attempted to invite to group ${grp_id} without permission`
        );
        next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You do not have permission to invite users to this group",
          })
        );
        return;
      }

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Emails array is required and must not be empty",
          })
        );
        return;
      }

      const invalidEmails = emails.filter(
        (email) => !email || typeof email !== "string" || !email.includes("@")
      );
      if (invalidEmails.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid email formats: ${invalidEmails.join(", ")}`,
          })
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

      const existingRequests = [];
      const successResponses = [];
      const failureResponses = [];
      const alreadyMembers = [];

      for (const email of uniqueEmails) {
        try {
          const existingUser = await UserModel(tenant)
            .findOne({ email: email.toLowerCase() })
            .lean();
          if (existingUser) {
            const isAlreadyMember = existingUser.group_roles?.some(
              (gr) => gr.group.toString() === grp_id.toString()
            );

            if (isAlreadyMember) {
              alreadyMembers.push(email);
              continue;
            }
          }

          // Check for existing pending requests
          const existingRequest = await AccessRequestModel(tenant).findOne({
            email: email.toLowerCase(),
            targetId: grp_id,
            requestType: "group",
            status: "pending",
          });

          if (!isEmpty(existingRequest)) {
            existingRequests.push({
              email,
              request_id: existingRequest._id,
              created_at: existingRequest.createdAt,
            });
            continue;
          }

          const accessRequestData = {
            email: email.toLowerCase(),
            targetId: grp_id,
            status: "pending",
            requestType: "group",
            inviter_id: inviterId,
            inviter_email: inviterEmail,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
          };

          // If user exists, add user_id to request
          if (existingUser) {
            accessRequestData.user_id = existingUser._id;
          }

          const responseFromCreateAccessRequest = await AccessRequestModel(
            tenant
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
                  group_description: group.grp_description,
                  expires_at: accessRequestData.expires_at,
                },
                next
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
                responseFromSendEmail
              );
              failureResponses.push({
                email,
                success: false,
                message: `Failed to send invitation email: ${responseFromSendEmail.message}`,
                error: responseFromSendEmail.error,
              });
            }
          } else {
            logger.error(
              `Failed to create access request for ${email}:`,
              responseFromCreateAccessRequest
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

      // Build comprehensive response
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

      // Determine appropriate status code
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
        statusCode = httpStatus.MULTI_STATUS; // 207 - some succeeded, some failed
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
          })
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
        error
      );
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

  acceptInvitation: async (request, next) => {
    try {
      const { tenant, email, firstName, lastName, password, grids, target_id } =
        {
          ...request.body,
          ...request.query,
          ...request.params,
        };

      const existingUser = await UserModel(tenant).findOne({
        email: email.toLowerCase(),
      });

      const accessRequest = await AccessRequestModel(tenant).findOne({
        targetId: target_id,
        email,
        status: "pending",
      });

      if (isEmpty(accessRequest)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Access Request not found, please crosscheck provided details",
          })
        );
        return;
      }

      let user = null;
      let isNewUser = false;

      if (existingUser) {
        const requestType = accessRequest.requestType;

        if (requestType === "group") {
          const isAlreadyAssigned = existingUser.group_roles?.some(
            (gr) => gr.group.toString() === target_id.toString()
          );

          if (isAlreadyAssigned) {
            next(
              new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
                message: "User is already a member of this organization",
              })
            );
            return;
          }
        }

        user = existingUser;
        isNewUser = false;
      } else {
        const bodyForCreatingNewUser = {
          email,
          password,
          userName: email,
          firstName,
          lastName,
        };

        const responseFromCreateNewUser = await UserModel(tenant).register(
          bodyForCreatingNewUser,
          next
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

      // Update access request status
      const update = { status: "approved" };
      const filter = { email, targetId: target_id };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant
      ).modify({ filter, update }, next);

      if (responseFromUpdateAccessRequest.success !== true) {
        return responseFromUpdateAccessRequest;
      }

      const requestType = accessRequest.requestType;
      let entity_title;
      let assignmentResult;

      if (requestType === "group") {
        const group = await GroupModel(tenant).findById(target_id).lean();
        if (!group) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Group not found",
            })
          );
          return;
        }

        entity_title = group.grp_title;

        const assignUserRequest = {
          params: {
            grp_id: target_id,
            user_id: user._id,
          },
          query: { tenant: tenant },
        };

        try {
          assignmentResult = await createGroupUtil.assignOneUser(
            assignUserRequest,
            next
          );

          if (!assignmentResult || !assignmentResult.success) {
            next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                {
                  message: `Failed to assign user to group: ${
                    assignmentResult?.message || "Unknown error"
                  }`,
                }
              )
            );
            return;
          }
        } catch (assignmentError) {
          logger.error(`Group assignment error: ${assignmentError.message}`);
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: `Group assignment failed: ${assignmentError.message}`,
              }
            )
          );
          return;
        }
      } else if (requestType === "network") {
        const network = await NetworkModel(tenant).findById(target_id).lean();
        if (!network) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Network not found",
            })
          );
          return;
        }

        entity_title = network.net_name;

        const assignUserRequest = {
          params: {
            net_id: target_id,
            user_id: user._id,
          },
          query: { tenant: tenant },
        };

        try {
          assignmentResult = await createNetworkUtil.assignOneUser(
            assignUserRequest,
            next
          );

          if (!assignmentResult || !assignmentResult.success) {
            next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                {
                  message: `Failed to assign user to network: ${
                    assignmentResult?.message || "Unknown error"
                  }`,
                }
              )
            );
            return;
          }
        } catch (assignmentError) {
          logger.error(`Network assignment error: ${assignmentError.message}`);
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: `Network assignment failed: ${assignmentError.message}`,
              }
            )
          );
          return;
        }
      }

      if (assignmentResult && assignmentResult.success === true) {
        const responseFromSendEmail = await mailer.afterAcceptingInvitation(
          {
            firstName: user.firstName,
            username: user.email,
            email: user.email,
            entity_title,
            isNewUser,
          },
          next
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
                id: target_id,
                name: entity_title,
                type: requestType,
              },
              isNewUser,
            },
            status: httpStatus.OK,
          };
        } else {
          return responseFromSendEmail;
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
          { message: error.message }
        )
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
          })
        );
      }

      const existingRequest = await AccessRequestModel(tenant).findOne({
        user_id: user._id,
        targetId: net_id,
        requestType: "network",
      });

      if (!isEmpty(existingRequest)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Access request already exists for this network",
          })
        );
      }

      const responseFromCreateAccessRequest = await AccessRequestModel(
        tenant
      ).register(
        {
          user_id: user._id,
          targetId: net_id,
          status: "pending",
          requestType: "network",
        },
        next
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
          next
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
          return responseFromSendEmail;
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
          { message: error.message }
        )
      );
    }
  },

  approveAccessRequest: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const { request_id } = request.params;
      const accessRequest = await AccessRequestModel(tenant).findById(
        request_id
      );
      logObject("accessRequest", accessRequest);
      if (isEmpty(accessRequest)) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Access request not found",
          })
        );
      }

      const user = await UserModel(tenant).findById(accessRequest.user_id);

      if (isEmpty(user)) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "User Details in Access Request Not Found",
          })
        );
      }

      const update = { status: "approved" };
      const filter = { _id: ObjectId(accessRequest._id) };

      const responseFromUpdateAccessRequest = await AccessRequestModel(
        tenant
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUpdateAccessRequest.success === true) {
        const { firstName, lastName, email } = user;
        if (accessRequest.requestType === "group") {
          const assignUserRequest = {
            params: {
              grp_id: accessRequest.targetId,
              user_id: accessRequest.user_id,
            },
            query: { tenant: tenant },
          };
          const responseFromAssignUserToGroup =
            await createGroupUtil.assignOneUser(assignUserRequest, next);

          logObject(
            "responseFromAssignUserToGroup",
            responseFromAssignUserToGroup
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
              next
            );

            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "Access request approved successfully",
                status: httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
          } else if (responseFromAssignUserToGroup.success === false) {
            return responseFromAssignUserToGroup;
          }
        } else if (accessRequest.requestType === "network") {
          const assignUserRequest = {
            params: {
              net_id: accessRequest.targetId,
              user_id: accessRequest.user_id,
            },
            query: { tenant: tenant },
          };
          const responseFromAssignUserToNetwork =
            await createNetworkUtil.assignOneUser(assignUserRequest, next);

          if (responseFromAssignUserToNetwork.success === true) {
            const updatedUserDetails = { networks: 1 };
            const responseFromSendEmail = await mailer.update(
              { email, firstName, lastName, updatedUserDetails },
              next
            );

            if (responseFromSendEmail.success === true) {
              return {
                success: true,
                message: "Access request approved successfully",
                status: httpStatus.OK,
              };
            } else if (responseFromSendEmail.success === false) {
              return responseFromSendEmail;
            }
          } else if (responseFromAssignUserToNetwork.success === false) {
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
          { message: error.message }
        )
      );
    }
  },

  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.requests(request, next);
      const responseFromListAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListAccessRequest;
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

  update: async (request, next) => {
    try {
      const { query, body } = request;
      const filter = generateFilter.requests(request, next);
      const update = body;
      const tenant = query.tenant;

      const responseFromModifyAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).modify(
        {
          filter,
          update,
        },
        next
      );
      logObject(
        "responseFromModifyAccessRequest",
        responseFromModifyAccessRequest
      );
      return responseFromModifyAccessRequest;
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

  delete: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.requests(request, next);

      const responseFromRemoveAccessRequest = await AccessRequestModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      logObject(
        "responseFromRemoveAccessRequest",
        responseFromRemoveAccessRequest
      );
      return responseFromRemoveAccessRequest;
    } catch (error) {
      logObject("delete util error", error);
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

module.exports = createAccessRequest;
