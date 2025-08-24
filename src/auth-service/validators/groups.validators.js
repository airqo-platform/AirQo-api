// groups.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["kcca", "airqo", "airqount"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const validateGroupIdParam = [
  param("grp_id")
    .exists()
    .withMessage("the group ID parameter is missing in request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("The group ID parameter must be a valid MongoDB ObjectId."),
];

const validateUserIdParam = oneOf([
  param("user_id")
    .exists()
    .withMessage("the user ID parameter is missing in the request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the user ID parameter must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const deleteGroup = [validateTenant, validateGroupIdParam];

const update = [
  validateTenant,
  validateGroupIdParam,
  [
    body("grp_description")
      .optional()
      .notEmpty()
      .withMessage("the grp_description should not be empty if provided")
      .trim(),
    body("grp_country")
      .optional()
      .notEmpty()
      .withMessage("the grp_country should not be empty if provided")
      .bail()
      .trim(),
    body("grp_timezone")
      .optional()
      .notEmpty()
      .withMessage("the grp_timezone should not be empty if provided")
      .bail()
      .trim(),
    body("grp_industry")
      .optional()
      .notEmpty()
      .withMessage("the grp_industry should not be empty if provided")
      .bail()
      .trim(),
    body("grp_sites")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("grp_sites must be an array if provided")
      .bail()
      .custom((value) => {
        // Check for duplicates in the array
        if (Array.isArray(value)) {
          return new Set(value).size === value.length;
        }
        return true;
      })
      .withMessage("Duplicate site IDs are not allowed in grp_sites"),
    body("grp_sites.*")
      .optional()
      .isMongoId()
      .withMessage("Each site ID in grp_sites must be a valid ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("grp_image")
      .optional()
      .notEmpty()
      .withMessage("the grp_image should not be empty if provided")
      .bail()
      .trim(),
    body("grp_website")
      .optional()
      .notEmpty()
      .withMessage("the grp_website should not be empty if provided")
      .bail()
      .isURL()
      .withMessage("the grp_website must be a valid URL")
      .trim(),
    body("grp_status")
      .optional()
      .notEmpty()
      .withMessage("the grp_status should not be empty if provided")
      .bail()
      .trim()
      .toUpperCase()
      .isIn(["INACTIVE", "ACTIVE"])
      .withMessage(
        "the grp_status value is not among the expected ones, use ACTIVE or INACTIVE"
      ),
  ],
];

const list = [
  validateTenant,
  oneOf([
    query("grp_id")
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID IF provided")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("grp_title")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("grp_title should not be empty IF provided")
      .bail(),
    query("grp_status")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("grp_status should not be empty IF provided")
      .bail()
      .trim()
      .toUpperCase()
      .isIn(["INACTIVE", "ACTIVE"])
      .withMessage(
        "the grp_status value is not among the expected ones, use ACTIVE or INACTIVE"
      ),
  ]),
];

const create = [
  validateTenant,
  [
    body("grp_title")
      .exists()
      .withMessage("the grp_title is required")
      .bail()
      .notEmpty()
      .withMessage("the grp_title should not be empty")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the grp_title can only contain letters, numbers, spaces, hyphens and underscores"
      )
      .bail(),
    body("grp_sites")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("grp_sites must be an array if provided")
      .bail()
      .custom((value) => {
        // Check for duplicates in the array
        if (Array.isArray(value)) {
          return new Set(value).size === value.length;
        }
        return true;
      })
      .withMessage("Duplicate site IDs are not allowed in grp_sites"),
    body("grp_sites.*")
      .optional()
      .isMongoId()
      .withMessage("Each site ID in grp_sites must be a valid ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("organization_slug")
      .optional()
      .notEmpty()
      .withMessage("organization_slug should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase alphanumeric with hyphens only")
      .bail()
      .isLength({ min: 2, max: 100 })
      .withMessage("Slug must be between 2 and 100 characters"),
    body("grp_description")
      .exists()
      .withMessage("the grp_description is required")
      .bail()
      .notEmpty()
      .withMessage("the grp_description should not be empty")
      .trim(),
    body("user_id")
      .optional()
      .notEmpty()
      .withMessage("the user_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("grp_country")
      .optional()
      .notEmpty()
      .withMessage("the grp_country should not be empty if provided")
      .bail()
      .trim(),
    body("grp_image")
      .optional()
      .notEmpty()
      .withMessage("the grp_image should not be empty if provided")
      .bail()
      .trim(),
    body("grp_timezone")
      .optional()
      .notEmpty()
      .withMessage("the grp_timezone should not be empty if provided")
      .bail()
      .trim(),
    body("grp_industry")
      .optional()
      .notEmpty()
      .withMessage("the grp_industry should not be empty if provided")
      .bail()
      .trim(),
    body("grp_website")
      .optional()
      .notEmpty()
      .withMessage("the grp_website should not be empty if provided")
      .bail()
      .isURL()
      .withMessage("the grp_website must be a valid URL"),
  ],
];

const removeUniqueConstraint = [validateTenant];

const assignOneUser = [
  validateTenant,
  validateGroupIdParam,
  validateUserIdParam,
];

const listSummary = [validateTenant];

const setManager = [validateTenant, validateGroupIdParam, validateUserIdParam];

const listAssignedUsers = [validateTenant, validateGroupIdParam];

const listAllGroupUsers = [validateTenant, validateGroupIdParam];

const listAvailableUsers = [validateTenant, validateGroupIdParam];

const assignUsers = [
  validateTenant,
  validateGroupIdParam,
  [
    body("user_ids")
      .exists()
      .withMessage("the user_ids should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the user_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the user_ids should not be empty"),
    body("user_ids.*")
      .isMongoId()
      .withMessage("user_id provided must be an object ID"),
  ],
];

const unAssignUser = [
  validateTenant,
  validateGroupIdParam,
  validateUserIdParam,
];

const unAssignManyUsers = [
  validateTenant,
  validateGroupIdParam,
  [
    body("user_ids")
      .exists()
      .withMessage("the user_ids should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the user_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the user_ids should not be empty"),
    body("user_ids.*")
      .isMongoId()
      .withMessage("user_id provided must be an object ID"),
  ],
];

const listRolesForGroup = [
  validateTenant,
  [
    param("grp_id")
      .exists()
      .withMessage("the group ID param is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("the group ID param cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the group ID provided must be an object ID"),
  ],
];

const getGroupById = [
  validateTenant,
  [
    param("grp_id")
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const enhancedSetManager = [
  validateTenant,
  validateGroupIdParam,
  validateUserIdParam,
  [
    body("assign_manager_role")
      .optional()
      .isBoolean()
      .withMessage("assign_manager_role must be a boolean")
      .toBoolean(),
    body("notify_user")
      .optional()
      .isBoolean()
      .withMessage("notify_user must be a boolean")
      .toBoolean(),
    body("transition_previous_manager")
      .optional()
      .isBoolean()
      .withMessage("transition_previous_manager must be a boolean")
      .toBoolean(),
    body("effective_date")
      .optional()
      .isISO8601()
      .withMessage("effective_date must be a valid ISO8601 date")
      .toDate(),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("reason must not exceed 500 characters"),
  ],
];

const getGroupAnalytics = [
  validateTenant,
  validateGroupIdParam,
  [
    query("time_range")
      .optional()
      .isIn(["7d", "30d", "90d", "1y", "all"])
      .withMessage("time_range must be one of: 7d, 30d, 90d, 1y, all"),
    query("metric_type")
      .optional()
      .isIn([
        "overview",
        "members",
        "activity",
        "roles",
        "engagement",
        "performance",
      ])
      .withMessage(
        "metric_type must be one of: overview, members, activity, roles, engagement, performance"
      ),
    query("include_trends")
      .optional()
      .isBoolean()
      .withMessage("include_trends must be a boolean")
      .toBoolean(),
    query("include_comparisons")
      .optional()
      .isBoolean()
      .withMessage("include_comparisons must be a boolean")
      .toBoolean(),
    query("granularity")
      .optional()
      .isIn(["daily", "weekly", "monthly"])
      .withMessage("granularity must be one of: daily, weekly, monthly"),
  ],
];

const bulkMemberManagement = [
  validateTenant,
  validateGroupIdParam,
  [
    body("actions")
      .exists()
      .withMessage("actions array is required")
      .isArray({ min: 1, max: 100 })
      .withMessage("actions must be an array with 1-100 items"),
    body("actions.*.user_id")
      .exists()
      .withMessage("user_id is required for each action")
      .isMongoId()
      .withMessage("user_id must be a valid ObjectId"),
    body("actions.*.action_type")
      .exists()
      .withMessage("action_type is required for each action")
      .isIn([
        "assign_role",
        "remove_role",
        "remove_member",
        "change_status",
        "update_permissions",
      ])
      .withMessage(
        "action_type must be one of: assign_role, remove_role, remove_member, change_status, update_permissions"
      ),
    body("actions.*.role_id")
      .optional()
      .isMongoId()
      .withMessage("role_id must be a valid ObjectId if provided"),
    body("actions.*").custom((action) => {
      if (
        ["assign_role", "update_permissions"].includes(action.action_type) &&
        !action.role_id
      ) {
        throw new Error(
          "role_id is required when action_type is assign_role or update_permissions"
        );
      }
      return true;
    }),
    body("actions.*.reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("reason must not exceed 500 characters"),
    body("actions.*.effective_date")
      .optional()
      .isISO8601()
      .withMessage("effective_date must be a valid ISO8601 date")
      .toDate(),
    body("notify_affected_users")
      .optional()
      .isBoolean()
      .withMessage("notify_affected_users must be a boolean")
      .toBoolean(),
    body("batch_reason")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("batch_reason must not exceed 1000 characters"),
  ],
];

const manageAccessRequests = [
  validateTenant,
  validateGroupIdParam,
  [
    query("action")
      .optional()
      .isIn(["list", "bulk_decision", "single_decision"])
      .withMessage(
        "action must be one of: list, bulk_decision, single_decision"
      ),
    query("status_filter")
      .optional()
      .isIn(["pending", "approved", "rejected", "expired", "all"])
      .withMessage(
        "status_filter must be one of: pending, approved, rejected, expired, all"
      ),
    query("date_from")
      .optional()
      .isISO8601()
      .withMessage("date_from must be a valid ISO8601 date")
      .toDate(),
    query("date_to")
      .optional()
      .isISO8601()
      .withMessage("date_to must be a valid ISO8601 date")
      .toDate(),
    body("request_ids")
      .if(query("action").isIn(["bulk_decision"]))
      .exists()
      .withMessage("request_ids are required for bulk decisions")
      .isArray({ min: 1, max: 50 })
      .withMessage("request_ids must be an array with 1-50 items"),
    body("request_ids.*")
      .if(query("action").isIn(["bulk_decision"]))
      .isMongoId()
      .withMessage("each request_id must be a valid ObjectId"),
    body("decision")
      .if(query("action").isIn(["bulk_decision", "single_decision"]))
      .exists()
      .withMessage("decision is required for decision actions")
      .isIn(["approved", "rejected"])
      .withMessage("decision must be either 'approved' or 'rejected'"),
    body("request_id")
      .if(query("action").equals("single_decision"))
      .exists()
      .withMessage("request_id is required for single_decision")
      .bail()
      .isMongoId()
      .withMessage("request_id must be a valid ObjectId"),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("reason must not exceed 500 characters"),
    body("default_role")
      .optional()
      .isMongoId()
      .withMessage("default_role must be a valid ObjectId if provided"),
    body("send_notifications")
      .optional()
      .isBoolean()
      .withMessage("send_notifications must be a boolean")
      .toBoolean(),
  ],
];

const assignMemberRole = [
  validateTenant,
  validateGroupIdParam,
  validateUserIdParam,
  [
    body("role_id")
      .exists()
      .withMessage("role_id is required")
      .isMongoId()
      .withMessage("role_id must be a valid ObjectId"),
    body("effective_date")
      .optional()
      .isISO8601()
      .withMessage("effective_date must be a valid ISO8601 date")
      .toDate(),
    body("expiry_date")
      .optional()
      .isISO8601()
      .withMessage("expiry_date must be a valid ISO8601 date")
      .toDate()
      .custom((value, { req }) => {
        if (
          value &&
          req.body.effective_date &&
          new Date(value) <= new Date(req.body.effective_date)
        ) {
          throw new Error("expiry_date must be after effective_date");
        }
        return true;
      }),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("reason must not exceed 500 characters"),
    body("notify_user")
      .optional()
      .isBoolean()
      .withMessage("notify_user must be a boolean")
      .toBoolean(),
    body("replace_existing_role")
      .optional()
      .isBoolean()
      .withMessage("replace_existing_role must be a boolean")
      .toBoolean(),
  ],
];

const sendGroupInvitations = [
  validateTenant,
  validateGroupIdParam,
  [
    body("invitations")
      .exists()
      .withMessage("invitations array is required")
      .isArray({ min: 1, max: 50 })
      .withMessage("invitations must be an array with 1-50 items"),
    body("invitations.*.email")
      .exists()
      .withMessage("email is required for each invitation")
      .isEmail()
      .withMessage("email must be a valid email address")
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage("email must not exceed 255 characters"),
    body("invitations.*.role_id")
      .optional()
      .isMongoId()
      .withMessage("role_id must be a valid ObjectId if provided"),
    body("invitations.*.message")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("message must not exceed 1000 characters"),
    body("invitations.*.permissions")
      .optional()
      .isArray()
      .withMessage("permissions must be an array if provided"),
    body("invitations.*.permissions.*")
      .optional()
      .isMongoId()
      .withMessage("each permission must be a valid ObjectId"),
    body("expiry_hours")
      .optional()
      .isInt({ min: 1, max: 8760 })
      .withMessage("expiry_hours must be between 1 and 8760 (1 year)")
      .toInt(),
    body("auto_approve")
      .optional()
      .isBoolean()
      .withMessage("auto_approve must be a boolean")
      .toBoolean(),
    body("send_welcome_email")
      .optional()
      .isBoolean()
      .withMessage("send_welcome_email must be a boolean")
      .toBoolean(),
    body("custom_message")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("custom_message must not exceed 2000 characters"),
    body("invitation_type")
      .optional()
      .isIn(["standard", "urgent", "reminder"])
      .withMessage(
        "invitation_type must be one of: standard, urgent, reminder"
      ),
  ],
];

const updateGroupStatus = [
  validateTenant,
  validateGroupIdParam,
  [
    body("status")
      .exists()
      .withMessage("status is required")
      .isIn(["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED", "MAINTENANCE"])
      .withMessage(
        "status must be one of: ACTIVE, INACTIVE, SUSPENDED, ARCHIVED, MAINTENANCE"
      ),
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("reason must not exceed 500 characters"),
    body("notify_members")
      .optional()
      .isBoolean()
      .withMessage("notify_members must be a boolean")
      .toBoolean(),
    body("notify_managers")
      .optional()
      .isBoolean()
      .withMessage("notify_managers must be a boolean")
      .toBoolean(),
    body("effective_date")
      .optional()
      .isISO8601()
      .withMessage("effective_date must be a valid ISO8601 date")
      .toDate(),
    body("auto_revert_date")
      .optional()
      .isISO8601()
      .withMessage("auto_revert_date must be a valid ISO8601 date")
      .toDate()
      .custom((value, { req }) => {
        if (
          value &&
          req.body.effective_date &&
          new Date(value) <= new Date(req.body.effective_date)
        ) {
          throw new Error("auto_revert_date must be after effective_date");
        }
        return true;
      }),
    body("schedule_maintenance")
      .optional()
      .isBoolean()
      .withMessage("schedule_maintenance must be a boolean")
      .toBoolean(),
    body("backup_before_change")
      .optional()
      .isBoolean()
      .withMessage("backup_before_change must be a boolean")
      .toBoolean(),
  ],
];

const getActivityLog = [
  validateTenant,
  validateGroupIdParam,
  [
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO8601 date")
      .toDate(),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO8601 date")
      .toDate()
      .custom((value, { req }) => {
        if (
          value &&
          req.query.start_date &&
          new Date(value) <= new Date(req.query.start_date)
        ) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
    query("activity_type")
      .optional()
      .isIn([
        "member_added",
        "member_removed",
        "role_assigned",
        "role_removed",
        "manager_changed",
        "settings_updated",
        "status_changed",
        "invitation_sent",
        "invitation_accepted",
        "invitation_declined",
        "bulk_operation",
        "export_generated",
        "all",
      ])
      .withMessage("activity_type must be a valid activity type"),
    query("actor_id")
      .optional()
      .isMongoId()
      .withMessage("actor_id must be a valid ObjectId if provided"),
    query("target_user_id")
      .optional()
      .isMongoId()
      .withMessage("target_user_id must be a valid ObjectId if provided"),
    query("severity")
      .optional()
      .isIn(["low", "medium", "high", "critical", "all"])
      .withMessage("severity must be one of: low, medium, high, critical, all"),
    query("include_details")
      .optional()
      .isBoolean()
      .withMessage("include_details must be a boolean")
      .toBoolean(),
    query("export_format")
      .optional()
      .isIn(["json", "csv"])
      .withMessage("export_format must be either 'json' or 'csv'"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("limit must be between 1 and 1000")
      .toInt(),
    query("skip")
      .optional()
      .isInt({ min: 0 })
      .withMessage("skip must be a non-negative integer")
      .toInt(),
  ],
];
const populateSlugs = [
  validateTenant,
  [
    query("dryRun")
      .optional()
      .isBoolean()
      .withMessage("dryRun must be a boolean value")
      .bail()
      .customSanitizer((value) => {
        return value === "true" || value === true;
      }),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("limit must be an integer between 1 and 1000")
      .bail(),
  ],
];

const searchGroupMembers = [
  validateTenant,
  validateGroupIdParam,
  [
    query("search")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("search query must be between 1 and 100 characters")
      .matches(/^[\p{L}\p{N}\s@._-]+$/u)
      .withMessage("search query contains invalid characters"),
    query("role_id")
      .optional()
      .isMongoId()
      .withMessage("role_id must be a valid ObjectId if provided"),
    query("role_name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("role_name must be between 1 and 100 characters"),
    query("status")
      .optional()
      .isIn(["active", "inactive", "pending", "suspended", "all"])
      .withMessage(
        "status must be one of: active, inactive, pending, suspended, all"
      ),
    query("member_type")
      .optional()
      .isIn(["user", "admin", "manager", "guest", "all"])
      .withMessage(
        "member_type must be one of: user, admin, manager, guest, all"
      ),
    query("joined_after")
      .optional()
      .isISO8601()
      .withMessage("joined_after must be a valid ISO8601 date")
      .toDate(),
    query("joined_before")
      .optional()
      .isISO8601()
      .withMessage("joined_before must be a valid ISO8601 date")
      .toDate(),
    query("last_login_after")
      .optional()
      .isISO8601()
      .withMessage("last_login_after must be a valid ISO8601 date")
      .toDate(),
    query("sort_by")
      .optional()
      .isIn(["name", "email", "joined_date", "last_login", "role", "status"])
      .withMessage(
        "sort_by must be one of: name, email, joined_date, last_login, role, status"
      ),
    query("sort_order")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("sort_order must be either 'asc' or 'desc'"),
    query("include_permissions")
      .optional()
      .isBoolean()
      .withMessage("include_permissions must be a boolean")
      .toBoolean(),
    query("include_activity_summary")
      .optional()
      .isBoolean()
      .withMessage("include_activity_summary must be a boolean")
      .toBoolean(),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage("limit must be between 1 and 500")
      .toInt(),
    query("skip")
      .optional()
      .isInt({ min: 0 })
      .withMessage("skip must be a non-negative integer")
      .toInt(),
  ],
];

const exportGroupData = [
  validateTenant,
  validateGroupIdParam,
  [
    query("format")
      .optional()
      .isIn(["json", "csv", "xlsx", "pdf"])
      .withMessage("format must be one of: json, csv, xlsx, pdf"),
    query("include_members")
      .optional()
      .isBoolean()
      .withMessage("include_members must be a boolean")
      .toBoolean(),
    query("include_roles")
      .optional()
      .isBoolean()
      .withMessage("include_roles must be a boolean")
      .toBoolean(),
    query("include_permissions")
      .optional()
      .isBoolean()
      .withMessage("include_permissions must be a boolean")
      .toBoolean(),
    query("include_activity")
      .optional()
      .isBoolean()
      .withMessage("include_activity must be a boolean")
      .toBoolean(),
    query("include_analytics")
      .optional()
      .isBoolean()
      .withMessage("include_analytics must be a boolean")
      .toBoolean(),
    query("include_settings")
      .optional()
      .isBoolean()
      .withMessage("include_settings must be a boolean")
      .toBoolean(),
    query("date_range")
      .optional()
      .isIn(["7d", "30d", "90d", "1y", "all"])
      .withMessage("date_range must be one of: 7d, 30d, 90d, 1y, all"),
    query("member_status_filter")
      .optional()
      .isIn(["active", "inactive", "all"])
      .withMessage(
        "member_status_filter must be one of: active, inactive, all"
      ),
    query("compression")
      .optional()
      .isIn(["none", "zip", "gzip"])
      .withMessage("compression must be one of: none, zip, gzip"),
    query("password_protect")
      .optional()
      .isBoolean()
      .withMessage("password_protect must be a boolean")
      .toBoolean(),
    query("encryption_level")
      .optional()
      .isIn(["basic", "standard", "high"])
      .withMessage("encryption_level must be one of: basic, standard, high"),
    query("delivery_method")
      .optional()
      .isIn(["download", "email", "cloud_storage"])
      .withMessage(
        "delivery_method must be one of: download, email, cloud_storage"
      ),
    query("email_recipient")
      .if(query("delivery_method").equals("email"))
      .exists()
      .withMessage("email_recipient is required when delivery_method is email")
      .isEmail()
      .withMessage("email_recipient must be a valid email address"),
  ],
];
const updateSlug = [
  validateTenant,
  validateGroupIdParam,
  [
    body().custom((value, { req }) => {
      if (!req.body.slug && !req.body.regenerate) {
        throw new Error("Either slug or regenerate flag must be provided");
      }
      return true;
    }),
    body("slug")
      .optional()
      .notEmpty()
      .withMessage("slug should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase alphanumeric with hyphens only")
      .bail()
      .isLength({ min: 2, max: 100 })
      .withMessage("Slug must be between 2 and 100 characters"),
    body("regenerate")
      .optional()
      .isBoolean()
      .withMessage("regenerate must be a boolean value")
      .bail()
      .customSanitizer((value) => {
        return value === "true" || value === true;
      }),
  ],
];

const assignCohortsToGroup = [
  validateTenant,
  validateGroupIdParam,
  [
    body("cohort_ids")
      .exists()
      .withMessage("cohort_ids are required")
      .bail()
      .isArray({ min: 1 })
      .withMessage("cohort_ids must be a non-empty array"),
    body("cohort_ids.*")
      .isMongoId()
      .withMessage("Each cohort_id must be a valid ObjectId"),
  ],
];

const unassignCohortsFromGroup = [
  validateTenant,
  validateGroupIdParam,
  [
    body("cohort_ids")
      .exists()
      .withMessage("cohort_ids are required")
      .bail()
      .isArray({ min: 1 })
      .withMessage("cohort_ids must be a non-empty array"),
    body("cohort_ids.*")
      .isMongoId()
      .withMessage("Each cohort_id must be a valid ObjectId"),
  ],
];

const listGroupCohorts = [validateTenant, validateGroupIdParam];

module.exports = {
  tenant: validateTenant,
  pagination,
  deleteGroup,
  update,
  list,
  create,
  removeUniqueConstraint,
  assignOneUser,
  listSummary,
  setManager,
  listAssignedUsers,
  listAllGroupUsers,
  listAvailableUsers,
  assignUsers,
  unAssignUser,
  unAssignManyUsers,
  listRolesForGroup,
  getGroupById,
  enhancedSetManager,
  getGroupAnalytics,
  bulkMemberManagement,
  manageAccessRequests,
  assignMemberRole,
  sendGroupInvitations,
  updateGroupStatus,
  getActivityLog,
  searchGroupMembers,
  exportGroupData,
  populateSlugs,
  updateSlug,
  assignCohortsToGroup,
  unassignCohortsFromGroup,
  listGroupCohorts,
};
