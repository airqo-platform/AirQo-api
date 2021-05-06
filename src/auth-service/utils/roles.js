const AccessControl = require("accesscontrol");
const ac = new AccessControl();

const resources = {
  profile: "profile",
  users: "users",
  networkTools: "networkTools",
  dashboard: "dashboard",
};

exports.roles = (function () {
  ac.grant("user")
    .readOwn(resources.profile, ["!privileges"])
    .readOwn(resources.dashboard)
    .updateOwn(resources.profile)
    .deleteOwn(resources.profile);

  ac.grant("admin")
    .extend("user")
    .readAny(resources.profile, ["*", "!password"])
    .readAny(resources.users)
    .createAny(resources.profile)
    .updateAny(resources.profile)
    .deleteAny(resources.profile)
    .updateOwn(resources.networkTools)
    .readOwn(resources.networkTools)
    .deleteOwn(resources.networkTools);

  ac.grant("super").extend("admin");

  ac.grant("netmanager")
    .extend("user")
    .updateOwn(resources.networkTools)
    .readOwn(resources.networkTools)
    .deleteOwn(resources.networkTools);

  return ac;
})();
