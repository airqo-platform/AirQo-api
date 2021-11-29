const { client, sendMessagesToTopics } = require("../config/kafka");
const HTTPStatus = require("http-status");

const kafka = {
  pushDetailsToTopic: () => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  pullDetailsFromTopic: () => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

module.exports = kafka;
