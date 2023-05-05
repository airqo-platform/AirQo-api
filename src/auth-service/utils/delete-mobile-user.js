const { getAuth } = require("firebase-admin/auth");
const admin = require('firebase-admin');

const constants = require("@config/constants");

const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- delete-mobile-user`);


const deleteMobileUser = { 
    deleteMobileUserData: async (request) => { 
    try {
        const { body } = request;
        const { email, phone } = body;
        let user;

      if (email === undefined&&phone===undefined) {         
         return {
        success: false,
        message: "Either email or phone number is required",
      };
      }
      if (email !== undefined) {
        try {
            user = await getAuth().getUserByEmail(email);
        } catch (error) {
          return {
            success: false,
            message: "Failed to get user.",
            errors: { message: error.message },
          };
        }   

      }
        if (phone !== undefined) {
          try {
            user = await getAuth().getUserByPhoneNumber(phone);
          } catch (error) {
            return {
              success: false,
              message: "Failed to get user.",
              errors: { message: error.message },
              status: httpStatus.OK,
            };
          }
      }
        const uid = user.uid;
      try {
        await getAuth().deleteUser(uid);
        return {
              success: true,
              message: "User account has been deleted.",
              status: httpStatus.OK,
            };
      } catch (error) {
        console.error("Error deleting user:", error);
            return {
              success: false,
              message: "Error deleting user",
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
      }

    } catch (error) {
        return {
              success: false,
              message: "Internal Server Error",
              errors: { message: error.message },
            };
    }
    },
   
};

module.exports = deleteMobileUser;