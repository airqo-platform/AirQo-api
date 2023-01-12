const defaultsRouter = require("./defaults");
const departmentsRouter = require("./departments");
const groupsRouter = require("./groups");
const inquiriesRouter = require("./inquiries");
const networksRouter = require("./networks");
const permissionsRouter = require("./permissions");
const requestsRouter = require("./requests");
const rolesRouter = require("./roles");
const usersRouter = require("./users");

const route = "extract route/path from request";

switch (route) {
  case "defaults":
    route = defaultsRouter;
  case "departments":
    route = departmentsRouter;
}

module.exports = {
  ...defaultsRouter,
  ...departmentsRouter,
  ...groupsRouter,
  ...inquiriesRouter,
  ...networksRouter,
  ...permissionsRouter,
  ...requestsRouter,
  ...rolesRouter,
  ...usersRouter,
};
