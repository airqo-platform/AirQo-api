const AdminJS = require("adminjs");
const AdminJSExpress = require("@adminjs/express");
const AdminJSMongoose = require("@adminjs/mongoose");

const adminJs = new AdminJS({
  databases: [],
  rootPath: "/admin",
});

AdminJS.registerAdapter(AdminJSMongoose);

const router = AdminJSExpress.buildRouter(adminJs);

module.exports = router;
