const transporter = require("@config/mailer.config");
const isEmpty = require("is-empty");
const SubscriptionModel = require("@models/Subscription");
const constants = require("@config/constants");
const msgs = require("./email.msgs.util");
const msgTemplates = require("./email.templates.util");
const httpStatus = require("http-status");
const path = require("path");
const {
  sendMailWithDeduplication,
  emailDeduplicator,
} = require("./email-deduplication.util");
const { logObject, HttpError, sanitizeEmailString } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- mailer-util`);
const processString = (inputString) => {
  const stringWithSpaces = inputString.replace(/[^a-zA-Z0-9]+/g, " ");
  const uppercasedString = stringWithSpaces.toUpperCase();
  return uppercasedString;
};
const projectRoot = path.join(__dirname, "..", "..");
const imagePath = path.join(projectRoot, "config", "images");

let attachments = [
  {
    filename: "airqoLogo.png",
    path: path.join(imagePath, "airqoLogo.png"),
    cid: "AirQoEmailLogo",
    contentDisposition: "inline",
  },
  {
    filename: "faceBookLogo.png",
    path: imagePath + "/facebookLogo.png",
    cid: "FacebookLogo",
    contentDisposition: "inline",
  },
  {
    filename: "youtubeLogo.png",
    path: imagePath + "/youtubeLogo.png",
    cid: "YoutubeLogo",
    contentDisposition: "inline",
  },
  {
    filename: "twitterLogo.png",
    path: imagePath + "/Twitter.png",
    cid: "Twitter",
    contentDisposition: "inline",
  },
  {
    filename: "linkedInLogo.png",
    path: imagePath + "/linkedInLogo.png",
    cid: "LinkedInLogo",
    contentDisposition: "inline",
  },
];

const mailer = {
  notifyAdminsOfNewOrgRequest: async (
    { organization_name, contact_name, contact_email, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!organization_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Organization name is required for admin notification",
          missing: ["organization_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "Organization name is required for admin notification",
              missing: ["organization_name"],
            },
          };
        }
      }

      if (!contact_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Contact name is required for admin notification",
          missing: ["contact_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "Contact name is required for admin notification",
              missing: ["contact_name"],
            },
          };
        }
      }

      if (!contact_email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Contact email is required for admin notification",
          missing: ["contact_email"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "Contact email is required for admin notification",
              missing: ["contact_email"],
            },
          };
        }
      }

      // ✅ STEP 2: Process admin emails with subscription validation (parallel processing)
      let adminEmails = constants.REQUEST_ACCESS_EMAILS
        ? constants.REQUEST_ACCESS_EMAILS.split(",")
        : ["support@airqo.net"];

      // Clean and validate admin emails
      adminEmails = adminEmails.map((email) => email.trim()).filter(Boolean);

      // Check subscription status for all admin emails concurrently
      const subscribedEmails = [];

      if (adminEmails.length > 0) {
        const adminCheckPromises = adminEmails.map(async (adminEmail) => {
          try {
            const checkResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: adminEmail,
              type: "email",
            });

            return checkResult.success ? adminEmail : null;
          } catch (error) {
            logger.error(
              `Admin subscription check failed for ${adminEmail}: ${error.message}`,
              {
                operation: "notifyAdminsOfNewOrgRequest",
                organization_name,
                contact_email,
              }
            );
            return null;
          }
        });

        const adminResults = await Promise.all(adminCheckPromises);
        subscribedEmails.push(
          ...adminResults.filter((email) => email !== null)
        );
      }

      // ✅ STEP 3: Determine recipients with fallback
      const subscribedBccEmails = subscribedEmails.join(",");
      const primaryRecipient =
        subscribedEmails.length > 0 ? subscribedEmails[0] : "support@airqo.net";

      // ✅ STEP 4: Prepare mail options
      const sanitizedOrgName = sanitizeEmailString(organization_name);

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: primaryRecipient,
        subject: `New Organization Request: ${sanitizedOrgName}`,
        html: msgs.notifyAdminsOfNewOrgRequest({
          organization_name,
          contact_name,
          contact_email,
        }),
        bcc: subscribedBccEmails || undefined,
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for admin notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate admin notification detected
          return {
            success: true,
            message:
              "Admin notification for organization request already sent recently - duplicate prevented",
            data: {
              organization_name,
              contact_name,
              contact_email,
              primaryRecipient,
              adminNotification: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Admin notification sending failed";
          logger.error(
            `Admin notification email failed for organization ${organization_name}: ${errorMessage}`,
            {
              organization_name,
              contact_name,
              contact_email,
              primaryRecipient,
              adminEmailCount: subscribedEmails.length,
              tenant,
              error: errorMessage,
            }
          );

          const error = new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Unable to send admin notification at this time",
              operation: "notifyAdminsOfNewOrgRequest",
              emailResults: emailResult,
            }
          );

          if (next) {
            next(error);
            return;
          } else {
            return {
              success: false,
              message: "Email notification to admins failed",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: {
                message: "Unable to send admin notification at this time",
                operation: "notifyAdminsOfNewOrgRequest",
              },
            };
          }
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Admin notification email sent successfully",
          data: {
            organization_name,
            contact_name,
            contact_email,
            primaryRecipient,
            messageId: emailData.messageId,
            emailResults: emailData,
            adminEmailCount: subscribedEmails.length,
            totalNotified: subscribedEmails.length,
            adminNotification: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Admin notification email partially failed for organization ${organization_name}:`,
          {
            organization_name,
            contact_name,
            contact_email,
            primaryRecipient,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            adminEmailCount: subscribedEmails.length,
            tenant,
          }
        );

        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "Admin notification delivery failed or partially rejected",
            operation: "notifyAdminsOfNewOrgRequest",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          }
        );

        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Email notification to admins failed",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Admin notification delivery failed or partially rejected",
              operation: "notifyAdminsOfNewOrgRequest",
            },
          };
        }
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Admin notification error for organization ${organization_name}: ${error.message}`,
        {
          stack: error.stack,
          organization_name,
          contact_name,
          contact_email,
          tenant,
          operation: "notifyAdminsOfNewOrgRequest",
        }
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "An unexpected error occurred while processing admin notification",
          operation: "notifyAdminsOfNewOrgRequest",
          organization_name,
        }
      );

      if (next) {
        next(httpError);
        return;
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "An unexpected error occurred while processing admin notification",
            operation: "notifyAdminsOfNewOrgRequest",
          },
        };
      }
    }
  },
  confirmOrgRequestReceived: async (
    { organization_name, contact_name, contact_email, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!contact_email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Contact email is required for organization request confirmation",
          missing: ["contact_email"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Contact email is required for organization request confirmation",
              missing: ["contact_email"],
            },
          };
        }
      }

      if (!organization_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Organization name is required for organization request confirmation",
          missing: ["organization_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Organization name is required for organization request confirmation",
              missing: ["organization_name"],
            },
          };
        }
      }

      if (!contact_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Contact name is required for organization request confirmation",
          missing: ["contact_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Contact name is required for organization request confirmation",
              missing: ["contact_name"],
            },
          };
        }
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email: contact_email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const sanitizedOrgName = sanitizeEmailString(organization_name);

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: contact_email,
        subject: `Your Organization Request: ${sanitizedOrgName}`,
        html: msgs.confirmOrgRequestReceived({
          organization_name,
          contact_name,
          contact_email,
        }),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for confirmation notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate organization confirmation notification detected
          return {
            success: true,
            message:
              "Organization request confirmation already sent recently - duplicate prevented",
            data: {
              contact_email,
              organization_name,
              contact_name,
              organizationConfirmation: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Organization request confirmation sending failed";
          logger.error(
            `Organization confirmation email failed for ${contact_email}: ${errorMessage}`,
            {
              contact_email,
              organization_name,
              contact_name,
              tenant,
              error: errorMessage,
            }
          );

          const error = new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Unable to send organization request confirmation at this time",
              operation: "confirmOrgRequestReceived",
              emailResults: emailResult,
            }
          );

          if (next) {
            next(error);
            return;
          } else {
            return {
              success: false,
              message: "Organization request confirmation failed",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: {
                message:
                  "Unable to send organization request confirmation at this time",
                operation: "confirmOrgRequestReceived",
              },
            };
          }
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Organization request confirmation sent successfully",
          data: {
            contact_email,
            organization_name,
            contact_name,
            messageId: emailData.messageId,
            emailResults: emailData,
            organizationConfirmation: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Organization confirmation email partially failed for ${contact_email}:`,
          {
            contact_email,
            organization_name,
            contact_name,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "Organization request confirmation delivery failed or partially rejected",
            operation: "confirmOrgRequestReceived",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          }
        );

        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Organization request confirmation failed",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Organization request confirmation delivery failed or partially rejected",
              operation: "confirmOrgRequestReceived",
            },
          };
        }
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Organization confirmation notification error for ${contact_email}: ${error.message}`,
        {
          stack: error.stack,
          contact_email,
          organization_name,
          contact_name,
          tenant,
          operation: "confirmOrgRequestReceived",
        }
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "An unexpected error occurred while processing organization request confirmation",
          operation: "confirmOrgRequestReceived",
          contact_email,
        }
      );

      if (next) {
        next(httpError);
        return;
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "An unexpected error occurred while processing organization request confirmation",
            operation: "confirmOrgRequestReceived",
          },
        };
      }
    }
  },
  notifyOrgRequestApproved: async (
    {
      organization_name,
      contact_name,
      contact_email,
      login_url,
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!contact_email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Contact email is required for organization approval notification",
          missing: ["contact_email"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Contact email is required for organization approval notification",
              missing: ["contact_email"],
            },
          };
        }
      }

      if (!organization_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Organization name is required for organization approval notification",
          missing: ["organization_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Organization name is required for organization approval notification",
              missing: ["organization_name"],
            },
          };
        }
      }

      if (!contact_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Contact name is required for organization approval notification",
          missing: ["contact_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Contact name is required for organization approval notification",
              missing: ["contact_name"],
            },
          };
        }
      }

      if (!login_url) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Login URL is required for organization approval notification",
          missing: ["login_url"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Login URL is required for organization approval notification",
              missing: ["login_url"],
            },
          };
        }
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email: contact_email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const sanitizedOrgName = sanitizeEmailString(organization_name);

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: contact_email,
        subject: `Organization Request Approved: ${sanitizedOrgName}`,
        html: msgs.notifyOrgRequestApproved({
          organization_name,
          contact_name,
          contact_email,
          login_url,
        }),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for approval notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate organization approval notification detected
          return {
            success: true,
            message:
              "Organization approval notification already sent recently - duplicate prevented",
            data: {
              contact_email,
              organization_name,
              contact_name,
              organizationApproval: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Organization approval notification sending failed";
          logger.error(
            `Organization approval email failed for ${contact_email}: ${errorMessage}`,
            {
              contact_email,
              organization_name,
              contact_name,
              tenant,
              login_url: login_url ? "***" : "not_provided", // Mask login URL in logs
              error: errorMessage,
            }
          );

          const error = new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Unable to send organization approval notification at this time",
              operation: "notifyOrgRequestApproved",
              emailResults: emailResult,
            }
          );

          if (next) {
            next(error);
            return;
          } else {
            return {
              success: false,
              message: "Organization approval notification failed",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: {
                message:
                  "Unable to send organization approval notification at this time",
                operation: "notifyOrgRequestApproved",
              },
            };
          }
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Organization approval notification sent successfully",
          data: {
            contact_email,
            organization_name,
            contact_name,
            messageId: emailData.messageId,
            emailResults: emailData,
            organizationApproval: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Organization approval email partially failed for ${contact_email}:`,
          {
            contact_email,
            organization_name,
            contact_name,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
            login_url: login_url ? "***" : "not_provided", // Mask login URL in logs
          }
        );

        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "Organization approval notification delivery failed or partially rejected",
            operation: "notifyOrgRequestApproved",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          }
        );

        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Organization approval notification failed",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Organization approval notification delivery failed or partially rejected",
              operation: "notifyOrgRequestApproved",
            },
          };
        }
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Organization approval notification error for ${contact_email}: ${error.message}`,
        {
          stack: error.stack,
          contact_email,
          organization_name,
          contact_name,
          tenant,
          login_url: login_url ? "***" : "not_provided", // Mask login URL in logs
          operation: "notifyOrgRequestApproved",
        }
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "An unexpected error occurred while processing organization approval notification",
          operation: "notifyOrgRequestApproved",
          contact_email,
        }
      );

      if (next) {
        next(httpError);
        return;
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "An unexpected error occurred while processing organization approval notification",
            operation: "notifyOrgRequestApproved",
          },
        };
      }
    }
  },
  notifyOrgRequestRejected: async (
    {
      organization_name,
      contact_name,
      contact_email,
      rejection_reason,
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!contact_email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Contact email is required for organization rejection notification",
          missing: ["contact_email"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Contact email is required for organization rejection notification",
              missing: ["contact_email"],
            },
          };
        }
      }

      if (!organization_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Organization name is required for organization rejection notification",
          missing: ["organization_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Organization name is required for organization rejection notification",
              missing: ["organization_name"],
            },
          };
        }
      }

      if (!contact_name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Contact name is required for organization rejection notification",
          missing: ["contact_name"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Contact name is required for organization rejection notification",
              missing: ["contact_name"],
            },
          };
        }
      }

      if (!rejection_reason) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Rejection reason is required for organization rejection notification",
          missing: ["rejection_reason"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message:
                "Rejection reason is required for organization rejection notification",
              missing: ["rejection_reason"],
            },
          };
        }
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email: contact_email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const sanitizedOrgName = sanitizeEmailString(organization_name);

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: contact_email,
        subject: `Organization Request Status: ${sanitizedOrgName}`,
        html: msgs.notifyOrgRequestRejected({
          organization_name,
          contact_name,
          contact_email,
          rejection_reason,
        }),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for rejection notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate organization rejection notification detected
          return {
            success: true,
            message:
              "Organization rejection notification already sent recently - duplicate prevented",
            data: {
              contact_email,
              organization_name,
              contact_name,
              organizationRejection: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Organization rejection notification sending failed";
          logger.error(
            `Organization rejection email failed for ${contact_email}: ${errorMessage}`,
            {
              contact_email,
              organization_name,
              contact_name,
              tenant,
              rejection_reason: rejection_reason ? "provided" : "not_provided", // Don't log actual reason
              error: errorMessage,
            }
          );

          const error = new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Unable to send organization rejection notification at this time",
              operation: "notifyOrgRequestRejected",
              emailResults: emailResult,
            }
          );

          if (next) {
            next(error);
            return;
          } else {
            return {
              success: false,
              message: "Organization rejection notification failed",
              status: httpStatus.INTERNAL_SERVER_ERROR,
              errors: {
                message:
                  "Unable to send organization rejection notification at this time",
                operation: "notifyOrgRequestRejected",
              },
            };
          }
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Organization rejection notification sent successfully",
          data: {
            contact_email,
            organization_name,
            contact_name,
            messageId: emailData.messageId,
            emailResults: emailData,
            organizationRejection: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Organization rejection email partially failed for ${contact_email}:`,
          {
            contact_email,
            organization_name,
            contact_name,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
            rejection_reason: rejection_reason ? "provided" : "not_provided",
          }
        );

        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "Organization rejection notification delivery failed or partially rejected",
            operation: "notifyOrgRequestRejected",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          }
        );

        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Organization rejection notification failed",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Organization rejection notification delivery failed or partially rejected",
              operation: "notifyOrgRequestRejected",
            },
          };
        }
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Organization rejection notification error for ${contact_email}: ${error.message}`,
        {
          stack: error.stack,
          contact_email,
          organization_name,
          contact_name,
          tenant,
          rejection_reason: rejection_reason ? "provided" : "not_provided", // Don't log actual reason
          operation: "notifyOrgRequestRejected",
        }
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "An unexpected error occurred while processing organization rejection notification",
          operation: "notifyOrgRequestRejected",
          contact_email,
        }
      );

      if (next) {
        next(httpError);
        return;
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "An unexpected error occurred while processing organization rejection notification",
            operation: "notifyOrgRequestRejected",
          },
        };
      }
    }
  },
  candidate: async (
    { firstName, lastName, email, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for candidate join request notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!firstName) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "First name is required for candidate join request notification",
          missing: ["firstName"],
        });
        next(error);
        return;
      }

      if (!lastName) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Last name is required for candidate join request notification",
          missing: ["lastName"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS && tenant.toLowerCase() === "airqo") {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "candidate",
                firstName,
                lastName,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Determine BCC based on tenant
      const shouldIncludeBcc = tenant.toLowerCase() === "airqo";
      const finalBccEmails = shouldIncludeBcc ? subscribedBccEmails : "";

      // ✅ STEP 5: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account JOIN request",
        html: msgs.joinRequest(firstName, lastName, email),
        bcc: finalBccEmails || undefined,
        attachments: attachments,
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for candidate join requests
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate candidate join request notification detected
          return {
            success: true,
            message:
              "Candidate join request notification already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              candidateJoinRequest: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Candidate join request notification sending failed";
          logger.error(
            `Candidate join request email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send candidate join request notification at this time",
                operation: "candidate",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Candidate join request notification successfully sent",
          data: {
            email,
            firstName,
            lastName,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: finalBccEmails ? finalBccEmails.split(",").length : 0,
            bccIncluded: shouldIncludeBcc,
            candidateJoinRequest: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Candidate join request email partially failed for ${email}:`,
          {
            email,
            firstName,
            lastName,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Candidate join request notification delivery failed or partially rejected",
              operation: "candidate",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Candidate join request notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          tenant,
          operation: "candidate",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing candidate join request notification",
            operation: "candidate",
            email,
          }
        )
      );
      return;
    }
  },
  request: async (
    { email, targetId, tenant = "airqo", entity_title = "" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for access request notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!targetId) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Target ID is required for access request notification",
          missing: ["targetId"],
        });
        next(error);
        return;
      }

      if (!entity_title) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Entity title is required for access request notification",
          missing: ["entity_title"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS && tenant.toLowerCase() === "airqo") {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "request",
                entity_title,
                targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Determine BCC based on tenant
      const shouldIncludeBcc = tenant.toLowerCase() === "airqo";
      const finalBccEmails = shouldIncludeBcc ? subscribedBccEmails : "";

      // ✅ STEP 5: Prepare mail options
      const processedEntityTitle = processString(entity_title);

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Your AirQo Account Request to Access ${processedEntityTitle} Team`,
        html: msgs.joinEntityRequest(email, entity_title),
        bcc: finalBccEmails || undefined,
        attachments: attachments,
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for access requests
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate access request notification detected
          return {
            success: true,
            message:
              "Access request notification already sent recently - duplicate prevented",
            data: {
              email,
              entity_title,
              targetId,
              accessRequest: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Access request notification sending failed";
          logger.error(
            `Access request email failed for ${email}: ${errorMessage}`,
            {
              email,
              entity_title,
              tenant,
              targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send access request notification at this time",
                operation: "request",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Access request notification successfully sent",
          data: {
            email,
            entity_title,
            targetId,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: finalBccEmails ? finalBccEmails.split(",").length : 0,
            bccIncluded: shouldIncludeBcc,
            accessRequest: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Access request email partially failed for ${email}:`, {
          email,
          entity_title,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Access request notification delivery failed or partially rejected",
              operation: "request",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Access request notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          entity_title,
          tenant,
          targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
          operation: "request",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing access request notification",
            operation: "request",
            email,
          }
        )
      );
      return;
    }
  },
  yearEndEmail: async ({
    email = "",
    firstName = "",
    lastName = "",
    tenant = "airqo",
    userStat = {},
  } = {}) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Email is required for year-end summary notification",
            missing: ["email"],
          },
        };
      }

      if (!userStat || Object.keys(userStat).length === 0) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "User statistics are required for year-end summary notification",
            missing: ["userStat"],
          },
        };
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account 2024 Year in Review 🌍", // Fixed typo: removed duplicate "Your"
        html: msgs.yearEndSummary(userStat),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for year-end emails
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate year-end email detected
          return {
            success: true,
            message:
              "Year-end summary already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              yearEndSummary: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Year-end summary email sending failed";
          logger.error(
            `Year-end summary email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              tenant,
              userStatPresent: !!userStat && Object.keys(userStat).length > 0,
              error: errorMessage,
            }
          );

          return {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: "Unable to send year-end summary email at this time",
              operation: "yearEndEmail",
              emailResults: emailResult,
            },
          };
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Year-end summary email successfully sent",
          data: {
            email,
            firstName,
            lastName,
            messageId: emailData.messageId,
            emailResults: emailData,
            userStatKeys: Object.keys(userStat), // Track what stats were included
            yearEndSummary: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Year-end summary email partially failed for ${email}:`, {
          email,
          firstName,
          lastName,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          userStatPresent: !!userStat && Object.keys(userStat).length > 0,
        });

        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Year-end summary email delivery failed or partially rejected",
            operation: "yearEndEmail",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          },
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Year-end summary email error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          tenant,
          userStatPresent: !!userStat && Object.keys(userStat).length > 0,
          operation: "yearEndEmail",
        }
      );

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message:
            "An unexpected error occurred while processing year-end summary email",
          operation: "yearEndEmail",
          email,
        },
      };
    }
  },
  requestToJoinGroupByEmail: async (
    {
      email,
      targetId,
      tenant = "airqo",
      entity_title = "",
      inviterEmail = "",
      userExists,
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for group join request notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!targetId) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Target ID is required for group join request notification",
          missing: ["targetId"],
        });
        next(error);
        return;
      }

      if (!entity_title) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Entity title is required for group join request notification",
          missing: ["entity_title"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS && tenant.toLowerCase() === "airqo") {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "requestToJoinGroupByEmail",
                entity_title,
                targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Determine BCC based on tenant
      const shouldIncludeBcc = tenant.toLowerCase() === "airqo";
      const finalBccEmails = shouldIncludeBcc ? subscribedBccEmails : "";

      // ✅ STEP 5: Prepare mail options
      const processedEntityTitle = processString(entity_title);

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Your AirQo Account Request to Access ${processedEntityTitle} Team`,
        html: msgTemplates.acceptInvitation({
          email,
          entity_title,
          targetId,
          inviterEmail,
          userExists,
        }),
        bcc: finalBccEmails || undefined,
        attachments: attachments,
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for group join requests
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate group join request notification detected
          return {
            success: true,
            message:
              "Group join request notification already sent recently - duplicate prevented",
            data: {
              email,
              entity_title,
              targetId,
              inviterEmail,
              userExists,
              groupJoinRequest: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Group join request notification sending failed";
          logger.error(
            `Group join request email failed for ${email}: ${errorMessage}`,
            {
              email,
              entity_title,
              tenant,
              targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
              inviterEmail,
              userExists,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send group join request notification at this time",
                operation: "requestToJoinGroupByEmail",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Group join request notification successfully sent",
          data: {
            email,
            entity_title,
            targetId,
            inviterEmail,
            userExists,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: finalBccEmails ? finalBccEmails.split(",").length : 0,
            bccIncluded: shouldIncludeBcc,
            groupJoinRequest: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Group join request email partially failed for ${email}:`,
          {
            email,
            entity_title,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
            targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
            inviterEmail,
            userExists,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Group join request notification delivery failed or partially rejected",
              operation: "requestToJoinGroupByEmail",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logObject("Group join request email error details", error);
      logger.error(
        `🐛🐛 Group join request notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          entity_title,
          tenant,
          targetId: targetId ? "***" : "not_provided", // Mask targetId in logs
          inviterEmail,
          userExists,
          operation: "requestToJoinGroupByEmail",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing group join request notification",
            operation: "requestToJoinGroupByEmail",
            email,
          }
        )
      );
      return;
    }
  },
  inquiry: async (
    { fullName, email, category, message, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for inquiry notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!fullName) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Full name is required for inquiry notification",
          missing: ["fullName"],
        });
        next(error);
        return;
      }

      if (!category) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Category is required for inquiry notification",
          missing: ["category"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test inquiry notification bypassed",
          data: {
            email,
            testBypass: true,
            inquiry: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (tenant.toLowerCase() === "airqo") {
        let bccEmailString = "";

        // Category-based BCC routing
        switch (category) {
          case "partners":
            bccEmailString = constants.PARTNERS_EMAILS;
            break;
          case "policy":
            bccEmailString = constants.POLICY_EMAILS;
            break;
          case "champions":
            bccEmailString = constants.CHAMPIONS_EMAILS;
            break;
          case "researchers":
            bccEmailString = constants.RESEARCHERS_EMAILS;
            break;
          case "developers":
            bccEmailString = constants.DEVELOPERS_EMAILS;
            break;
          case "general":
            bccEmailString = constants.PARTNERS_EMAILS;
            break;
          case "assistance":
            bccEmailString = constants.ASSISTANCE_EMAILS;
            break;
          default:
            bccEmailString = constants.PARTNERS_EMAILS;
        }

        if (bccEmailString) {
          const bccEmails = bccEmailString
            .split(",")
            .map((email) => email.trim());

          // Enhanced parallel processing with error handling
          const bccCheckPromises = bccEmails.map(async (bccEmail) => {
            try {
              const bccCheckResult = await SubscriptionModel(
                tenant
              ).checkNotificationStatus({
                email: bccEmail,
                type: "email",
              });

              return bccCheckResult.success ? bccEmail : null;
            } catch (error) {
              logger.error(
                `BCC subscription check failed for ${bccEmail}: ${error.message}`,
                {
                  primary_email: email,
                  operation: "inquiry",
                  category,
                }
              );
              return null;
            }
          });

          const bccResults = await Promise.all(bccCheckPromises);
          const successfulEmails = bccResults.filter((email) => email !== null);
          subscribedBccEmails = successfulEmails.join(",");
        }
      }

      // ✅ STEP 5: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Thank you for your inquiry - AirQo ${category} team`,
        html: msgs.inquiry(fullName, email, category, message), // Include message parameter
        bcc: subscribedBccEmails || undefined, // Fixed: Include BCC emails for inquiry routing
        attachments: attachments,
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for inquiry notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate inquiry notification detected
          return {
            success: true,
            message:
              "Inquiry notification already sent recently - duplicate prevented",
            data: {
              email,
              fullName,
              category,
              inquiry: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Inquiry notification sending failed";
          logger.error(
            `Inquiry notification email failed for ${email}: ${errorMessage}`,
            {
              email,
              fullName,
              category,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send inquiry notification at this time",
                operation: "inquiry",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Inquiry notification successfully sent",
          data: {
            email,
            fullName,
            category,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            categoryRouting: category, // Track which team received the inquiry
            inquiry: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Inquiry notification email partially failed for ${email}:`,
          {
            email,
            fullName,
            category,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Inquiry notification delivery failed or partially rejected",
              operation: "inquiry",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Inquiry notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          fullName,
          category,
          tenant,
          operation: "inquiry",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing inquiry notification",
            operation: "inquiry",
            email,
          }
        )
      );
      return;
    }
  },
  clientActivationRequest: async (
    { name, email, tenant = "airqo", client_id } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Email is required for client activation request notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!name) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Name is required for client activation request notification",
          missing: ["name"],
        });
        next(error);
        return;
      }

      if (!client_id) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Client ID is required for client activation request notification",
          missing: ["client_id"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test client activation request bypassed",
          data: {
            email,
            testBypass: true,
            clientActivation: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      const activateClientBccEmails =
        constants.REQUEST_ACCESS_EMAILS || "support@airqo.net";
      const bccEmails = activateClientBccEmails
        .split(",")
        .map((email) => email.trim());

      // Enhanced parallel processing with error handling
      const bccCheckPromises = bccEmails.map(async (bccEmail) => {
        try {
          const bccCheckResult = await SubscriptionModel(
            tenant
          ).checkNotificationStatus({
            email: bccEmail,
            type: "email",
          });

          return bccCheckResult.success ? bccEmail : null;
        } catch (error) {
          logger.error(
            `BCC subscription check failed for ${bccEmail}: ${error.message}`,
            {
              primary_email: email,
              operation: "clientActivationRequest",
              client_id: client_id ? "***" : "not_provided", // Mask client_id in logs
            }
          );
          return null;
        }
      });

      const bccResults = await Promise.all(bccCheckPromises);
      const subscribedBccEmails = bccResults
        .filter((email) => email !== null)
        .join(",");

      // ✅ STEP 5: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "AirQo API Client Activation Request",
        html: msgs.clientActivationRequest({ name, email, client_id }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for activation requests
        attachments: attachments,
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for client activation requests
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate client activation request detected
          return {
            success: true,
            message:
              "Client activation request already sent recently - duplicate prevented",
            data: {
              email,
              name,
              client_id,
              clientActivation: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Client activation request sending failed";
          logger.error(
            `Client activation request email failed for ${email}: ${errorMessage}`,
            {
              email,
              name,
              tenant,
              client_id: client_id ? "***" : "not_provided", // Mask client_id in logs
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send client activation request at this time",
                operation: "clientActivationRequest",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Client activation request successfully sent",
          data: {
            email,
            name,
            client_id,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            clientActivation: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Client activation request email partially failed for ${email}:`,
          {
            email,
            name,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
            client_id: client_id ? "***" : "not_provided", // Mask client_id in logs
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Client activation request delivery failed or partially rejected",
              operation: "clientActivationRequest",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Client activation request error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          name,
          tenant,
          client_id: client_id ? "***" : "not_provided", // Mask client_id in logs
          operation: "clientActivationRequest",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing client activation request",
            operation: "clientActivationRequest",
            email,
          }
        )
      );
      return;
    }
  },
  user: async (
    { firstName, lastName, email, password, tenant = "airqo", type } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for user welcome notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!firstName) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "First name is required for user welcome notification",
          missing: ["firstName"],
        });
        next(error);
        return;
      }

      if (!password) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Password is required for user welcome notification",
          missing: ["password"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test user welcome email bypassed",
          data: {
            email,
            testBypass: true,
            userCreation: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "user",
                tenant,
                type,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 5: Determine BCC based on type
      const shouldIncludeBcc = type === "confirm";
      const finalBccEmails = shouldIncludeBcc ? subscribedBccEmails : "";

      // ✅ STEP 6: Prepare mail options based on tenant
      let mailOptions;

      if (tenant.toLowerCase() === "kcca") {
        mailOptions = {
          from: {
            name: constants.EMAIL_NAME,
            address: constants.EMAIL,
          },
          to: email,
          subject: "Welcome to the AirQo KCCA Platform",
          html: msgs.welcome_kcca(firstName, lastName, password, email),
          bcc: finalBccEmails || undefined,
          attachments: attachments,
        };
      } else {
        mailOptions = {
          from: {
            name: constants.EMAIL_NAME,
            address: constants.EMAIL,
          },
          to: email,
          subject: "Welcome to Your AirQo Account",
          html: msgs.welcome_general(firstName, lastName, password, email),
          bcc: finalBccEmails || undefined,
          attachments: attachments,
        };
      }

      // ✅ STEP 7: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for user welcome emails
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 8: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate user welcome email detected
          return {
            success: true,
            message:
              "User welcome email already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              tenant,
              type,
              userCreation: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "User welcome email sending failed";
          logger.error(
            `User welcome email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              tenant,
              type,
              password: password ? "***" : "not_provided", // Mask password in logs
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send user welcome email at this time",
                operation: "user",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 9: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "User welcome email successfully sent",
          data: {
            email,
            firstName,
            lastName,
            tenant,
            type,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: finalBccEmails ? finalBccEmails.split(",").length : 0,
            bccIncluded: shouldIncludeBcc,
            userCreation: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`User welcome email partially failed for ${email}:`, {
          email,
          firstName,
          lastName,
          tenant,
          type,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          password: password ? "***" : "not_provided", // Mask password in logs
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "User welcome email delivery failed or partially rejected",
              operation: "user",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 User welcome email error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          tenant,
          type,
          password: password ? "***" : "not_provided", // Mask password in logs
          operation: "user",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing user welcome email",
            operation: "user",
            email,
          }
        )
      );
      return;
    }
  },
  verifyEmail: async (
    {
      user_id = "",
      token = "",
      email = "",
      firstName = "",
      category = "",
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email || !token || !user_id) {
        const missing = [];
        if (!email) missing.push("email");
        if (!token) missing.push("token");
        if (!user_id) missing.push("user_id");

        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Email, token, and user_id are required for email verification",
          missing,
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email case early
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Email verification sent (test mode)",
          data: {
            email,
            user_id,
            testMode: true,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        logger.warn(
          `Email verification blocked - user unsubscribed: ${email}`,
          {
            email,
            user_id,
            tenant,
          }
        );
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.warn(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                user_id,
                primary_email: email,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 5: Prepare mail options with all attachments
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Verify Your AirQo Account",
        html: msgTemplates.composeEmailVerificationMessage({
          email,
          firstName,
          user_id,
          token,
          category,
        }),
        bcc: subscribedBccEmails || undefined, // Only include BCC if there are emails
        attachments: [
          {
            filename: "airqoLogo.png",
            path: imagePath + "/airqoLogo.png",
            cid: "AirQoEmailLogo",
            contentDisposition: "inline",
          },
          {
            filename: "faceBookLogo.png",
            path: imagePath + "/facebookLogo.png",
            cid: "FacebookLogo",
            contentDisposition: "inline",
          },
          {
            filename: "youtubeLogo.png",
            path: imagePath + "/youtubeLogo.png",
            cid: "YoutubeLogo",
            contentDisposition: "inline",
          },
          {
            filename: "twitterLogo.png",
            path: imagePath + "/Twitter.png",
            cid: "Twitter",
            contentDisposition: "inline",
          },
          {
            filename: "linkedInLogo.png",
            path: imagePath + "/linkedInLogo.png",
            cid: "LinkedInLogo",
            contentDisposition: "inline",
          },
        ],
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for verification emails
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate email verification attempt
          logger.info(`Duplicate verification email prevented for: ${email}`, {
            email,
            user_id,
            tenant,
            category,
            preventedAt: new Date(),
          });

          return {
            success: true,
            message:
              "Verification email already sent recently. Please check your inbox or wait before requesting again.",
            data: {
              email,
              user_id,
              duplicate: true,
              cooldownActive: true,
              nextAllowedRequest: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Email verification sending failed";
          logger.error(
            `Verification email failed for ${email}: ${errorMessage}`,
            {
              email,
              user_id,
              tenant,
              category,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send verification email at this time",
                operation: "verifyEmail",
                emailResults: emailResult,
                user_id,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        logger.info(`Verification email successfully sent to: ${email}`, {
          email,
          user_id,
          tenant,
          category,
          messageId: emailData.messageId,
          bccCount: subscribedBccEmails
            ? subscribedBccEmails.split(",").length
            : 0,
          sentAt: new Date(),
        });

        return {
          success: true,
          message: "Verification email successfully sent",
          data: {
            email,
            user_id,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            duplicate: false,
            sentAt: new Date(),
            verificationExpiry: "24 hours", // Assuming verification token expires in 24 hours
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.warn(`Verification email partially failed for ${email}:`, {
          email,
          user_id,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          category,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Email verification delivery failed or partially rejected",
              operation: "verifyEmail",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              user_id,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Email verification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          user_id,
          tenant,
          category,
          operation: "verifyEmail",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing email verification request",
            operation: "verifyEmail",
            email,
            user_id,
          }
        )
      );
      return;
    }
  },
  clearEmailDeduplication: async (email, subject, content = "") => {
    try {
      const mockMailOptions = {
        to: email,
        subject: subject,
        html: content,
      };

      const removed = await emailDeduplicator.removeEmailKey(mockMailOptions);
      return {
        success: true,
        message: removed ? "Deduplication key removed" : "Key not found",
        removed,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  },
  getDeduplicationStats: async () => {
    try {
      const stats = await emailDeduplicator.getStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  },
  sendVerificationEmail: async ({ email, token, tenant }, next) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for email verification code",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!token) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Verification token is required for email verification code",
          missing: ["token"],
        });
        next(error);
        return;
      }

      if (!tenant) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Tenant is required for email verification code",
          missing: ["tenant"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test email verification bypassed",
          data: {
            email,
            testBypass: true,
            emailVerification: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "sendVerificationEmail",
                token: token ? "***" : "not_provided",
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 5: Prepare mail options with social media attachments
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Email Verification Code: ${token}`,
        html: msgs.mobileEmailVerification({ token, email }),
        bcc: subscribedBccEmails || undefined, // Fixed: Include BCC emails for verification notifications
        attachments: [
          {
            filename: "airqoLogo.png",
            path: imagePath + "/airqoLogo.png",
            cid: "AirQoEmailLogo",
            contentDisposition: "inline",
          },
          {
            filename: "faceBookLogo.png",
            path: imagePath + "/facebookLogo.png",
            cid: "FacebookLogo",
            contentDisposition: "inline",
          },
          {
            filename: "youtubeLogo.png",
            path: imagePath + "/youtubeLogo.png",
            cid: "YoutubeLogo",
            contentDisposition: "inline",
          },
          {
            filename: "twitterLogo.png",
            path: imagePath + "/Twitter.png",
            cid: "Twitter",
            contentDisposition: "inline",
          },
          {
            filename: "linkedInLogo.png",
            path: imagePath + "/linkedInLogo.png",
            cid: "LinkedInLogo",
            contentDisposition: "inline",
          },
        ],
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for verification emails
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate verification email detected
          return {
            success: true,
            message:
              "Email verification code already sent recently - duplicate prevented",
            data: {
              email,
              emailVerification: true,
              securityEvent: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Email verification code sending failed";
          logger.error(
            `Email verification code failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              token: token ? "***" : "not_provided", // Mask token in logs
              securityEvent: true,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send email verification code at this time",
                operation: "sendVerificationEmail",
                emailResults: emailResult,
                securityEvent: true,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Email verification code successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            emailVerification: true,
            securityEvent: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Email verification code partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Email verification code delivery failed or partially rejected",
              operation: "sendVerificationEmail",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              securityEvent: true,
            }
          )
        );
        return;
      }
    } catch (error) {
      logObject("Email verification error details", error);
      logger.error(
        `🐛🐛 Email verification code error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          operation: "sendVerificationEmail",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing email verification code",
            operation: "sendVerificationEmail",
            email,
            securityEvent: true,
          }
        )
      );
      return;
    }
  },
  verifyMobileEmail: async (
    { firebase_uid = "", token = "", email = "", tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for mobile verification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!firebase_uid) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Firebase UID is required for mobile verification",
          missing: ["firebase_uid"],
        });
        next(error);
        return;
      }

      if (!token) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Verification token is required for mobile verification",
          missing: ["token"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test mobile verification bypassed",
          data: {
            email,
            testBypass: true,
            mobileVerification: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "verifyMobileEmail",
                firebase_uid: firebase_uid ? "***" : "not_provided", // Mask firebase_uid in logs
                token: token ? "***" : "not_provided", // Mask token in logs
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 5: Prepare mail options with social media attachments
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your Login Code for AirQo Mobile",
        html: msgTemplates.mobileEmailVerification({
          email,
          firebase_uid,
          token,
        }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for mobile verification notifications
        attachments: [
          {
            filename: "airqoLogo.png",
            path: imagePath + "/airqoLogo.png",
            cid: "AirQoEmailLogo",
            contentDisposition: "inline",
          },
          {
            filename: "faceBookLogo.png",
            path: imagePath + "/facebookLogo.png",
            cid: "FacebookLogo",
            contentDisposition: "inline",
          },
          {
            filename: "youtubeLogo.png",
            path: imagePath + "/youtubeLogo.png",
            cid: "YoutubeLogo",
            contentDisposition: "inline",
          },
          {
            filename: "twitterLogo.png",
            path: imagePath + "/Twitter.png",
            cid: "Twitter",
            contentDisposition: "inline",
          },
          {
            filename: "linkedInLogo.png",
            path: imagePath + "/linkedInLogo.png",
            cid: "LinkedInLogo",
            contentDisposition: "inline",
          },
        ],
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for mobile verification emails
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate mobile verification email detected
          return {
            success: true,
            message:
              "Mobile verification code already sent recently - duplicate prevented",
            data: {
              email,
              mobileVerification: true,
              securityEvent: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Mobile verification code sending failed";
          logger.error(
            `Mobile verification email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              firebase_uid: firebase_uid ? "***" : "not_provided", // Mask firebase_uid in logs
              token: token ? "***" : "not_provided", // Mask token in logs
              securityEvent: true,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send mobile verification code at this time",
                operation: "verifyMobileEmail",
                emailResults: emailResult,
                securityEvent: true,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Mobile verification code successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            mobileVerification: true,
            securityEvent: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Mobile verification email partially failed for ${email}:`,
          {
            email,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
            firebase_uid: firebase_uid ? "***" : "not_provided", // Mask firebase_uid in logs
            token: token ? "***" : "not_provided", // Mask token in logs
            securityEvent: true,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Mobile verification code delivery failed or partially rejected",
              operation: "verifyMobileEmail",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              securityEvent: true,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Mobile verification email error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          firebase_uid: firebase_uid ? "***" : "not_provided", // Mask firebase_uid in logs
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          operation: "verifyMobileEmail",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing mobile verification code",
            operation: "verifyMobileEmail",
            email,
            securityEvent: true,
          }
        )
      );
      return;
    }
  },
  afterEmailVerification: async (
    {
      firstName = "",
      lastName = "",
      username = "",
      email = "",
      tenant = "airqo",
      analyticsVersion,
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Email is required for email verification welcome notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "afterEmailVerification",
                analyticsVersion,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Welcome to AirQo!",
        html: msgTemplates.afterEmailVerification({
          firstName,
          lastName,
          username,
          email,
          analyticsVersion,
        }),
        bcc: subscribedBccEmails || undefined, // Fixed: Include BCC emails for verification notifications
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for verification welcome emails
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate verification welcome email detected
          return {
            success: true,
            message:
              "Email verification welcome email already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              username,
              analyticsVersion,
              emailVerification: true,
              onboarding: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Email verification welcome email sending failed";
          logger.error(
            `Email verification welcome email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              username,
              analyticsVersion,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send email verification welcome email at this time",
                operation: "afterEmailVerification",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Email verification welcome email successfully sent",
          data: {
            email,
            firstName,
            lastName,
            username,
            analyticsVersion,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            emailVerification: true,
            onboarding: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Email verification welcome email partially failed for ${email}:`,
          {
            email,
            firstName,
            lastName,
            username,
            analyticsVersion,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Email verification welcome email delivery failed or partially rejected",
              operation: "afterEmailVerification",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Email verification welcome email error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          username,
          analyticsVersion,
          tenant,
          operation: "afterEmailVerification",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing email verification welcome email",
            operation: "afterEmailVerification",
            email,
          }
        )
      );
      return;
    }
  },
  afterClientActivation: async (
    {
      name = "",
      email = "",
      tenant = "airqo",
      client_id,
      action = "activate",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email || !client_id) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Email and client_id are required for client activation notification",
          missing:
            !email && !client_id
              ? ["email", "client_id"]
              : !email
              ? ["email"]
              : ["client_id"],
        });
        next(error);
        return;
      }

      // Validate action parameter
      const validActions = ["activate", "deactivate"];
      if (!validActions.includes(action)) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: `Invalid action. Must be one of: ${validActions.join(", ")}`,
          provided: action,
          valid: validActions,
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        logger.warn(
          `Client ${action} notification blocked - user unsubscribed: ${email}`,
          {
            email,
            client_id,
            action,
            tenant,
          }
        );
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.warn(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                client_id,
                action,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare dynamic email content based on action
      const isActivation = action === "activate";

      const subject = isActivation
        ? "AirQo API Client Activated!"
        : "AirQo API Client Deactivated!";

      const htmlContent = isActivation
        ? msgs.afterClientActivation({ name, email, client_id })
        : msgs.afterClientDeactivation({ name, email, client_id });

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject,
        html: htmlContent,
        bcc: subscribedBccEmails || undefined, // Only include BCC if there are emails
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for client notifications
          logDuplicates: true, // Log duplicate attempts for audit trail
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate client notification detected
          logger.info(
            `Duplicate client ${action} email prevented for: ${email}`,
            {
              email,
              client_id,
              action,
              tenant,
              preventedAt: new Date(),
            }
          );

          return {
            success: true,
            message: `Client ${action} notification already sent recently - duplicate prevented`,
            data: {
              email,
              client_id,
              action,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            `Client ${action} notification sending failed`;
          logger.error(
            `Client ${action} email failed for ${email}: ${errorMessage}`,
            {
              email,
              client_id,
              action,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: `Unable to send client ${action} notification at this time`,
                operation: "afterClientActivation",
                emailResults: emailResult,
                client_id,
                action,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        logger.info(`Client ${action} email successfully sent to: ${email}`, {
          email,
          client_id,
          action,
          tenant,
          messageId: emailData.messageId,
          bccCount: subscribedBccEmails
            ? subscribedBccEmails.split(",").length
            : 0,
          sentAt: new Date(),
        });

        return {
          success: true,
          message: `Client ${action} notification successfully sent`,
          data: {
            email,
            client_id,
            action,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.warn(`Client ${action} email partially failed for ${email}:`, {
          email,
          client_id,
          action,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Client ${action} notification delivery failed or partially rejected`,
              operation: "afterClientActivation",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              client_id,
              action,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Client ${action} notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          client_id,
          action,
          tenant,
          operation: "afterClientActivation",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: `An unexpected error occurred while processing client ${action} notification`,
            operation: "afterClientActivation",
            email,
            client_id,
            action,
          }
        )
      );
      return;
    }
  },
  afterAcceptingInvitation: async (
    { firstName, username, email, entity_title, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Email is required for invitation acceptance welcome notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!entity_title) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Entity title is required for invitation acceptance welcome notification",
          missing: ["entity_title"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "afterAcceptingInvitation",
                entity_title,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Welcome to ${entity_title}!`,
        html: msgTemplates.afterAcceptingInvitation({
          firstName,
          username,
          email,
          entity_title,
        }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for onboarding notifications
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for welcome emails
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate welcome email detected
          return {
            success: true,
            message:
              "Welcome email already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              username,
              entity_title,
              invitationAccepted: true,
              onboarding: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Welcome email sending failed";
          logger.error(`Welcome email failed for ${email}: ${errorMessage}`, {
            email,
            firstName,
            username,
            entity_title,
            tenant,
            error: errorMessage,
          });

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send welcome email at this time",
                operation: "afterAcceptingInvitation",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Welcome email successfully sent",
          data: {
            email,
            firstName,
            username,
            entity_title,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            invitationAccepted: true,
            onboarding: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Welcome email partially failed for ${email}:`, {
          email,
          firstName,
          username,
          entity_title,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Welcome email delivery failed or partially rejected",
              operation: "afterAcceptingInvitation",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Welcome email error for ${email}: ${error.message}`, {
        stack: error.stack,
        email,
        firstName,
        username,
        entity_title,
        tenant,
        operation: "afterAcceptingInvitation",
      });

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing welcome email",
            operation: "afterAcceptingInvitation",
            email,
          }
        )
      );
      return;
    }
  },
  forgot: async (
    { email, token, tenant = "airqo", version = 3 } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email || !token) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email and token are required for password reset",
          missing:
            !email && !token
              ? ["email", "token"]
              : !email
              ? ["email"]
              : ["token"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      logObject("subscription checkResult", checkResult);

      if (!checkResult.success) {
        logger.warn(`Password reset blocked - user unsubscribed: ${email}`);
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Link To Reset Password",
        html: msgs.recovery_email({ token, tenant, email, version }),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for password resets
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate password reset attempt - security consideration
          logger.info(
            `Duplicate password reset email prevented for: ${email}`,
            {
              email,
              tenant,
              version,
              preventedAt: new Date(),
            }
          );

          return {
            success: true,
            message:
              "Password reset email already sent recently. Please check your inbox or wait before requesting again.",
            data: {
              email,
              duplicate: true,
              cooldownActive: true,
              nextAllowedRequest: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Password reset email sending failed";
          logger.error(
            `Password reset email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              version,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send password reset email at this time",
                operation: "forgot_password",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        logger.info(`Password reset email successfully sent to: ${email}`, {
          email,
          tenant,
          version,
          messageId: emailData.messageId,
          sentAt: new Date(),
        });

        return {
          success: true,
          message: "Password reset email successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            duplicate: false,
            sentAt: new Date(),
            expiresIn: "1 hour",
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.warn(`Password reset email partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          version,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Password reset email delivery failed",
              operation: "forgot_password",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Password reset error for ${email}: ${error.message}`, {
        stack: error.stack,
        email,
        tenant,
        version,
        operation: "forgot_password",
      });

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing password reset request",
            operation: "forgot_password",
            email,
          }
        )
      );
      return;
    }
  },
  sendPasswordResetEmail: async ({ email, token, tenant = "airqo" }, next) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for password reset notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!token) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Reset token is required for password reset notification",
          missing: ["token"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Password Reset Code: ${token}`,
        html: msgs.mobilePasswordReset({ token, email }),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for password reset emails
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate password reset email detected
          return {
            success: true,
            message:
              "Password reset email already sent recently - duplicate prevented",
            data: {
              email,
              passwordReset: true,
              securityEvent: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Password reset email sending failed";
          logger.error(
            `Password reset email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              token: token ? "***" : "not_provided", // Mask token in logs
              securityEvent: true,
              error: errorMessage,
            }
          );

          next(
            new HttpError("Email not sent", httpStatus.INTERNAL_SERVER_ERROR, {
              message: "Unable to send password reset email at this time",
              operation: "sendPasswordResetEmail",
              emailResults: emailResult,
              securityEvent: true,
            })
          );
          return;
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Password reset email sent successfully",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            passwordReset: true,
            securityEvent: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Password reset email partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
        });

        next(
          new HttpError("Email not sent", httpStatus.INTERNAL_SERVER_ERROR, {
            message:
              "Password reset email delivery failed or partially rejected",
            operation: "sendPasswordResetEmail",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
            securityEvent: true,
          })
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Password reset email error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          operation: "sendPasswordResetEmail",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing password reset email",
            operation: "sendPasswordResetEmail",
            email,
            securityEvent: true,
          }
        )
      );
      return;
    }
  },
  signInWithEmailLink: async (
    { email, token, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for sign-in link",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!token) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Sign-in token is required for email link",
          missing: ["token"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test sign-in email link bypassed",
          data: {
            email,
            testBypass: true,
            emailSignIn: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Prepare mail options (no BCC for personal sign-in links)
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Verify your email address!",
        html: msgs.join_by_email(email, token),
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for sign-in links
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate sign-in email link detected
          return {
            success: true,
            message:
              "Sign-in email link already sent recently - duplicate prevented",
            data: {
              email,
              emailSignIn: true,
              securityEvent: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Sign-in email link sending failed";
          logger.error(
            `Sign-in email link failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              token: token ? "***" : "not_provided", // Mask token in logs
              securityEvent: true,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send sign-in email link at this time",
                operation: "signInWithEmailLink",
                emailResults: emailResult,
                securityEvent: true,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Sign-in email link successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            emailSignIn: true,
            securityEvent: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Sign-in email link partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Sign-in email link delivery failed or partially rejected",
              operation: "signInWithEmailLink",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              securityEvent: true,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Sign-in email link error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          operation: "signInWithEmailLink",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing sign-in email link",
            operation: "signInWithEmailLink",
            email,
            securityEvent: true,
          }
        )
      );
      return;
    }
  },
  deleteMobileAccountEmail: async (
    { email, token, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for account deletion confirmation",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!token) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Deletion token is required for account deletion confirmation",
          missing: ["token"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test account deletion email bypassed",
          data: {
            email,
            testBypass: true,
            accountDeletion: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Prepare mail options (no BCC for personal account deletion)
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Confirm Account Deletion - AirQo",
        html: msgTemplates.deleteMobileAccountEmail(email, token),
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for account deletion emails
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate account deletion email detected
          return {
            success: true,
            message:
              "Account deletion confirmation already sent recently - duplicate prevented",
            data: {
              email,
              accountDeletion: true,
              securityEvent: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Account deletion confirmation sending failed";
          logger.error(
            `Account deletion email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              token: token ? "***" : "not_provided", // Mask token in logs
              securityEvent: true,
              accountDeletion: true,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send account deletion confirmation at this time",
                operation: "deleteMobileAccountEmail",
                emailResults: emailResult,
                securityEvent: true,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Account deletion confirmation successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            accountDeletion: true,
            securityEvent: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Account deletion email partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          accountDeletion: true,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Account deletion confirmation delivery failed or partially rejected",
              operation: "deleteMobileAccountEmail",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              securityEvent: true,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Account deletion email error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          accountDeletion: true,
          operation: "deleteMobileAccountEmail",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing account deletion confirmation",
            operation: "deleteMobileAccountEmail",
            email,
            securityEvent: true,
          }
        )
      );
      return;
    }
  },
  authenticateEmail: async ({ email, token, tenant = "airqo" } = {}, next) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for email authentication",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!token) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Authentication token is required for email authentication",
          missing: ["token"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test email authentication bypassed",
          data: {
            email,
            testBypass: true,
            emailAuthentication: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Prepare mail options (no BCC for personal email authentication)
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Changes to your AirQo email",
        html: msgs.authenticate_email(token, email),
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for email authentication
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate email authentication detected
          return {
            success: true,
            message:
              "Email authentication already sent recently - duplicate prevented",
            data: {
              email,
              emailAuthentication: true,
              securityEvent: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Email authentication sending failed";
          logger.error(
            `Email authentication failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              token: token ? "***" : "not_provided", // Mask token in logs
              securityEvent: true,
              emailAuthentication: true,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send email authentication at this time",
                operation: "authenticateEmail",
                emailResults: emailResult,
                securityEvent: true,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Email authentication successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            emailAuthentication: true,
            securityEvent: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Email authentication partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          emailAuthentication: true,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Email authentication delivery failed or partially rejected",
              operation: "authenticateEmail",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              securityEvent: true,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Email authentication error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          securityEvent: true,
          emailAuthentication: true,
          operation: "authenticateEmail",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing email authentication",
            operation: "authenticateEmail",
            email,
            securityEvent: true,
          }
        )
      );
      return;
    }
  },
  update: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      updatedUserDetails = {},
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for user update notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account account updated",
        html: msgs.user_updated({
          firstName,
          lastName,
          updatedUserDetails,
          email,
        }),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for update notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate user update notification detected
          return {
            success: true,
            message:
              "User update notification already sent recently - duplicate prevented",
            data: {
              email,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "User update notification sending failed";
          logger.error(
            `User update email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send user update notification at this time",
                operation: "update",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "User update notification successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`User update email partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "User update notification delivery failed or partially rejected",
              operation: "update",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 User update notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          operation: "update",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing user update notification",
            operation: "update",
            email,
          }
        )
      );
      return;
    }
  },
  assign: async (
    { email, firstName, lastName, assignedTo, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for assignment notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!firstName) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "First name is required for assignment notification",
          missing: ["firstName"],
        });
        next(error);
        return;
      }

      if (!lastName) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Last name is required for assignment notification",
          missing: ["lastName"],
        });
        next(error);
        return;
      }

      if (!assignedTo) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Assignment target is required for assignment notification",
          missing: ["assignedTo"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options (no BCC for personal assignment notifications)
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Welcome to Your New Group/Network at Your AirQo Account",
        html: msgs.user_assigned(firstName, lastName, assignedTo, email),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for assignment notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate assignment notification detected
          return {
            success: true,
            message:
              "Assignment notification already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              assignedTo,
              userAssignment: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Assignment notification sending failed";
          logger.error(
            `Assignment notification email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              assignedTo: assignedTo ? "provided" : "not_provided", // Don't log full assignment details
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to send assignment notification at this time",
                operation: "assign",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Assignment notification successfully sent",
          data: {
            email,
            firstName,
            lastName,
            assignedTo,
            messageId: emailData.messageId,
            emailResults: emailData,
            userAssignment: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Assignment notification email partially failed for ${email}:`,
          {
            email,
            firstName,
            lastName,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            assignedTo: assignedTo ? "provided" : "not_provided", // Don't log full assignment details
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Assignment notification delivery failed or partially rejected",
              operation: "assign",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Assignment notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          assignedTo: assignedTo ? "provided" : "not_provided", // Don't log full assignment details
          tenant,
          operation: "assign",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing assignment notification",
            operation: "assign",
            email,
          }
        )
      );
      return;
    }
  },
  updateForgottenPassword: async (
    { email, firstName, lastName, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for password reset confirmation",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account Password Reset Successful",
        html: msgs.forgotten_password_updated(firstName, lastName, email),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for password reset confirmations
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate password reset confirmation detected
          return {
            success: true,
            message:
              "Password reset confirmation already sent recently - duplicate prevented",
            data: {
              email,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Password reset confirmation sending failed";
          logger.error(
            `Password reset confirmation email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send password reset confirmation at this time",
                operation: "updateForgottenPassword",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Password reset confirmation successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Password reset confirmation email partially failed for ${email}:`,
          {
            email,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Password reset confirmation delivery failed or partially rejected",
              operation: "updateForgottenPassword",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Password reset confirmation error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          operation: "updateForgottenPassword",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing password reset confirmation",
            operation: "updateForgottenPassword",
            email,
          }
        )
      );
      return;
    }
  },
  updateKnownPassword: async (
    { email, firstName, lastName, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for password update confirmation",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account Password Update Successful",
        html: msgs.known_password_updated(firstName, lastName, email),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for password update confirmations
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate password update confirmation detected
          return {
            success: true,
            message:
              "Password update confirmation already sent recently - duplicate prevented",
            data: {
              email,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Password update confirmation sending failed";
          logger.error(
            `Password update confirmation email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send password update confirmation at this time",
                operation: "updateKnownPassword",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Password update confirmation successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Password update confirmation email partially failed for ${email}:`,
          {
            email,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Password update confirmation delivery failed or partially rejected",
              operation: "updateKnownPassword",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Password update confirmation error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          operation: "updateKnownPassword",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing password update confirmation",
            operation: "updateKnownPassword",
            email,
          }
        )
      );
      return;
    }
  },
  newMobileAppUser: async (
    { email, message, subject, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for new mobile app user notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!message) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Message content is required for new mobile app user notification",
          missing: ["message"],
        });
        next(error);
        return;
      }

      if (!subject) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Subject is required for new mobile app user notification",
          missing: ["subject"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test new mobile app user notification bypassed",
          data: {
            email,
            testBypass: true,
            mobileAppUser: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "newMobileAppUser",
                subject: subject ? "provided" : "not_provided",
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 5: Log email details for debugging (enhanced)
      logger.info("Sending new mobile app user notification", {
        email,
        subject: subject ? "provided" : "not_provided",
        messageLength: message ? message.length : 0,
        bccCount: subscribedBccEmails
          ? subscribedBccEmails.split(",").length
          : 0,
        tenant,
        operation: "newMobileAppUser",
      });

      // ✅ STEP 6: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: subject,
        html: message,
        bcc: subscribedBccEmails || undefined,
      };

      // ✅ STEP 7: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for mobile app user notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 8: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate mobile app user notification detected
          return {
            success: true,
            message:
              "New mobile app user notification already sent recently - duplicate prevented",
            data: {
              email,
              subject,
              mobileAppUser: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "New mobile app user notification sending failed";
          logger.error(
            `New mobile app user notification email failed for ${email}: ${errorMessage}`,
            {
              email,
              subject: subject ? "provided" : "not_provided",
              messageLength: message ? message.length : 0,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send new mobile app user notification at this time",
                operation: "newMobileAppUser",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 9: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "New mobile app user notification successfully sent",
          data: {
            email,
            subject,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            mobileAppUser: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `New mobile app user notification email partially failed for ${email}:`,
          {
            email,
            subject: subject ? "provided" : "not_provided",
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "New mobile app user notification delivery failed or partially rejected",
              operation: "newMobileAppUser",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 New mobile app user notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          subject: subject ? "provided" : "not_provided",
          tenant,
          operation: "newMobileAppUser",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing new mobile app user notification",
            operation: "newMobileAppUser",
            email,
          }
        )
      );
      return;
    }
  },
  feedback: async (
    { email, message, subject, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for feedback submission",
          missing: ["email"],
        });
        next(error);
        return;
      }

      if (!message) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Message content is required for feedback submission",
          missing: ["message"],
        });
        next(error);
        return;
      }

      if (!subject) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Subject is required for feedback submission",
          missing: ["subject"],
        });
        next(error);
        return;
      }

      if (!constants.SUPPORT_EMAIL) {
        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "Support email configuration is missing",
            missing: ["SUPPORT_EMAIL"],
          }
        );
        next(error);
        return;
      }

      // ✅ STEP 2: Handle test email bypass
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "Test feedback submission bypassed",
          data: {
            email,
            testBypass: true,
            feedback: true,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Check user's subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 4: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.REQUEST_ACCESS_EMAILS) {
        const bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                user_email: email,
                operation: "feedback",
                subject: subject ? "provided" : "not_provided",
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 5: Prepare mail options (feedback routing: TO support, CC user, BCC admins)
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: constants.SUPPORT_EMAIL,
        cc: email, // User receives a copy of their feedback
        subject: subject,
        text: message, // Use text for feedback content
        bcc: subscribedBccEmails || undefined,
      };

      // ✅ STEP 6: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for feedback submissions
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate feedback submission detected
          return {
            success: true,
            message:
              "Feedback submission already sent recently - duplicate prevented",
            data: {
              email,
              subject,
              feedback: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Feedback submission sending failed";
          logger.error(
            `Feedback submission email failed for ${email}: ${errorMessage}`,
            {
              user_email: email,
              support_email: constants.SUPPORT_EMAIL,
              subject: subject ? "provided" : "not_provided",
              messageLength: message ? message.length : 0,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Unable to submit feedback at this time",
                operation: "feedback",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Feedback successfully submitted",
          data: {
            user_email: email,
            support_email: constants.SUPPORT_EMAIL,
            subject,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            feedback: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Feedback submission email partially failed for ${email}:`,
          {
            user_email: email,
            support_email: constants.SUPPORT_EMAIL,
            subject: subject ? "provided" : "not_provided",
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Feedback submission delivery failed or partially rejected",
              operation: "feedback",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Feedback submission error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          user_email: email,
          support_email: constants.SUPPORT_EMAIL,
          subject: subject ? "provided" : "not_provided",
          tenant,
          operation: "feedback",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing feedback submission",
            operation: "feedback",
            user_email: email,
          }
        )
      );
      return;
    }
  },
  sendReport: async (
    {
      senderEmail,
      normalizedRecepientEmails,
      pdfFile,
      csvFile,
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!senderEmail) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Sender email is required for report sending",
          missing: ["senderEmail"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "Sender email is required for report sending",
              missing: ["senderEmail"],
            },
          };
        }
      }

      if (
        !normalizedRecepientEmails ||
        !Array.isArray(normalizedRecepientEmails) ||
        normalizedRecepientEmails.length === 0
      ) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Recipient emails are required for report sending",
          missing: ["normalizedRecepientEmails"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "Recipient emails are required for report sending",
              missing: ["normalizedRecepientEmails"],
            },
          };
        }
      }

      if (!pdfFile && !csvFile) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "At least one report file (PDF or CSV) is required",
          missing: ["pdfFile", "csvFile"],
        });
        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "Bad Request",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "At least one report file (PDF or CSV) is required",
              missing: ["pdfFile", "csvFile"],
            },
          };
        }
      }

      // ✅ STEP 2: Check sender subscription status
      const senderCheckResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email: senderEmail,
        type: "email",
      });

      if (!senderCheckResult.success) {
        return senderCheckResult;
      }

      // ✅ STEP 3: Prepare report attachments
      let format;
      let reportAttachments = [...attachments];

      if (pdfFile) {
        format = "PDF";
        const pdfBase64 = pdfFile.data.toString("base64");
        const pdfAttachment = {
          filename: "Report.pdf",
          contentType: "application/pdf",
          content: pdfBase64,
          encoding: "base64",
        };
        reportAttachments.push(pdfAttachment);
      }

      if (csvFile) {
        format = pdfFile ? "PDF and CSV" : "CSV";
        const csvBase64 = csvFile.data.toString("base64");
        const csvAttachment = {
          filename: "Report.csv",
          contentType: "text/csv",
          content: csvBase64,
          encoding: "base64",
        };
        reportAttachments.push(csvAttachment);
      }

      // ✅ STEP 4: Process each recipient with subscription validation and deduplication
      const emailResults = [];
      const subscribedRecipients = [];

      // Parallel processing for recipient subscription validation
      const recipientCheckPromises = normalizedRecepientEmails.map(
        async (recipientEmail) => {
          try {
            // Handle test email bypass
            if (recipientEmail === "automated-tests@airqo.net") {
              return {
                email: recipientEmail,
                subscribed: true,
                testBypass: true,
              };
            }

            const checkResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: recipientEmail,
              type: "email",
            });

            return {
              email: recipientEmail,
              subscribed: checkResult.success,
              checkResult: checkResult,
            };
          } catch (error) {
            logger.error(
              `Recipient subscription check failed for ${recipientEmail}: ${error.message}`,
              {
                senderEmail,
                operation: "sendReport",
                format,
              }
            );
            return {
              email: recipientEmail,
              subscribed: false,
              error: error.message,
            };
          }
        }
      );

      const recipientResults = await Promise.all(recipientCheckPromises);

      // Filter subscribed recipients
      recipientResults.forEach((result) => {
        if (result.subscribed) {
          subscribedRecipients.push(result.email);
        } else if (result.testBypass) {
          subscribedRecipients.push(result.email);
        } else {
          emailResults.push({
            success: false,
            message: "Recipient not subscribed to email notifications",
            data: {
              recipientEmail: result.email,
              senderEmail,
              unsubscribed: true,
              checkResult: result.checkResult,
            },
            status: httpStatus.OK, // Not an error, just unsubscribed
          });
        }
      });

      // ✅ STEP 5: Send emails to subscribed recipients with deduplication protection
      const sendPromises = subscribedRecipients.map(async (recipientEmail) => {
        try {
          // Handle test email bypass
          if (recipientEmail === "automated-tests@airqo.net") {
            return {
              success: true,
              message: "Test report email bypassed",
              data: {
                recipientEmail,
                senderEmail,
                format,
                testBypass: true,
                bypassedAt: new Date(),
              },
              status: httpStatus.OK,
            };
          }

          // ✅ STEP 6: Prepare mail options for this recipient
          const mailOptions = {
            from: {
              name: constants.EMAIL_NAME,
              address: constants.EMAIL,
            },
            to: recipientEmail,
            subject: "Your AirQo Account Report",
            html: msgs.report(senderEmail, recipientEmail, format),
            attachments: reportAttachments,
          };

          // ✅ STEP 7: Send email with deduplication protection
          const emailResult = await sendMailWithDeduplication(
            transporter,
            mailOptions,
            {
              skipDeduplication: false, // Enable deduplication for report emails
              logDuplicates: true, // Log duplicate attempts
              throwOnDuplicate: false, // Handle duplicates gracefully
            }
          );

          // ✅ STEP 8: Handle email sending results
          if (!emailResult.success) {
            if (emailResult.duplicate) {
              // Duplicate report email detected
              return {
                success: true,
                message:
                  "Report email already sent recently - duplicate prevented",
                data: {
                  recipientEmail,
                  senderEmail,
                  format,
                  reportEmail: true,
                  duplicate: true,
                  preventedAt: new Date(),
                },
                status: httpStatus.OK,
              };
            } else {
              // Other email sending failure
              const errorMessage =
                emailResult.message || "Report email sending failed";
              logger.error(
                `Report email failed for ${recipientEmail}: ${errorMessage}`,
                {
                  recipientEmail,
                  senderEmail,
                  tenant,
                  format,
                  error: errorMessage,
                }
              );

              return {
                success: false,
                message: "Report email sending failed",
                data: {
                  recipientEmail,
                  senderEmail,
                  format,
                  error: errorMessage,
                  emailResults: emailResult,
                },
                status: httpStatus.INTERNAL_SERVER_ERROR,
              };
            }
          }

          // ✅ STEP 9: Validate successful email delivery
          const emailData = emailResult.data;

          if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
            return {
              success: true,
              message: "Report email successfully sent",
              data: {
                recipientEmail,
                senderEmail,
                format,
                messageId: emailData.messageId,
                emailResults: emailData,
                reportEmail: true,
                duplicate: false,
                sentAt: new Date(),
              },
              status: httpStatus.OK,
            };
          } else {
            // Email was sent but had rejections
            logger.error(
              `Report email partially failed for ${recipientEmail}:`,
              {
                recipientEmail,
                senderEmail,
                accepted: emailData?.accepted,
                rejected: emailData?.rejected,
                tenant,
                format,
              }
            );

            return {
              success: false,
              message: "Report email delivery failed or partially rejected",
              data: {
                recipientEmail,
                senderEmail,
                format,
                emailResults: emailData,
                accepted: emailData?.accepted || [],
                rejected: emailData?.rejected || [],
              },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        } catch (error) {
          logger.error(
            `🐛🐛 Report email error for ${recipientEmail}: ${error.message}`,
            {
              stack: error.stack,
              recipientEmail,
              senderEmail,
              tenant,
              format,
              operation: "sendReport",
            }
          );

          return {
            success: false,
            message: "Report email processing failed",
            data: {
              recipientEmail,
              senderEmail,
              format,
              error: error.message,
            },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
      });

      const sendResults = await Promise.all(sendPromises);
      emailResults.push(...sendResults);

      // ✅ STEP 10: Analyze overall results
      const hasFailedEmail = emailResults.some((result) => !result.success);
      const successfulSends = emailResults.filter((result) => result.success);
      const failedSends = emailResults.filter((result) => !result.success);
      const duplicatePrevented = emailResults.filter(
        (result) => result.data?.duplicate
      );

      const summaryData = {
        senderEmail,
        format,
        totalRecipients: normalizedRecepientEmails.length,
        subscribedRecipients: subscribedRecipients.length,
        successfulSends: successfulSends.length,
        failedSends: failedSends.length,
        duplicatesPrevented: duplicatePrevented.length,
        unsubscribedRecipients:
          normalizedRecepientEmails.length - subscribedRecipients.length,
        emailResults,
        reportSent: !hasFailedEmail || successfulSends.length > 0,
        sentAt: new Date(),
      };

      if (hasFailedEmail && successfulSends.length === 0) {
        // All emails failed
        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "All report emails failed to send",
            ...summaryData,
          }
        );

        if (next) {
          next(error);
          return;
        } else {
          return {
            success: false,
            message: "All report emails failed to send",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: summaryData,
          };
        }
      } else if (hasFailedEmail) {
        // Partial success
        logger.warn(
          `Some report emails failed to send for sender ${senderEmail}:`,
          summaryData
        );

        const error = new HttpError(
          "Partial Success",
          httpStatus.MULTI_STATUS,
          {
            message: "Some report emails failed to send",
            ...summaryData,
          }
        );

        if (next) {
          next(error);
          return;
        } else {
          return {
            success: true,
            message: "Some report emails sent successfully, others failed",
            status: httpStatus.MULTI_STATUS,
            data: summaryData,
          };
        }
      } else {
        // All emails successful
        return {
          success: true,
          message: "All report emails successfully sent",
          data: summaryData,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Report sending error for sender ${senderEmail}: ${error.message}`,
        {
          stack: error.stack,
          senderEmail,
          recipientCount: normalizedRecepientEmails?.length || 0,
          tenant,
          operation: "sendReport",
        }
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "An unexpected error occurred while processing report emails",
          operation: "sendReport",
          senderEmail,
        }
      );

      if (next) {
        next(httpError);
        return;
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "An unexpected error occurred while processing report emails",
            operation: "sendReport",
            senderEmail,
          },
        };
      }
    }
  },
  siteActivity: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      siteActivityDetails = {},
      activityDetails = {},
      deviceDetails = {},
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for site activity notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.HARDWARE_AND_DS_EMAILS) {
        const bccEmails = constants.HARDWARE_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "siteActivity",
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account: Monitor Deployment/Recall Alert",
        html: msgs.site_activity({
          firstName,
          lastName,
          siteActivityDetails,
          email,
          activityDetails,
          deviceDetails,
        }),
        bcc: subscribedBccEmails || undefined, // Only include BCC if there are emails
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for site activity notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate site activity notification detected
          return {
            success: true,
            message:
              "Site activity notification already sent recently - duplicate prevented",
            data: {
              email,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Site activity notification sending failed";
          logger.error(
            `Site activity email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send site activity notification at this time",
                operation: "siteActivity",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Site activity notification successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Site activity email partially failed for ${email}:`, {
          email,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Site activity notification delivery failed or partially rejected",
              operation: "siteActivity",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Site activity notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          operation: "siteActivity",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing site activity notification",
            operation: "siteActivity",
            email,
          }
        )
      );
      return;
    }
  },
  fieldActivity: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      activityDetails = {},
      deviceDetails = {},
      activityType = "recall",
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for field activity notification",
          missing: ["email"],
        });
        if (next) {
          next(error);
          return;
        } else {
          throw error;
        }
      }

      // Validate activity type
      const validActivityTypes = [
        "recall",
        "deployment",
        "maintenance",
        "inspection",
      ];
      if (!validActivityTypes.includes(activityType)) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: `Invalid activity type. Must be one of: ${validActivityTypes.join(
            ", "
          )}`,
          provided: activityType,
          valid: validActivityTypes,
        });
        if (next) {
          next(error);
          return;
        } else {
          throw error;
        }
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.HARDWARE_AND_DS_EMAILS) {
        const bccEmails = constants.HARDWARE_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "fieldActivity",
                activityType,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options based on activity type
      const subjectMap = {
        recall: "Field Alert: Device Recall Notification",
        deployment: "Field Alert: Device Deployment Notification",
        maintenance: "Field Alert: Device Maintenance Notification",
        inspection: "Field Alert: Device Inspection Notification",
      };

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: subjectMap[activityType] || "Field Activity Notification",
        html: msgs.field_activity({
          firstName,
          lastName,
          activityDetails,
          deviceDetails,
          activityType,
          email,
        }),
        bcc: subscribedBccEmails || undefined, // Only include BCC if there are emails
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for field activity notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate field activity notification detected
          return {
            success: true,
            message: `Field ${activityType} notification already sent recently - duplicate prevented`,
            data: {
              email,
              activityType,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            `Field ${activityType} notification sending failed`;
          logger.error(
            `Field ${activityType} email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              activityType,
              error: errorMessage,
            }
          );

          const error = new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Unable to send field ${activityType} notification at this time`,
              operation: "fieldActivity",
              emailResults: emailResult,
              activityType,
            }
          );

          if (next) {
            next(error);
            return;
          } else {
            throw error;
          }
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: `Field ${activityType} notification successfully sent`,
          data: {
            email,
            activityType,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Field ${activityType} email partially failed for ${email}:`,
          {
            email,
            activityType,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: `Field ${activityType} notification delivery failed or partially rejected`,
            operation: "fieldActivity",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
            activityType,
          }
        );

        if (next) {
          next(error);
          return;
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Field ${activityType} notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          activityType,
          operation: "fieldActivity",
        }
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: `An unexpected error occurred while processing field ${activityType} notification`,
          operation: "fieldActivity",
          email,
          activityType,
        }
      );

      if (next) {
        next(httpError);
        return;
      } else {
        throw httpError;
      }
    }
  },
  compromisedToken: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      ip = "",
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Email is required for compromised token security notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.PLATFORM_AND_DS_EMAILS) {
        const bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "compromisedToken",
                security_incident: true,
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject:
          "Urgent Security Alert - Potential Compromise of Your AIRQO API Token",
        html: msgs.token_compromised({
          firstName,
          lastName,
          ip,
          email,
        }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for security incident
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for security notifications
          logDuplicates: true, // Log duplicate attempts for security monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate security notification detected - this needs careful handling
          return {
            success: true,
            message:
              "Security alert notification already sent recently - duplicate prevented",
            data: {
              email,
              ip,
              securityIncident: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure - critical for security notifications
          const errorMessage =
            emailResult.message || "Security alert notification sending failed";
          logger.error(
            `Compromised token security email failed for ${email}: ${errorMessage}`,
            {
              email,
              ip,
              tenant,
              securityIncident: true,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send security alert notification at this time",
                operation: "compromisedToken",
                emailResults: emailResult,
                securityIncident: true,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Security alert notification successfully sent",
          data: {
            email,
            ip,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            securityIncident: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections - critical for security notifications
        logger.error(
          `Compromised token security email partially failed for ${email}:`,
          {
            email,
            ip,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
            securityIncident: true,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Security alert notification delivery failed or partially rejected",
              operation: "compromisedToken",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
              securityIncident: true,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Compromised token security notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          ip,
          tenant,
          securityIncident: true,
          operation: "compromisedToken",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing security alert notification",
            operation: "compromisedToken",
            email,
            securityIncident: true,
          }
        )
      );
      return;
    }
  },
  expiredToken: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      tenant = "airqo",
      token = "",
    } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Email is required for expired token notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.PLATFORM_AND_DS_EMAILS) {
        const bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "expiredToken",
                token: token ? "***" : "not_provided", // Mask token in logs
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Action Required: Your AirQo API Token is expired",
        html: msgs.tokenExpired({
          firstName,
          lastName,
          email,
          token,
        }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for token expiry notifications
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for token expiry notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate token expiry notification detected
          return {
            success: true,
            message:
              "Token expiry notification already sent recently - duplicate prevented",
            data: {
              email,
              tokenExpiry: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message || "Token expiry notification sending failed";
          logger.error(
            `Expired token notification email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              token: token ? "***" : "not_provided", // Mask token in logs
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send token expiry notification at this time",
                operation: "expiredToken",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Token expiry notification successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            tokenExpiry: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Expired token notification email partially failed for ${email}:`,
          {
            email,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
            token: token ? "***" : "not_provided", // Mask token in logs
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Token expiry notification delivery failed or partially rejected",
              operation: "expiredToken",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Expired token notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          token: token ? "***" : "not_provided", // Mask token in logs
          operation: "expiredToken",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing token expiry notification",
            operation: "expiredToken",
            email,
          }
        )
      );
      return;
    }
  },
  expiringToken: async ({
    email = "",
    firstName = "",
    lastName = "",
    tenant = "airqo",
  } = {}) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Email is required for expiring token notification",
            missing: ["email"],
          },
        };
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.PLATFORM_AND_DS_EMAILS) {
        const bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "expiringToken",
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "AirQo API Token Expiry: Create New Token Urgently",
        html: msgs.tokenExpiringSoon({
          firstName,
          lastName,
          email,
        }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for token warning notifications
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for token warning notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate token warning notification detected
          return {
            success: true,
            message:
              "Token expiry warning already sent recently - duplicate prevented",
            data: {
              email,
              tokenWarning: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Token expiry warning notification sending failed";
          logger.error(
            `Expiring token warning email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              error: errorMessage,
            }
          );

          return {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Unable to send token expiry warning notification at this time",
              operation: "expiringToken",
              emailResults: emailResult,
            },
          };
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Token expiry warning notification successfully sent",
          data: {
            email,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            tokenWarning: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Expiring token warning email partially failed for ${email}:`,
          {
            email,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Token expiry warning notification delivery failed or partially rejected",
            operation: "expiringToken",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          },
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Expiring token warning notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          operation: "expiringToken",
        }
      );

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message:
            "An unexpected error occurred while processing token expiry warning notification",
          operation: "expiringToken",
          email,
        },
      };
    }
  },
  updateProfileReminder: async ({
    email = "",
    firstName = "Unknown",
    lastName = "Unknown",
    tenant = "airqo",
  } = {}) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Email is required for profile update reminder notification",
            missing: ["email"],
          },
        };
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.PLATFORM_AND_DS_EMAILS) {
        const bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "updateProfileReminder",
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject:
          "Your AirQo Account: Update Your Name to Enhance Your Experience",
        html: msgs.updateProfilePrompt({
          firstName,
          lastName,
          email,
        }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for profile reminder notifications
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for profile reminder notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate profile reminder notification detected
          return {
            success: true,
            message:
              "Profile update reminder already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              profileReminder: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Profile update reminder notification sending failed";
          logger.error(
            `Profile update reminder email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              tenant,
              error: errorMessage,
            }
          );

          return {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Unable to send profile update reminder notification at this time",
              operation: "updateProfileReminder",
              emailResults: emailResult,
            },
          };
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Profile update reminder notification successfully sent",
          data: {
            email,
            firstName,
            lastName,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            profileReminder: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Profile update reminder email partially failed for ${email}:`,
          {
            email,
            firstName,
            lastName,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Profile update reminder notification delivery failed or partially rejected",
            operation: "updateProfileReminder",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          },
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Profile update reminder notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          tenant,
          operation: "updateProfileReminder",
        }
      );

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message:
            "An unexpected error occurred while processing profile update reminder notification",
          operation: "updateProfileReminder",
          email,
        },
      };
    }
  },
  existingUserAccessRequest: async (
    { email = "", firstName = "", lastName = "", tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message:
            "Email is required for existing user access request notification",
          missing: ["email"],
        });
        next(error);
        return;
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Process BCC emails with subscription validation (parallel processing)
      let subscribedBccEmails = "";

      if (constants.PLATFORM_AND_DS_EMAILS) {
        const bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.error(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`,
              {
                primary_email: email,
                operation: "existingUserAccessRequest",
              }
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 4: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account: Existing User Access Request",
        html: msgs.existing_user({
          firstName,
          lastName,
          email,
        }),
        bcc: subscribedBccEmails || undefined, // Include BCC emails for access request notifications
        attachments: attachments,
      };

      // ✅ STEP 5: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for access request notifications
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 6: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate access request notification detected
          return {
            success: true,
            message:
              "Existing user access request notification already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              accessRequest: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Existing user access request notification sending failed";
          logger.error(
            `Existing user access request email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              tenant,
              error: errorMessage,
            }
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message:
                  "Unable to send existing user access request notification at this time",
                operation: "existingUserAccessRequest",
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 7: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message:
            "Existing user access request notification successfully sent",
          data: {
            email,
            firstName,
            lastName,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            accessRequest: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(
          `Existing user access request email partially failed for ${email}:`,
          {
            email,
            firstName,
            lastName,
            accepted: emailData?.accepted,
            rejected: emailData?.rejected,
            tenant,
          }
        );

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Existing user access request notification delivery failed or partially rejected",
              operation: "existingUserAccessRequest",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Existing user access request notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          tenant,
          operation: "existingUserAccessRequest",
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message:
              "An unexpected error occurred while processing existing user access request notification",
            operation: "existingUserAccessRequest",
            email,
          }
        )
      );
      return;
    }
  },
  existingUserRegistrationRequest: async (
    { email = "", firstName = "", lastName = "", tenant = "airqo" } = {},
    next
  ) => {
    try {
      // ✅ STEP 1: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 2: Process BCC emails with subscription validation
      let subscribedBccEmails = "";

      if (constants.PLATFORM_AND_DS_EMAILS) {
        const bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
        const subscribedEmails = [];

        // Parallel processing for better performance
        const bccCheckPromises = bccEmails.map(async (bccEmail) => {
          const trimmedEmail = bccEmail.trim();
          try {
            const bccCheckResult = await SubscriptionModel(
              tenant
            ).checkNotificationStatus({
              email: trimmedEmail,
              type: "email",
            });

            return bccCheckResult.success ? trimmedEmail : null;
          } catch (error) {
            logger.warn(
              `BCC subscription check failed for ${trimmedEmail}: ${error.message}`
            );
            return null;
          }
        });

        const bccResults = await Promise.all(bccCheckPromises);
        subscribedEmails.push(...bccResults.filter((email) => email !== null));
        subscribedBccEmails = subscribedEmails.join(",");
      }

      // ✅ STEP 3: Prepare mail options
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Your AirQo Account: Existing User Registration Request",
        html: msgs.existing_user({
          firstName,
          lastName,
          email,
        }),
        bcc: subscribedBccEmails || undefined, // Only include BCC if there are emails
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication
          logDuplicates: true, // Log duplicate attempts
          throwOnDuplicate: false, // Don't throw on duplicates, handle gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate email detected - this is actually a success case
          logger.info(`Duplicate registration email prevented for: ${email}`);
          return {
            success: true,
            message:
              "Registration email already sent recently - duplicate prevented",
            data: {
              email,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage = emailResult.message || "Email sending failed";
          logger.error(
            `Registration email failed for ${email}: ${errorMessage}`
          );

          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: errorMessage,
                emailResults: emailResult,
              }
            )
          );
          return;
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        logger.info(`Registration email successfully sent to: ${email}`);

        return {
          success: true,
          message: "Registration email successfully sent",
          data: {
            email,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.warn(`Registration email partially failed for ${email}:`, {
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
        });

        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Email delivery failed or partially rejected",
              emailResults: emailData,
              accepted: emailData?.accepted || [],
              rejected: emailData?.rejected || [],
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Registration email error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
        }
      );

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
            operation: "existingUserRegistrationRequest",
            email,
          }
        )
      );
      return;
    }
  },
  sendPollutionAlert: async ({
    email = "",
    firstName = "",
    lastName = "",
    subject = "",
    content = "",
    tenant = "airqo",
  } = {}) => {
    try {
      // ✅ STEP 1: Input validation
      if (!email) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Email is required for pollution alert notification",
            missing: ["email"],
          },
        };
      }

      if (!subject) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Subject is required for pollution alert notification",
            missing: ["subject"],
          },
        };
      }

      if (!content) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Content is required for pollution alert notification",
            missing: ["content"],
          },
        };
      }

      // ✅ STEP 2: Check primary recipient subscription status
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });

      if (!checkResult.success) {
        return checkResult;
      }

      // ✅ STEP 3: Prepare mail options
      const fullName = `${firstName} ${lastName}`.trim() || "User";

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: subject,
        html: constants.EMAIL_BODY({
          email,
          content,
          name: fullName,
        }),
        attachments: attachments,
      };

      // ✅ STEP 4: Send email with deduplication protection
      const emailResult = await sendMailWithDeduplication(
        transporter,
        mailOptions,
        {
          skipDeduplication: false, // Enable deduplication for pollution alerts
          logDuplicates: true, // Log duplicate attempts for monitoring
          throwOnDuplicate: false, // Handle duplicates gracefully
        }
      );

      // ✅ STEP 5: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          // Duplicate pollution alert detected
          return {
            success: true,
            message:
              "Pollution alert notification already sent recently - duplicate prevented",
            data: {
              email,
              firstName,
              lastName,
              subject,
              pollutionAlert: true,
              duplicate: true,
              preventedAt: new Date(),
            },
            status: httpStatus.OK,
          };
        } else {
          // Other email sending failure
          const errorMessage =
            emailResult.message ||
            "Pollution alert notification sending failed";
          logger.error(
            `Pollution alert email failed for ${email}: ${errorMessage}`,
            {
              email,
              firstName,
              lastName,
              subject,
              tenant,
              error: errorMessage,
            }
          );

          return {
            success: false,
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message:
                "Unable to send pollution alert notification at this time",
              operation: "sendPollutionAlert",
              emailResults: emailResult,
            },
          };
        }
      }

      // ✅ STEP 6: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: "Pollution alert notification successfully sent",
          data: {
            email,
            firstName,
            lastName,
            subject,
            messageId: emailData.messageId,
            emailResults: emailData,
            pollutionAlert: true,
            duplicate: false,
            sentAt: new Date(),
          },
          status: httpStatus.OK,
        };
      } else {
        // Email was sent but had rejections
        logger.error(`Pollution alert email partially failed for ${email}:`, {
          email,
          firstName,
          lastName,
          subject,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
        });

        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Pollution alert notification delivery failed or partially rejected",
            operation: "sendPollutionAlert",
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          },
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Pollution alert notification error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          firstName,
          lastName,
          subject,
          tenant,
          operation: "sendPollutionAlert",
        }
      );

      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message:
            "An unexpected error occurred while processing pollution alert notification",
          operation: "sendPollutionAlert",
          email,
        },
      };
    }
  },
};

module.exports = mailer;
