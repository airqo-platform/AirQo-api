import { logElement } from "@utils/log";
const httpStatus = require("http-status");
const RoleSchema = "@models/Role";
const PermissionSchema = "@models/Permission";
const { getModelByTenant } = require("@config/dbConnection");
const axios = require("axios");
const permissionsServiceUrl = "http://permissions-service:3000"; // URL of the permissions service

/**
 * As time goes on, we shall consider just returning measurements for
 */

const PermissionModel = (tenant) => {
  try {
    let permissions = mongoose.model("permissions");
    return permissions;
  } catch (error) {
    let permissions = getModelByTenant(tenant, "permission", PermissionSchema);
    return permissions;
  }
};

const RoleModel = (tenant) => {
  try {
    let roles = mongoose.model("roles");
    return roles;
  } catch (error) {
    let roles = getModelByTenant(tenant, "role", RoleSchema);
    return roles;
  }
};

const canAccess = {
  hasPermission: (permission) => async (req, res, next) => {
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
  },

  v2hasPermission: (requiredPermission) => {
    return async (req, res, next) => {
      const userId = req.user.id; // assuming the user ID is stored in the request object
      const { tenant } = req.query;
      const user = await UserModel(tenant).findById(userId).populate("role"); // assuming there is a role field in the User schema which references the Role collection

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const role = user.role;
      if (!role) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const permissions = role.permissions;
      if (!permissions.includes(requiredPermission)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      next();
    };
  },
  hasRole: (role) => async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (user.role !== role) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
  },

  hasDeviceAccess: async (req, res, next) => {
    const { deviceId } = req.params;
    const user = req.user;

    try {
      // Check if the user has permission to access the device's data
      const device = await Device.findOne({ _id: deviceId });
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      const role = await Role.findOne({ _id: user.role });
      const hasPermission = role.role_permissions.includes(device.permission);
      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "You do not have permission to access this device" });
      }

      // Check if the device is public or private
      if (!device.isPublic) {
        // Check if the user's organization matches the device's organization
        if (device.organization !== user.organization) {
          return res.status(403).json({
            error: "You do not have permission to access this device",
          });
        }
      }

      // If everything is fine, move to the next middleware
      next();
    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  v3hasPermission: async (req, res, next) => {
    try {
      const deviceId = req.params.deviceId;
      const userId = req.user.id;

      // Verify user's credentials with auth service
      const authResponse = await axios.get("http://auth-service/verify", {
        headers: {
          Authorization: req.headers.authorization,
        },
      });

      // Check user's permissions with permission service
      const permissionResponse = await axios.get(
        "http://permission-service/check",
        {
          params: {
            deviceId,
            userId,
          },
        }
      );

      // Check if device is public or private with device service
      const deviceResponse = await axios.get(
        `http://device-service/devices/${deviceId}`
      );

      if (
        !permissionResponse.data.allowed ||
        (!deviceResponse.data.isPublic &&
          !permissionResponse.data.allowedPrivate)
      ) {
        return res
          .status(403)
          .send("User does not have permission to access device data");
      }

      // Pass the request to the next middleware or route handler
      next();
    } catch (error) {
      console.error(error);
      return res.status(500).send("Error checking user permissions");
    }
  },

  // Middleware to check if a user has permission to access a device's data
  checkDevicePermissions: async (req, res, next) => {
    try {
      const deviceId = req.params.deviceId;

      // Check if the device is public or private by making a request to the device metadata service
      const device = await axios.get(
        `http://device-metadata-service:3000/devices/${deviceId}`
      );
      const isPublic = device.data.isPublic;

      // Check if the user has permission to access the device's data by making a request to the permissions service
      const token = req.headers.authorization.split(" ")[1]; // Get the JWT token from the Authorization header
      const response = await axios.post(
        `${permissionsServiceUrl}/checkDevicePermissions`,
        {
          deviceId,
          isPublic,
          token,
        }
      );

      if (response.data.hasPermission) {
        next();
      } else {
        res.status(403).send("Forbidden");
      }

      // // Route to get data for a specific device
      // app.get('/devices/:deviceId/data', checkDevicePermissions, async (req, res) => {
      //   try {
      //     const deviceId = req.params.deviceId;

      //     // Get the device's data from the device data service
      //     const response = await axios.get(`http://device-data-service:3000/devices/${deviceId}/data`);

      //     res.send(response.data);
      //   } catch (err) {
      //     console.error(err);
      //     res.status(500).send('Internal Server Error');
      //   }
      // });

      // app.listen(3000, () => {
      //   console.log('Auth service listening on port 3000');
      // });

      /**
       * 
       * // Permissions service
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const secretKey = 'mysecretkey'; // Secret key for JWT token signing
const deviceMetadataServiceUrl = 'http://device-metadata-service:3000'; // URL of the device metadata service

// Middleware to check if a user has permission to access a device's data
const checkDevicePermissions = async (req, res) => {
  try {
    const { deviceId, isPublic, token } = req.body;

    // Verify the JWT token and extract the user ID
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.sub;

    // Check if the user has permission to access the device's data based on the user's role and the device's public/private status
    if (isPublic || await hasUserRole(userId, 'admin')) {
      // User has permission to access the device's data
      res.send({ hasPermission: true });
    } else {
      // Check if the user has been granted permission to access the device
      const devicePermissions = await getDevicePermissions(deviceId);
      const hasDevicePermission = devicePermissions.includes(userId);

      if (hasDevicePermission) {
        // User has permission to access the device's data
        res.send({ hasPermission: true });
      } else {
        // User does not have permission to access the device's data
        res.send({ has

       */
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  },
};

/**
 * router.get('/protected', hasPermission('READ_USERS'), (req, res) => {
  // only users with the READ_USERS permission can access this endpoint
  res.json({ message: 'You have access to this endpoint' });
});
 */

/**
 * router.get('/protected', hasPermission('READ_USERS'), (req, res) => {
  // only users with the READ_USERS permission can access this endpoint
  res.json({ message: 'You have access to this endpoint' });
});

 */

/**
 * const Device = require('../models/Device');
const Measurement = require('../models/Measurement');

// Assume that the device ID is provided as a parameter in the request
const deviceId = req.params.deviceId;

// First, let's find the device details
const device = await Device.findById(deviceId);

// If the device is public, we can query for all public measurements for this device
if (device.isPublic) {
  const measurements = await Measurement.find({ deviceId, isPublic: true });
  res.json({ success: true, measurements });
} else {
  // If the device is not public, we need to check if the user has permission to view the private measurements
  // We can use the hasPermission middleware we defined earlier to check if the user has the required role
  // If the user has permission, we can return the private measurements
  // Otherwise, we return an error response
  // ...
}
 */

/**
 * Alternatively, if the latest measurements of all devices
 * in the network are considered public data, the middleware can be
 * configured to allow access to all users without any role checks.
 */

module.exports = canAccess;
