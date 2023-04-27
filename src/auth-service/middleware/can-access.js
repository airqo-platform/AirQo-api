import { logElement } from "@utils/log";
const httpStatus = require("http-status");
const RoleSchema = "@models/Role";
const PermissionSchema = "@models/Permission";
const { getModelByTenant } = require("@config/dbConnection");

export default (permission) => async (req, res, next) => {
  const { tenant } = req.query;
  const filter = {
    name: permission,
  };
  const access = await getModelByTenant(
    tenant,
    "permission",
    PermissionSchema
  ).list({
    filter,
  });
  if (await req.userData.hasPermissionTo(access)) {
    return next();
  }
  logElement("You do not have the authorization to access this.");
  return res.status(403).json({
    status: httpStatus.UNAUTHORIZED,
    error: "You do not have the authorization to access this",
  });
};
