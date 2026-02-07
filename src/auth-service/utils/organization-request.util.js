// utils/organization-request.util.js
const OrganizationRequestModel = require("@models/OrganizationRequest");
const GroupModel = require("@models/Group");
const UserModel = require("@models/User");
const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- organization-request-util`,
);
const createGroupUtil = require("@utils/group.util");
const { mailer, slugUtils } = require("@utils/common");
const { sanitizeEmailString } = require("@utils/shared");
const isEmpty = require("is-empty");
const accessCodeGenerator = require("generate-password");
const jwt = require("jsonwebtoken");
const validator = require("validator");

// Add this helper function at the top level
const validateAndSanitizeProfilePicture = (url) => {
  // If no URL provided, return null
  if (!url || typeof url !== "string" || url.trim() === "") {
    return null;
  }

  const trimmedUrl = url.trim();

  // Check if URL is valid
  if (
    !validator.isURL(trimmedUrl, {
      protocols: ["http", "https"],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: true,
    })
  ) {
    logger.warn(`Invalid profile picture URL provided: ${trimmedUrl}`);
    return null;
  }

  // Check length constraint (200 characters max)
  if (trimmedUrl.length > 200) {
    logger.warn(
      `Profile picture URL too long (${
        trimmedUrl.length
      } chars): ${trimmedUrl.substring(0, 50)}...`,
    );
    return null;
  }

  return trimmedUrl;
};

const organizationRequest = {
  createOrganizationRequest: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;

      // Check if user already has access to this organization (if user is authenticated)
      if (user && user._id) {
        const userAccess =
          await organizationRequest.checkUserOrganizationAccess(request, next);

        if (userAccess && userAccess.hasAccess) {
          return {
            success: false,
            message: "You already have access to this organization",
            data: {
              existingGroup: userAccess.group,
              suggestedAction:
                "Please use your existing access or contact support for assistance.",
            },
            status: httpStatus.CONFLICT,
          };
        }
      }

      // Sanitize input values - using safe string handling
      if (body.organization_name) {
        body.organization_name = sanitizeEmailString(body.organization_name);
      }
      if (body.contact_name) {
        body.contact_name = sanitizeEmailString(body.contact_name);
      }

      // Store original slug for reference
      const originalSlug = body.organization_slug;

      // Define maximum slug length to prevent excessively long slugs
      const MAX_SLUG_LENGTH = 50;
      const MAX_RETRIES = 5;
      let currentTry = 0;
      let success = false;
      let responseFromCreateRequest;
      let generatedSlug = originalSlug;

      while (!success && currentTry < MAX_RETRIES) {
        // Generate a unique slug based on retry count
        if (currentTry === 0) {
          generatedSlug = originalSlug;
        } else if (currentTry === 1) {
          // For first retry, use timestamp (predictable length)
          const timestamp = Date.now().toString().slice(-6);
          // Ensure we don't exceed maximum slug length
          const baseSlug =
            originalSlug.length > MAX_SLUG_LENGTH - 7
              ? originalSlug.slice(0, MAX_SLUG_LENGTH - 7)
              : originalSlug;
          generatedSlug = `${baseSlug}-${timestamp}`;
        } else {
          // For subsequent retries, use random string (always 5 chars)
          const randomSuffix = Math.random().toString(36).substring(2, 7);
          // Ensure we don't exceed maximum slug length
          const baseSlug =
            originalSlug.length > MAX_SLUG_LENGTH - 7
              ? originalSlug.slice(0, MAX_SLUG_LENGTH - 7)
              : originalSlug;
          generatedSlug = `${baseSlug}-${randomSuffix}`;
        }

        // Check if the slug already exists in both collections
        const [existingGroup, existingRequest] = await Promise.all([
          GroupModel(tenant)
            .findOne({ organization_slug: generatedSlug })
            .lean(),
          OrganizationRequestModel(tenant)
            .findOne({ organization_slug: generatedSlug })
            .lean(),
        ]);

        if (existingGroup || existingRequest) {
          // Slug already exists, try again with a different one
          currentTry++;
          logger.warn(
            `Slug '${generatedSlug}' already exists, retrying (${currentTry}/${MAX_RETRIES})`,
          );
          continue;
        }

        // If we get here, the slug is available
        body.organization_slug = generatedSlug;

        // Now try to register with the available slug
        try {
          responseFromCreateRequest = await OrganizationRequestModel(
            tenant,
          ).register(body, next);
          success = true;
        } catch (registrationError) {
          // Enhanced error detection for MongoDB errors
          if (
            (registrationError.code === 11000 ||
              registrationError.name === "MongoServerError") &&
            registrationError.keyPattern &&
            registrationError.keyPattern.organization_slug
          ) {
            currentTry++;
            logger.warn(
              `Race condition detected with slug '${generatedSlug}', retrying (${currentTry}/${MAX_RETRIES})`,
            );
          } else {
            // For other errors, just throw them to be caught by the outer catch
            throw registrationError;
          }
        }
      }

      if (!success) {
        return {
          success: false,
          message:
            "Failed to create organization request after multiple retries due to slug collisions",
          status: httpStatus.CONFLICT,
        };
      }

      // Handle slug modification message
      const wasSlugModified = originalSlug !== generatedSlug;
      if (
        wasSlugModified &&
        responseFromCreateRequest &&
        responseFromCreateRequest.success
      ) {
        responseFromCreateRequest.message = `Organization request created successfully. Note: Your slug was modified to '${generatedSlug}' because the original was already taken.`;
      }

      // Send notifications if the request was successful
      if (
        responseFromCreateRequest &&
        responseFromCreateRequest.success === true
      ) {
        try {
          // Run email notifications in parallel for better performance
          await Promise.all([
            // Send notification to AirQo Admins
            mailer.notifyAdminsOfNewOrgRequest({
              organization_name: body.organization_name,
              contact_name: body.contact_name,
              contact_email: body.contact_email, // Pass contact_email correctly
              tenant,
            }),

            // Send confirmation to requestor
            mailer.confirmOrgRequestReceived({
              organization_name: body.organization_name,
              contact_name: body.contact_name,
              email: body.contact_email,
            }),
          ]);
        } catch (emailError) {
          // Log email sending errors but don't fail the request
          logger.error(`Error sending emails: ${emailError.message}`);
          responseFromCreateRequest.emailSendingIssue = true;
        }
      }

      return responseFromCreateRequest;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  checkUserOrganizationAccess: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;
      const { organization_slug } = body;

      // If user isn't authenticated, no need to check
      if (!user || !user._id) {
        return { hasAccess: false };
      }

      // Check if organization exists and user is a member in a single query
      const existingGroup = await GroupModel(tenant)
        .findOne(
          {
            organization_slug,
            "users.user_id": user._id,
          },
          { _id: 1, grp_title: 1 },
        )
        .lean();

      // Determine if user has access based on query result
      const hasAccess = !!existingGroup;

      // If user has access, get the full group details for the response
      let groupDetails = null;
      if (hasAccess) {
        groupDetails = existingGroup;
      } else {
        // Only check if the group exists if the user doesn't have access
        groupDetails = await GroupModel(tenant)
          .findOne({ organization_slug }, { _id: 1, grp_title: 1 })
          .lean();
      }

      return {
        hasAccess,
        group: groupDetails,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  listOrganizationRequests: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip, status } = query;

      const filter = {};
      if (status) {
        filter.status = status;
      }

      const responseFromListRequests = await OrganizationRequestModel(
        tenant,
      ).list({ filter, limit, skip }, next);

      return responseFromListRequests;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  approveOrganizationRequest: async (request, next) => {
    try {
      const { params, query, user, body } = request;
      const { request_id } = params;
      const { tenant } = query;

      // Optional: Check for onboarding preference in request body or config
      const useOnboardingFlow =
        body?.useOnboardingFlow ||
        constants.DEFAULT_USE_ONBOARDING_FLOW ||
        false;

      const orgRequest =
        await OrganizationRequestModel(tenant).findById(request_id);

      if (!orgRequest) {
        return {
          success: false,
          message: "Organization request not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      if (orgRequest.status !== "pending") {
        return {
          success: false,
          message: "Request has already been processed",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // ENSURE ORGANIZATION SLUG EXISTS - Generate if missing
      let organizationSlug = orgRequest.organization_slug;
      let slugWasGenerated = false;

      if (!organizationSlug || organizationSlug.trim() === "") {
        // Generate slug from organization name
        if (!orgRequest.organization_name) {
          return {
            success: false,
            message:
              "Cannot approve request: Organization name is required for slug generation",
            status: httpStatus.BAD_REQUEST,
          };
        }

        try {
          // Import group util for slug generation
          const groupUtil = require("@utils/group.util");
          const baseSlug = groupUtil.generateSlugFromTitle(
            orgRequest.organization_name,
          );
          organizationSlug = await groupUtil.generateUniqueSlug(
            tenant,
            baseSlug,
          );
          slugWasGenerated = true;

          // Update the organization request with the generated slug
          await OrganizationRequestModel(tenant).findByIdAndUpdate(request_id, {
            organization_slug: organizationSlug,
          });

          logger.info(
            `Generated organization slug: ${organizationSlug} for request ${request_id}`,
          );
        } catch (slugError) {
          logger.error(
            `Error generating organization slug: ${slugError.message}`,
          );
          return {
            success: false,
            message: "Failed to generate organization slug",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { slug_generation: slugError.message },
          };
        }
      }

      // ✅ CHECK IF USER ALREADY EXISTS
      const existingUser = await UserModel(tenant)
        .findOne({
          email: orgRequest.contact_email,
        })
        .lean();

      let userResponse;
      let onboardingToken = null;
      let isExistingUser = !!existingUser;

      if (existingUser) {
        // ===== USER ALREADY EXISTS =====
        logText(`User with email ${orgRequest.contact_email} already exists`);

        // Check if user is already active or if we need to update them
        if (
          useOnboardingFlow &&
          (!existingUser.verified || !existingUser.isActive)
        ) {
          // Generate onboarding token for existing unverified users
          onboardingToken = jwt.sign(
            {
              email: orgRequest.contact_email,
              organization_name: orgRequest.organization_name,
              organization_slug: organizationSlug, // Use the ensured slug
              contact_name: orgRequest.contact_name,
              request_id: orgRequest._id,
              tenant: tenant,
              purpose: "organization_onboarding",
              exp: constants.ONBOARDING_TOKEN_EXPIRY_DAYS,
            },
            constants.JWT_SECRET,
          );
        }

        // Use existing user data structure
        userResponse = {
          success: true,
          data: existingUser,
          message: "Using existing user account",
        };
      } else {
        // ===== CREATE NEW USER =====
        if (useOnboardingFlow) {
          // ===== ENHANCED ONBOARDING FLOW =====

          // Generate a secure onboarding token
          onboardingToken = jwt.sign(
            {
              email: orgRequest.contact_email,
              organization_name: orgRequest.organization_name,
              organization_slug: organizationSlug, // Use the ensured slug
              contact_name: orgRequest.contact_name,
              request_id: orgRequest._id,
              tenant: tenant,
              purpose: "organization_onboarding",
              exp: constants.ONBOARDING_TOKEN_EXPIRY_DAYS,
            },
            constants.JWT_SECRET,
          );

          // Parse and sanitize contact name
          const sanitizedName = (orgRequest.contact_name || "").trim();
          const nameParts = sanitizedName.split(/\s+/).filter(Boolean);

          // Create user without password (will be set during onboarding)
          const userBody = {
            firstName: nameParts[0] || "User",
            lastName: nameParts.slice(1).join(" ") || nameParts[0] || "User",
            email: orgRequest.contact_email,
            organization: orgRequest.organization_name,
            // Generate a temporary password that will be replaced during onboarding
            password: accessCodeGenerator.generate(
              constants.RANDOM_PASSWORD_CONFIGURATION(32),
            ),
            verified: false, // User needs to complete onboarding
            isActive: false, // Activate after onboarding completion
            tenant,
          };

          userResponse = await UserModel(tenant).register(userBody, next);
        } else {
          // ===== ORIGINAL FLOW WITH GENERATED PASSWORD =====

          // Generate a random password for the new user
          const generatedPassword = accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(
              constants.TOKEN_LENGTH || 12,
            ),
          );

          // Parse and sanitize contact name
          const sanitizedName = (orgRequest.contact_name || "").trim();
          const nameParts = sanitizedName.split(/\s+/).filter(Boolean);
          // Create the initial admin user
          const userBody = {
            firstName: nameParts[0] || "User",
            lastName: nameParts.slice(1).join(" ") || nameParts[0] || "User",
            email: orgRequest.contact_email,
            organization: orgRequest.organization_name,
            password: generatedPassword, // ✅ Generated password
            verified: true, // Auto-verify for generated password flow
            isActive: true, // Auto-activate for generated password flow
            tenant,
          };

          userResponse = await UserModel(tenant).register(userBody, next);
        }
      }

      if (userResponse.success === true) {
        const validatedProfilePicture = validateAndSanitizeProfilePicture(
          orgRequest.branding_settings?.logo_url,
        );

        // Create the group with validated profile picture and ensured slug
        const baseGroupBody = {
          grp_title: orgRequest.organization_name,
          grp_description: orgRequest.use_case,
          organization_slug: organizationSlug, // Use the ensured slug
        };

        // Only add profile picture if it's valid
        if (validatedProfilePicture) {
          baseGroupBody.grp_profile_picture = validatedProfilePicture;
        }

        // ✅ SIMPLIFIED GROUP CREATION WITH DIRECT ERROR HANDLING
        // Check if group already exists by slug
        const existingGroupBySlug = await GroupModel(tenant)
          .findOne({ organization_slug: organizationSlug })
          .lean();

        let groupResponse;

        if (existingGroupBySlug) {
          // Group exists, add user if not already a member
          const isUserInGroup =
            existingGroupBySlug.users &&
            existingGroupBySlug.users.some(
              (u) => u.user_id.toString() === userResponse.data._id.toString(),
            );

          if (!isUserInGroup) {
            const updateResult = await GroupModel(tenant).findByIdAndUpdate(
              existingGroupBySlug._id,
              {
                $addToSet: {
                  users: {
                    user_id: userResponse.data._id,
                    user_role: "admin",
                  },
                },
              },
              { new: true },
            );

            groupResponse = {
              success: true,
              data: updateResult,
              message: "User added to existing group",
            };
          } else {
            groupResponse = {
              success: true,
              data: existingGroupBySlug,
              message: "User already in group",
            };
          }
        } else {
          // Create new group with error handling for duplicate titles
          let createAttempts = 0;
          const maxAttempts = 10;
          let groupCreated = false;
          let currentGroupTitle = orgRequest.organization_name;

          while (!groupCreated && createAttempts < maxAttempts) {
            createAttempts++;

            // Generate unique title for each attempt after the first
            if (createAttempts > 1) {
              const suffix =
                createAttempts === 2
                  ? Date.now().toString().slice(-6)
                  : Math.random().toString(36).substring(2, 8);
              currentGroupTitle = `${orgRequest.organization_name}_${suffix}`;
            }

            const currentGroupBody = {
              ...baseGroupBody,
              grp_title: currentGroupTitle,
            };

            try {
              logger.info(
                `🔧 Attempt ${createAttempts}: Creating group with title: "${currentGroupTitle}" and slug: "${organizationSlug}"`,
              );

              const createGroupRequest = {
                body: { ...currentGroupBody, user_id: userResponse.data._id },
                query: { tenant },
                user: null,
              };

              groupResponse = await createGroupUtil.create(
                createGroupRequest,
                next,
              );

              if (groupResponse && groupResponse.success) {
                groupCreated = true;
                logger.info(
                  `✅ Successfully created group with title: "${currentGroupTitle}" and slug: "${organizationSlug}"`,
                );

                // Add metadata if title was modified
                if (currentGroupTitle !== orgRequest.organization_name) {
                  groupResponse.titleModified = true;
                  groupResponse.originalTitle = orgRequest.organization_name;
                  groupResponse.finalTitle = currentGroupTitle;
                }
              } else {
                logger.warn(
                  `❌ Group creation failed (attempt ${createAttempts}): ${groupResponse?.message}`,
                );
                if (createAttempts >= maxAttempts) {
                  throw new Error(
                    groupResponse?.message || "Group creation failed",
                  );
                }
              }
            } catch (error) {
              logger.warn(
                `❌ Group creation error (attempt ${createAttempts}): ${error.message}`,
              );

              // If it's a validation error for duplicate title, try again
              if (
                error.name === "ValidationError" &&
                error.errors?.grp_title?.kind === "unique"
              ) {
                logger.info(
                  `🔄 Duplicate title detected, retrying with different name...`,
                );
                if (createAttempts >= maxAttempts) {
                  throw new Error(
                    `Failed to create unique group title after ${maxAttempts} attempts`,
                  );
                }
              } else {
                // Different error, throw immediately
                throw error;
              }
            }
          }

          if (!groupCreated) {
            return {
              success: false,
              message: `Failed to create group after ${maxAttempts} attempts`,
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: {
                group_creation: "Multiple creation attempts failed",
              },
            };
          }
        }

        if (groupResponse.success === true) {
          // Update the organization request
          const update = {
            status: "approved",
            approved_by: user._id,
            approved_at: new Date(),
            onboarding_token: onboardingToken, // Store token if using onboarding flow
            organization_slug: organizationSlug, // Ensure slug is stored
          };

          const responseFromUpdate = await OrganizationRequestModel(
            tenant,
          ).modify({ filter: { _id: request_id }, update }, next);

          if (responseFromUpdate.success === true) {
            // Send appropriate approval email based on flow and user status
            if (useOnboardingFlow && (!isExistingUser || onboardingToken)) {
              // Send onboarding email with secure setup link
              await mailer.notifyOrgRequestApprovedWithOnboarding({
                organization_name: orgRequest.organization_name,
                contact_name: orgRequest.contact_name,
                email: orgRequest.contact_email,
                onboarding_url: `${constants.ANALYTICS_BASE_URL}/onboarding/setup-account?token=${onboardingToken}`,
                organization_slug: organizationSlug, // Use ensured slug
                isExistingUser,
              });
            } else {
              // Send traditional approval email
              await mailer.notifyOrgRequestApproved({
                organization_name: orgRequest.organization_name,
                contact_name: orgRequest.contact_name,
                email: orgRequest.contact_email,
                login_url: `${constants.ANALYTICS_BASE_URL}/org/${organizationSlug}/login`,
                isExistingUser,
              });
            }

            return {
              success: true,
              message: `Organization request approved successfully${
                useOnboardingFlow ? " with onboarding flow" : ""
              }${isExistingUser ? " (existing user)" : " (new user)"}${
                !validatedProfilePicture &&
                orgRequest.branding_settings?.logo_url
                  ? " (invalid profile picture URL was skipped)"
                  : ""
              }${
                groupResponse.titleModified
                  ? ` (group title modified from '${groupResponse.originalTitle}' to '${groupResponse.finalTitle}')`
                  : ""
              }${
                slugWasGenerated
                  ? ` (organization slug auto-generated: '${organizationSlug}')`
                  : ""
              }`,
              data: {
                request: responseFromUpdate.data,
                group: groupResponse.data,
                user: userResponse.data,
                onboardingFlow: useOnboardingFlow,
                isExistingUser,
                profilePictureSkipped:
                  !validatedProfilePicture &&
                  orgRequest.branding_settings?.logo_url,
                groupTitleModified: groupResponse.titleModified || false,
                organizationSlugGenerated: slugWasGenerated,
                organizationSlug: organizationSlug,
                ...(groupResponse.titleModified && {
                  originalGroupTitle: groupResponse.originalTitle,
                  finalGroupTitle: groupResponse.finalTitle,
                }),
                ...(useOnboardingFlow &&
                  onboardingToken && { onboardingToken: onboardingToken }),
              },
              status: httpStatus.OK,
            };
          }
        } else {
          return {
            success: false,
            message: "Failed to create or update group",
            errors: groupResponse.errors,
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
      } else {
        return {
          success: false,
          message: "Failed to create user",
          errors: userResponse.errors,
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Approval error: ${error.message}`);
      logger.error(`🐛🐛 Error stack: ${error.stack}`);

      // Enhanced error handling
      if (error.name === "ValidationError") {
        const validationErrors = {};
        for (const field in error.errors) {
          validationErrors[field] = error.errors[field].message;
        }

        logger.warn(
          `Validation error during approval: ${JSON.stringify(
            validationErrors,
          )}`,
        );
        return {
          success: false,
          message: "Validation failed during organization approval",
          status: httpStatus.BAD_REQUEST,
          errors: validationErrors,
        };
      }

      if (error.code === 11000) {
        if (error.keyPattern && error.keyPattern.userName) {
          logger.warn(
            `Duplicate user error for email: ${error.keyValue.userName}`,
          );
          return {
            success: false,
            message:
              "A user with this email already exists. Please use the existing account or contact support.",
            status: httpStatus.CONFLICT,
            errors: {
              email: "User already exists",
              suggestion:
                "Try logging in with existing credentials or contact support",
            },
          };
        } else if (error.keyPattern && error.keyPattern.grp_title) {
          logger.warn(
            `Duplicate group title error: ${error.keyValue.grp_title}`,
          );
          return {
            success: false,
            message: "A group with this name already exists. Please try again.",
            status: httpStatus.CONFLICT,
            errors: {
              group_title: "Group name already exists",
              suggestion: "Please try approving the request again",
            },
          };
        } else if (error.keyPattern && error.keyPattern.organization_slug) {
          logger.warn(
            `Duplicate organization slug error: ${error.keyValue.organization_slug}`,
          );
          return {
            success: false,
            message: "Organization slug conflict occurred. Please try again.",
            status: httpStatus.CONFLICT,
            errors: {
              organization_slug: "Slug already exists",
              suggestion: "Please try approving the request again",
            },
          };
        }
      }

      return {
        success: false,
        message: "Internal server error during organization approval",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  rejectOrganizationRequest: async (request, next) => {
    try {
      const { params, query, body, user } = request;
      const { request_id } = params;
      const { tenant } = query;
      const { rejection_reason } = body;

      const orgRequest =
        await OrganizationRequestModel(tenant).findById(request_id);

      if (!orgRequest) {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Organization request not found",
          }),
        );
      }

      if (orgRequest.status !== "pending") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Request has already been processed",
          }),
        );
      }

      const update = {
        status: "rejected",
        rejection_reason,
        rejected_by: user._id,
        rejected_at: new Date(),
      };

      const responseFromUpdate = await OrganizationRequestModel(tenant).modify(
        { filter: { _id: request_id }, update },
        next,
      );

      if (responseFromUpdate.success === true) {
        // Send rejection email
        await mailer.notifyOrgRequestRejected({
          organization_name: orgRequest.organization_name,
          contact_name: orgRequest.contact_name,
          email: orgRequest.contact_email,
          rejection_reason,
        });

        return responseFromUpdate;
      }
      return {
        success: false,
        message: "Failed to reject organization request",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  getOrganizationRequestById: async (request, next) => {
    try {
      const { params, query } = request;
      const { request_id } = params;
      const { tenant } = query;

      const filter = { _id: request_id };
      const responseFromListRequests = await OrganizationRequestModel(
        tenant,
      ).list({ filter, limit: 1, skip: 0 }, next);

      if (
        responseFromListRequests.success === true &&
        responseFromListRequests.data.length > 0
      ) {
        return {
          success: true,
          message: "Successfully retrieved organization request",
          data: responseFromListRequests.data[0],
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Organization request not found",
          }),
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  checkSlugAvailability: async (request, next) => {
    try {
      const { params, query } = request;
      const { slug } = params;
      const { tenant } = query;

      // Check if slug exists in Groups collection
      const existingGroup = await GroupModel(tenant).findOne({
        organization_slug: slug,
      });

      // Check if slug exists in OrganizationRequest collection
      const existingRequest = await OrganizationRequestModel(tenant).findOne({
        organization_slug: slug,
      });

      const isAvailable = !existingGroup && !existingRequest;

      // If slug is taken, generate alternative suggestions
      let alternativeSuggestions = [];
      if (!isAvailable) {
        // Generate 3 alternative suggestions
        for (let i = 1; i <= 3; i++) {
          const suggestion = `${slug}-${i}`;
          const suggestionExists =
            (await GroupModel(tenant).findOne({
              organization_slug: suggestion,
            })) ||
            (await OrganizationRequestModel(tenant).findOne({
              organization_slug: suggestion,
            }));

          if (!suggestionExists) {
            alternativeSuggestions.push(suggestion);
          }
        }

        // If we didn't get enough suggestions, add some with timestamp
        if (alternativeSuggestions.length < 3) {
          const timestamp = Math.floor(Date.now() / 1000)
            .toString()
            .substr(-4);
          alternativeSuggestions.push(`${slug}-${timestamp}`);
        }
      }

      return {
        success: true,
        message: isAvailable ? "Slug is available" : "Slug is already taken",
        data: {
          available: isAvailable,
          slug,
          existsInGroups: !!existingGroup,
          existsInRequests: !!existingRequest,
          alternativeSuggestions: isAvailable ? [] : alternativeSuggestions,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  completeOnboarding: async (request, next) => {
    try {
      const { body } = request;
      const { token, password } = body;

      // Verify the onboarding token
      const decoded = jwt.verify(token, constants.JWT_SECRET);

      if (decoded.purpose !== "organization_onboarding") {
        throw new Error("Invalid onboarding token");
      }

      const { contact_email, tenant, request_id } = decoded;

      // Update user password and activate account
      const userUpdateResult = await UserModel(tenant).modify(
        {
          filter: { email: contact_email },
          update: {
            password: password, // Will be hashed by UserModel.modify before saving
            verified: true,
            isActive: true,
          },
        },
        next,
      );

      if (userUpdateResult.success) {
        // Mark onboarding as completed
        await OrganizationRequestModel(tenant).modify(
          {
            filter: { _id: request_id },
            update: {
              onboarding_completed: true,
              onboarding_completed_at: new Date(),
            },
          },
          next,
        );

        // Send completion email
        await mailer.onboardingCompleted({
          organization_name: decoded.organization_name,
          contact_name: decoded.contact_name,
          email: decoded.contact_email,
          login_url: `${constants.ANALYTICS_BASE_URL}/org/${decoded.organization_slug}/login`,
        });

        return {
          success: true,
          message: "Onboarding completed successfully",
          data: { email: contact_email },
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Onboarding completion error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
};

module.exports = organizationRequest;
