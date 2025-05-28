// utils/organization.util.js - SIMPLIFIED & ALIGNED

const axios = require("axios");
const { logText, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- organization-util`
);
const httpStatus = require("http-status");

class OrganizationUtil {
  constructor() {
    this.authServiceUrl = constants.AUTH_SERVICE_URL;
    if (!this.authServiceUrl) {
      throw new Error("AUTH_SERVICE_URL must be configured");
    }
    this.timeoutMs = 5000;

    // SIMPLIFIED: Use system/service JWT token
    this.serviceJwtToken = constants.SERVICE_JWT_TOKEN;

    if (!this.serviceJwtToken) {
      logger.warn(
        "⚠️  SERVICE_JWT_TOKEN not configured - organization validation will be limited"
      );
    }
  }

  // SIMPLIFIED: Build headers aligned with your auth service
  buildRequestHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    // Use JWT format like your auth service expects
    if (this.serviceJwtToken) {
      headers["Authorization"] = `JWT ${this.serviceJwtToken}`;
    }

    return headers;
  }

  // SIMPLIFIED: Validate user membership (essential logic only)
  async validateUserOrganizationMembership(request) {
    try {
      const { user_id, organization_id } = request;

      logText(`Validating: User ${user_id} in Organization ${organization_id}`);

      // Get user from auth service
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

      // Get organization details
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
      logger.error(`Organization validation error: ${error.message}`);

      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          message: "Auth service unavailable",
          status: httpStatus.SERVICE_UNAVAILABLE,
        };
      }

      return {
        success: false,
        message: "Organization validation failed",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  }

  // SIMPLIFIED: Get user from auth service
  async getUserFromAuthService(userId) {
    try {
      const response = await axios.get(
        `${this.authServiceUrl}/api/v2/users/${userId}`,
        {
          timeout: this.timeoutMs,
          headers: this.buildRequestHeaders(),
        }
      );

      return response.data?.user || response.data?.data || null;
    } catch (error) {
      logger.error(`Get user error: ${error.message}`);

      if (error.response?.status === 404) {
        return null; // User not found
      }

      throw error;
    }
  }

  // SIMPLIFIED: Get organization from auth service
  async getOrganizationFromAuthService(organizationId) {
    try {
      const response = await axios.get(
        `${this.authServiceUrl}/api/v2/groups/${organizationId}`,
        {
          timeout: this.timeoutMs,
          headers: this.buildRequestHeaders(),
        }
      );

      const group = response.data?.group;
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

  // SIMPLIFIED: Switch organization context
  async switchOrganizationContext(request) {
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
      logger.error(`Switch context error: ${error.message}`);
      return {
        success: false,
        message: "Context switch failed",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  }

  // SIMPLIFIED: Get user organizations
  async getUserOrganizations(userId) {
    try {
      const user = await this.getUserFromAuthService(userId);

      if (!user || !user.group_roles) {
        return {
          success: true,
          message: "User has no organization memberships",
          data: [],
        };
      }

      // Get organization details for each membership
      const organizations = [];
      for (const role of user.group_roles) {
        const org = await this.getOrganizationFromAuthService(role.group);
        if (org) {
          organizations.push({
            group_id: role.group,
            userType: role.userType,
            role: role.role,
            organization: org,
          });
        }
      }

      return {
        success: true,
        message: "User organizations retrieved successfully",
        data: organizations,
      };
    } catch (error) {
      logger.error(`Get user organizations error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve user organizations",
        data: [],
      };
    }
  }
}

module.exports = new OrganizationUtil();
