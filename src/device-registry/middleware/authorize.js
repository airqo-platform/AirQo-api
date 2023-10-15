const jwt = require("jsonwebtoken");
const { logObject } = require("@utils/log");
const constants = require("@config/constants");

// Function to extract user details from JWT token
function extractUserDetailsFromToken(token) {
  const decoded = jwt.verify(token.replace("JWT ", ""), constants.JWT_SECRET);
  return decoded.user;
}

// Function to get resource visibility
function getResourceVisibility(resourceId) {
  // Implement logic to retrieve the visibility status of the resource
  // This function should return either true (public) or false (private)
  // You can fetch this information from your database or resource metadata
  // Example: Replace this with actual logic
  return true; // Replace with your logic
}

// Function to check permissions
function checkPermission(user, resourceId, resourceVisibility) {
  // Implement your access control logic here
  // Check if the user has access to the resource based on their roles, groups, and resource visibility
  // You can access the user's roles and groups directly from the 'user' object

  // Example logic (customize as needed):
  // 1. If the resource is public, allow access
  // 2. If the resource is private, check if the user has special ownership or permissions

  if (resourceVisibility === true) {
    return true; // Resource is public, allow access
  } else {
    // Implement your logic to check for special ownership or permissions
    // Example: if the user's organization owns the resource, allow access
    // Customize this logic based on your specific requirements
    return user.organization === getResourceOwner(resourceId);
  }
}

// Function to get resource owner
function getResourceOwner(resourceId) {
  // Implement logic to retrieve the organization that owns the resource
  // This function should return the owner's organization ID or key
  // You can fetch this information from your database or resource metadata
  // Example: Replace this with actual logic
  return "owner-organization"; // Replace with your logic
}

async function performAccessControl(req, res, next) {
  try {
    // Extract user details from JWT token in the Authorization header
    const token = req.header("Authorization");
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Extract user details from the JWT token
    const user = extractUserDetailsFromToken(token);

    const resourceId = req.params.resourceId;

    // Get the requested resource visibility
    const resourceVisibility = getResourceVisibility(resourceId);

    // Check if the user has the necessary permissions or ownership
    const hasPermission = checkPermission(user, resourceId, resourceVisibility);

    if (!hasPermission) {
      return res.status(403).json({ message: "Access denied" });
    }

    // If access control passes, proceed with the request
    next();
  } catch (error) {
    console.error(`Error in performAccessControl: ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = performAccessControl;
