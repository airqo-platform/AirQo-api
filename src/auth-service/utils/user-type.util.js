const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- user-type-util`);

const type = {
  assignUserType: async (request, next) => {
    try {
      const { user_id, net_id, grp_id, user, user_type, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!isEmpty(grp_id) && !isEmpty(net_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID, choose one organization type",
          })
        );
      }

      if (!isEmpty(user) && !isEmpty(user_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          })
        );
      }

      const userId = user || user_id;
      const organisationId = net_id || grp_id;

      const userExists = await UserModel(tenant).exists({ _id: userId });

      if (!userExists) {
        next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} not found`,
          })
        );
      }

      const isNetworkType = isNetwork(net_id, grp_id);
      const roleType = isNetworkType ? "network_roles" : "group_roles";

      const isAlreadyAssigned = await UserModel(tenant).exists({
        _id: userId,
        [`${roleType}.${isNetworkType ? "network" : "group"}`]: organisationId,
      });

      if (!isAlreadyAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${userId} is NOT assigned to the provided ${
              isNetworkType ? "Network" : "Group"
            } ${organisationId}`,
          })
        );
      }

      const updateQuery = {
        $set: {
          [roleType]: {
            [isNetworkType ? "network" : "group"]: organisationId,
            userType: user_type,
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userId },
        updateQuery,
        { new: true, select: `${roleType}` }
      );

      if (updatedUser) {
        return {
          success: true,
          message: `User assigned to the ${user_type} User Type`,
          data: updatedUser,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Failed to assign user" }
          )
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
  assignManyUsersToUserType: async (request, next) => {
    try {
      const { user_ids, user_type, net_id, grp_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const userPromises = [];
      const isNetwork = !isEmpty(net_id);
      const isGroup = !isEmpty(grp_id);
      let updateQuery = {};

      if (isNetwork && isGroup) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID. Choose one organization type.",
          })
        );
      }

      for (const user_id of user_ids) {
        const user = await UserModel(tenant).findById(user_id);

        if (!user) {
          userPromises.push({
            success: false,
            message: `User ${user_id} does not exist`,
          });
          continue;
        }

        if (isNetwork) {
          const isAlreadyAssigned = user.network_roles.some(
            (role) => role.network.toString() === net_id
          );

          if (!isAlreadyAssigned) {
            userPromises.push({
              success: false,
              message: `User ${user_id} is NOT assigned to the provided Network ${net_id}`,
            });
            continue;
          }
          updateQuery.$set = updateQuery.$set || {};
          updateQuery.$set.network_roles = {
            network: net_id,
            userType: user_type,
          };
        } else if (isGroup) {
          const isAlreadyAssigned = user.group_roles.some(
            (role) => role.group.toString() === grp_id
          );

          if (!isAlreadyAssigned) {
            userPromises.push({
              success: false,
              message: `User ${user_id} is NOT assigned to provided Group ${grp_id}`,
            });
            continue;
          }
          updateQuery.$set = updateQuery.$set || {};
          updateQuery.$set.group_roles = { group: grp_id, userType: user_type };
        }

        await UserModel(tenant).updateOne({ _id: user_id }, updateQuery);

        userPromises.push({
          success: true,
          message: `User ${user_id} successfully assigned`,
        });
      }

      const results = await Promise.all(userPromises);
      const successful = results.filter(
        (result) => result !== null && result.success === true
      );
      const unsuccessful = results.filter(
        (result) => result !== null && result.success === false
      );

      if (unsuccessful.length > 0 && unsuccessful.length === user_ids.length) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `All users could not be assigned the ${user_type} user type.`,
            unsuccessful,
          })
        );
      } else if (
        unsuccessful.length > 0 &&
        unsuccessful.length !== user_ids.length
      ) {
        return {
          success: true,
          message: "Operation Partially successfull",
          data: { unsuccessful, successful },
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: `ALL provided users were successfully assigned the ${user_type} user type.`,
          status: httpStatus.OK,
        };
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
  listUsersWithUserType: async (request, next) => {
    try {
      logText("listUsersWithUserType...");
      const { user_type, net_id, grp_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (net_id && grp_id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID; choose one organization type",
          })
        );
      }

      let userTypeFilter = {};

      if (grp_id) {
        const group = await GroupModel(tenant)
          .findById(grp_id)
          .select("_id")
          .lean();
        logObject("group", group);
        if (isEmpty(group)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided Group ${grp_id.toString()} does not exist`,
            })
          );
        }
        userTypeFilter = {
          "group_roles.userType": user_type,
          "group_roles.group": grp_id,
        };
      }

      const responseFromListUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: userTypeFilter,
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      logObject("responseFromListUsers", responseFromListUsers);
      let message = `Retrieved all ${user_type} users for this Organisation`;
      if (isEmpty(responseFromListUsers)) {
        message = `No ${user_type} users exist for provided Organisation`;
      }

      return {
        success: true,
        message,
        data: responseFromListUsers,
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
  listAvailableUsersForUserType: async (request, next) => {
    try {
      logText("listAvailableUsersForUserType...");
      const { user_type, net_id, grp_id, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (net_id && grp_id) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide both a network ID and a group ID; choose one organization type",
          })
        );
      }

      let userTypeFilter = {};

      if (grp_id) {
        const group = await GroupModel(tenant)
          .findById(grp_id)
          .select("_id")
          .lean();
        logObject("group", group);
        if (isEmpty(group)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided Group ${grp_id.toString()} does not exist`,
            })
          );
        }
        userTypeFilter = {
          "group_roles.userType": user_type,
          "group_roles.group": grp_id,
        };
      }

      const assignedUsers = await UserModel(tenant)
        .distinct("email", userTypeFilter)
        .exec();

      const allUsers = await UserModel(tenant).distinct("email").exec();

      const availableUsers = allUsers.filter(
        (user) => !assignedUsers.includes(user)
      );

      const responseFromListAvailableUsers = await UserModel(tenant)
        .find({ email: { $in: availableUsers } })
        .select({
          _id: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
          userName: 1,
        })
        .exec();

      logObject(
        "responseFromListAvailableUsers",
        responseFromListAvailableUsers
      );

      let message = `Retrieved all eligible ${user_type} Users for the provided Organisation`;
      if (isEmpty(responseFromListAvailableUsers)) {
        message = `No users are available to be ${user_type} for the provided Organisation `;
      }
      return {
        success: true,
        message,
        data: responseFromListAvailableUsers,
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

module.exports = type;
