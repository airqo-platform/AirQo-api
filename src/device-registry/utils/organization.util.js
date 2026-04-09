const axios = require("axios");
const { logText, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- organization-util`
);
const httpStatus = require("http-status");

console.log("constants.AUTH_SERVICE_URL", constants.AUTH_SERVICE_URL);

class OrganizationUtil {
  constructor() {
    //DEFENSIVE: Don't throw errors in constructor
    this.authServiceUrl = constants.AUTH_SERVICE_URL;
    this.isConfigured = !!this.authServiceUrl;
    this.timeoutMs = 5000;
    this.serviceJwtToken = constants.SERVICE_JWT_TOKEN;

    if (!this.isConfigured) {
      logger.warn(
        "⚠️  AUTH_SERVICE_URL not configured - organization features will be limited"
      );
    }

    if (!this.serviceJwtToken) {
      logger.warn(
        "⚠️  SERVICE_JWT_TOKEN not configured - organization validation will be limited"
      );
    }
  }

  //CHECK CONFIGURATION: Before each method call
  _checkConfiguration() {
    if (!this.isConfigured) {
      return {
        success: false,
        message: "Organization service not configured",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: {
          message:
            "AUTH_SERVICE_URL must be configured to use organization features",
          configuration_missing: ["AUTH_SERVICE_URL"],
        },
      };
    }
    return null;
  }

  /**
   * Build consistent request headers for all API calls
   * @returns {object} - Headers object for HTTP requests
   */
  buildRequestHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.serviceJwtToken) {
      headers["Authorization"] = `JWT ${this.serviceJwtToken}`;
    }

    return headers;
  }

  /**
   * Generic HTTP request handler with consistent error handling
   * @private
   * @param {string} endpoint - API endpoint path
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {object} data - Request data (for POST/PUT)
   * @returns {Promise<object>} - API response data
   */
  async _makeApiRequest(endpoint, method = "GET", data = null) {
    const configCheck = this._checkConfiguration();
    if (configCheck) throw new Error(configCheck.message);

    try {
      const config = {
        method,
        url: `${this.authServiceUrl}${endpoint}`,
        timeout: this.timeoutMs,
        headers: this.buildRequestHeaders(),
      };

      if (data && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error(
        `API request failed [${method} ${endpoint}]: ${error.message}`
      );

      if (error.response?.status === 404) {
        return null; // Resource not found
      }

      if (error.code === "ECONNREFUSED") {
        const connError = new Error("Auth service unavailable");
        connError.code = "SERVICE_UNAVAILABLE";
        throw connError;
      }

      throw error;
    }
  }

  /**
   *  Standardized error response formatting
   * @private
   * @param {Error} error - Error object
   * @param {string} operation - Operation description for logging
   * @param {string} defaultMessage - Default error message
   * @returns {object} - Formatted error response
   */
  _formatErrorResponse(error, operation, defaultMessage) {
    logger.error(`${operation} error: ${error.message}`);

    if (error.code === "SERVICE_UNAVAILABLE") {
      return {
        success: false,
        message: "Auth service unavailable",
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
    }

    return {
      success: false,
      message: defaultMessage,
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }

  // Check configuration before proceeding
  async validateUserOrganizationMembership(request) {
    const configCheck = this._checkConfiguration();
    if (configCheck) return configCheck;

    try {
      const { user_id, organization_id } = request;

      logText(`Validating: User ${user_id} in Organization ${organization_id}`);

      // Get user from auth service using DRY helper
      const user = await this.getUserFromAuthService(user_id);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Simple membership check
      const isMember = user.group_roles?.some(
        (role) => role.group?.toString() === organization_id.toString()
      );

      if (!isMember) {
        return {
          success: false,
          message: "User is not a member of this organization",
          status: httpStatus.FORBIDDEN,
          errors: {
            message: "Access denied: User does not belong to this organization",
          },
        };
      }

      // Get organization details using DRY helper
      const organization = await this.getOrganizationFromAuthService(
        organization_id
      );

      return {
        success: true,
        message: "User membership validated successfully",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          organization: organization,
          membership: user.group_roles.find(
            (role) => role.group?.toString() === organization_id.toString()
          ),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      return this._formatErrorResponse(
        error,
        "Organization validation",
        "Organization validation failed"
      );
    }
  }

  async getUserFromAuthService(userId) {
    try {
      const responseData = await this._makeApiRequest(
        `/api/v2/users/${userId}`
      );
      return responseData?.user || responseData?.data || null;
    } catch (error) {
      if (error.message === "Auth service unavailable") {
        throw error; // Re-throw service unavailable errors
      }
      return null; // User not found or other errors
    }
  }

  async getOrganizationFromAuthService(organizationId) {
    try {
      const responseData = await this._makeApiRequest(
        `/api/v2/groups/${organizationId}`
      );

      const group = responseData?.group;
      if (group) {
        return {
          id: group._id,
          name: group.grp_title,
          description: group.grp_description,
          status: group.grp_status,
        };
      }

      return null;
    } catch (error) {
      logger.error(`Get organization error: ${error.message}`);
      return null;
    }
  }

  //Check configuration before proceeding
  async switchOrganizationContext(request) {
    const configCheck = this._checkConfiguration();
    if (configCheck) return configCheck;

    try {
      const { user_id, organization_id } = request;

      const validationResult = await this.validateUserOrganizationMembership({
        user_id,
        organization_id,
      });

      if (!validationResult.success) {
        return validationResult;
      }

      return {
        success: true,
        message: "Organization context switched successfully",
        data: {
          active_organization_id: organization_id,
          user_id: user_id,
          organization: validationResult.data.organization,
          user_role: validationResult.data.membership?.userType || "member",
          switched_at: new Date(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      return this._formatErrorResponse(
        error,
        "Switch context",
        "Context switch failed"
      );
    }
  }

  async getUserOrganizations(userId) {
    const configCheck = this._checkConfiguration();
    if (configCheck) return configCheck;

    try {
      const user = await this.getUserFromAuthService(userId);

      if (!user || !user.group_roles) {
        return {
          success: true,
          message: "User has no organization memberships",
          data: [],
        };
      }

      const organizationPromises = user.group_roles.map(async (role) => {
        const org = await this.getOrganizationFromAuthService(role.group);
        if (org) {
          return {
            group_id: role.group,
            userType: role.userType,
            role: role.role,
            organization: org,
          };
        }
        return null;
      });

      const organizations = (await Promise.all(organizationPromises)).filter(
        (org) => org !== null
      );

      return {
        success: true,
        message: "User organizations retrieved successfully",
        data: organizations,
      };
    } catch (error) {
      return this._formatErrorResponse(
        error,
        "Get user organizations",
        "Failed to retrieve user organizations"
      );
    }
  }

  //  Check if organization features are available
  isAvailable() {
    return this.isConfigured;
  }

  // Get configuration status
  getStatus() {
    return {
      configured: this.isConfigured,
      auth_service_url: this.authServiceUrl || "NOT_SET",
      jwt_token_available: !!this.serviceJwtToken,
      ready: this.isConfigured && !!this.serviceJwtToken,
    };
  }

  /**
   * Health check for auth service
   * @returns {Promise<object>} - Health check result
   */
  async healthCheck() {
    if (!this.isConfigured) {
      return {
        status: "unhealthy",
        message: "Service not configured",
        configured: false,
      };
    }

    try {
      await this._makeApiRequest("/api/v2/health");
      return {
        status: "healthy",
        message: "Auth service is responsive",
        configured: true,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error.message,
        configured: true,
      };
    }
  }
}

module.exports = new OrganizationUtil();
