const joi = require("joi");
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Blog Content Manager",
      version: "1.0.0",
      description:
        "This is a comprehensive microservice designed to create, manage, and share content efficiently. It provides a robust set of features for both content creators and readers, ensuring a seamless blogging experience.",
    },
    servers: [
      {
        url: "http://localhost:3000",
      },
    ],
  },
  apis: [
    "./routes/**/*.js", // Include all route files across all versions
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
