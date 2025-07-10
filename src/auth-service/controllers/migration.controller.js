const { logElement, logText, logObject } = require("@utils/shared");
const constants = require("@config/constants");
const UserModel = require("@models/User");
const httpStatus = require("http-status");

const migrationController = {
  // Audit deprecated fields - calls static method
  auditDeprecatedFields: async (req, res, next) => {
    try {
      const { tenant } = req.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const requestTenant = tenant || defaultTenant;

      logText(`Running deprecated fields audit for tenant: ${requestTenant}`);

      const User = UserModel(requestTenant);
      const result = await User.auditDeprecatedFieldUsage();

      // Check if the static method returned an error
      if (!result.success) {
        logObject("Audit failed", result);
        return res
          .status(result.status || httpStatus.INTERNAL_SERVER_ERROR)
          .json(result);
      }

      // Static method returned success, pass it through
      return res.status(result.status || httpStatus.OK).json(result);
    } catch (error) {
      logObject("Audit controller error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to audit deprecated fields",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },

  // Run the migration - calls static method
  migrateDeprecatedFields: async (req, res, next) => {
    try {
      const { tenant, confirm } = req.query;

      // Safety check - require explicit confirmation
      if (confirm !== constants.ADMIN_SETUP_SECRET) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message:
            "Migration requires explicit confirmation. Use the correct value of the confirmation secret.",
          status: httpStatus.BAD_REQUEST,
        });
      }

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const requestTenant = tenant || defaultTenant;

      logText(
        `Running deprecated fields migration for tenant: ${requestTenant}`
      );

      const User = UserModel(requestTenant);
      const result = await User.migrateDeprecatedFields();

      // Check if the static method returned an error
      if (!result.success) {
        logObject("Migration failed", result);
        return res
          .status(result.status || httpStatus.INTERNAL_SERVER_ERROR)
          .json(result);
      }

      // Static method returned success, pass it through
      return res.status(result.status || httpStatus.OK).json(result);
    } catch (error) {
      logObject("Migration controller error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Migration failed unexpectedly",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },

  // Get migration status - combines audit results into status format
  getMigrationStatus: async (req, res, next) => {
    try {
      const { tenant } = req.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const requestTenant = tenant || defaultTenant;

      logText(`Getting migration status for tenant: ${requestTenant}`);

      const User = UserModel(requestTenant);

      // Use the audit static method to get current status
      const auditResult = await User.auditDeprecatedFieldUsage();

      if (!auditResult.success) {
        logObject("Migration status audit failed", auditResult);
        return res
          .status(auditResult.status || httpStatus.INTERNAL_SERVER_ERROR)
          .json(auditResult);
      }

      // Transform audit data into migration status format
      const { deprecated_field_usage, migration_readiness, total_users } =
        auditResult.data;

      const status = {
        migration_complete: migration_readiness.safe_to_migrate,
        users_needing_migration:
          deprecated_field_usage.total_users_with_deprecated_fields,
        total_users: total_users,
        percentage_migrated:
          100 - migration_readiness.percentage_using_deprecated_fields,
        breakdown: {
          users_with_role_field: deprecated_field_usage.users_with_role_field,
          users_with_privilege_field:
            deprecated_field_usage.users_with_privilege_field,
          users_with_organization_field:
            deprecated_field_usage.users_with_organization_field,
          users_with_long_organization_field:
            deprecated_field_usage.users_with_long_organization_field,
        },
        last_checked: new Date(),
        tenant: requestTenant,
      };

      return res.status(httpStatus.OK).json({
        success: true,
        message: "Migration status retrieved successfully",
        data: status,
        status: httpStatus.OK,
      });
    } catch (error) {
      logObject("Migration status controller error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get migration status",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },

  // Enhanced method that shows detailed migration plan
  getMigrationPlan: async (req, res, next) => {
    try {
      const { tenant } = req.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const requestTenant = tenant || defaultTenant;

      logText(`Getting migration plan for tenant: ${requestTenant}`);

      const User = UserModel(requestTenant);
      const auditResult = await User.auditDeprecatedFieldUsage();

      if (!auditResult.success) {
        logObject("Migration plan audit failed", auditResult);
        return res
          .status(auditResult.status || httpStatus.INTERNAL_SERVER_ERROR)
          .json(auditResult);
      }

      const { deprecated_field_usage, migration_readiness, total_users } =
        auditResult.data;

      const plan = {
        current_state: {
          total_users,
          users_needing_migration:
            deprecated_field_usage.total_users_with_deprecated_fields,
          migration_complete: migration_readiness.safe_to_migrate,
          percentage_complete:
            100 - migration_readiness.percentage_using_deprecated_fields,
        },
        fields_to_remove: {
          role: deprecated_field_usage.users_with_role_field,
          privilege: deprecated_field_usage.users_with_privilege_field,
          organization: deprecated_field_usage.users_with_organization_field,
          long_organization:
            deprecated_field_usage.users_with_long_organization_field,
        },
        migration_steps: [
          {
            step: 1,
            action: "Audit deprecated fields",
            endpoint: "GET /api/migration/audit-deprecated-fields",
            description:
              "Review current state and identify users with deprecated fields",
          },
          {
            step: 2,
            action: "Run migration",
            endpoint:
              "POST /api/migration/migrate-deprecated-fields?confirm=YES_MIGRATE_DEPRECATED_FIELDS",
            description: "Remove deprecated fields from user documents",
          },
          {
            step: 3,
            action: "Verify migration",
            endpoint: "GET /api/migration/migration-status",
            description: "Confirm all deprecated fields have been removed",
          },
        ],
        recommendations: migration_readiness.safe_to_migrate
          ? ["Migration already complete. No action needed."]
          : [
              "Backup your database before running migration",
              "Run migration during low-traffic hours",
              "Monitor application logs during migration",
              "Verify migration results before deploying related changes",
            ],
        tenant: requestTenant,
        generated_at: new Date(),
      };

      return res.status(httpStatus.OK).json({
        success: true,
        message: "Migration plan generated successfully",
        data: plan,
        status: httpStatus.OK,
      });
    } catch (error) {
      logObject("Migration plan controller error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to generate migration plan",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
};

module.exports = migrationController;
