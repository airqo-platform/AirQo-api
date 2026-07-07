const GuestUserModel = require("@models/GuestUser");
const UserModel = require("@models/User");
const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const { stringify, generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- guest-user-util`);
const guestUser = {
  create: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = { ...body, ...query };
      const responseFromCreateGuest = await GuestUserModel(tenant).register(
        body,
        next
      );

      return responseFromCreateGuest;
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
  convertGuest: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant, guest_id } = { ...body, ...query };

      if (!guest_id) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "the guest_id field is required",
          })
        );
      }
      // check if guest user exists
      const guestUser = await GuestUserModel(tenant)
        .findOne({ guest_id })
        .lean();

      if (isEmpty(guestUser)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "the guest user does not exist",
          })
        );
      }
      // Layer the guest's stored identity fields under whatever the
      // client explicitly supplied — client-provided values always win,
      // guest data only fills in what's missing.
      const registrationBody = { ...body };
      if (!registrationBody.firstName && guestUser.firstName) {
        registrationBody.firstName = guestUser.firstName;
      }
      if (!registrationBody.lastName && guestUser.lastName) {
        registrationBody.lastName = guestUser.lastName;
      }
      if (!registrationBody.userName && guestUser.displayName) {
        registrationBody.userName = guestUser.displayName;
      }

      // create new user
      const newUser = await UserModel(tenant).register(registrationBody, next);

      if (!newUser || newUser.success === false) {
        return newUser;
      }

      //delete guest
      const responseFromDeleteGuest = await GuestUserModel(tenant).remove(
        { guest_id },
        next
      );

      return newUser;
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
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };
      const filter = generateFilter.guest_users(request, next);

      const response = await GuestUserModel(tenant).list(
        { skip, limit, filter },
        next
      );

      return response;
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
      const { tenant } = query;
      const filter = generateFilter.guest_users(request, next);

      let update = Object.assign({}, body);

      const response = await GuestUserModel(tenant.toLowerCase()).modify(
        { filter, update },
        next
      );
      return response;
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
      const filter = generateFilter.guest_users(request, next);

      const response = await GuestUserModel(tenant.toLowerCase()).remove(
        { filter },
        next
      );
      return response;
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
  getOne: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, id } = { ...query, ...params };
      const filter = generateFilter.guest_users(request, next);

      const response = await GuestUserModel(tenant).list({ filter }, next);

      if (response.data.length === 0) {
        return {
          success: true,
          message: "No guest user with those details exist",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      } else {
        return {
          success: true,
          message: "successfully retrieved the guest user details",
          data: response.data[0],
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
};

module.exports = guestUser;
