const transporter = require("@config/mailer.config");
const isEmpty = require("is-empty");
const SubscriptionModel = require("@models/Subscription");
const constants = require("@config/constants");
const msgs = require("./email.msgs.util");
const msgTemplates = require("./email.templates.util");
const httpStatus = require("http-status");
const path = require("path");
const EmailQueueModel = require("@models/EmailQueue");
const EmailLogModel = require("@models/EmailLog");
const AdminAlertCounterModel = require("@models/AdminAlertCounter");
const {
  emailDeduplicator,
  sendMailWithDeduplication,
} = require("./email-deduplication.util");
const {
  logObject,
  logText,
  HttpError,
  sanitizeEmailString,
} = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- mailer-util`);
const processString = (inputString) => {
  const stringWithSpaces = inputString.replace(/[^a-zA-Z0-9]+/g, " ");
  const uppercasedString = stringWithSpaces.toUpperCase();
  return uppercasedString;
};
const projectRoot = path.join(__dirname, "..", "..");
const imagePath = path.join(projectRoot, "config", "images");

/**
 * START: MongoDB-based Email Queue for Throttling
 */
const EMAIL_INTERVAL = constants.EMAIL_QUEUE_INTERVAL_MS || 3000; // 3 seconds between each email send attempt (configurable)
let isProcessingQueue = false;
let queueIntervalId = null;

const addToEmailQueue = async (mailOptions, tenant = "airqo") => {
  try {
    const EmailQueue = EmailQueueModel(tenant);
    await new EmailQueue({ mailOptions }).save();
    // The background processor will pick this up
    return { success: true, message: "Email queued successfully." };
  } catch (error) {
    logger.error(`Failed to add email to queue: ${error.message}`);
    // Even if queuing fails, we should probably still try to send for critical emails.
    // For now, we'll just log the error.
    return { success: false, error: error.message };
  }
};

const processEmailQueue = async () => {
  if (isProcessingQueue) {
    return;
  }
  isProcessingQueue = true;

  try {
    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    const EmailQueueForFinding = EmailQueueModel(defaultTenant);

    // Reset stale "processing" jobs
    try {
      const processingTimeout = new Date(Date.now() - 30000); // 30 seconds
      await EmailQueueForFinding.updateMany(
        { status: "processing", lastAttemptAt: { $lt: processingTimeout } },
        { $set: { status: "pending" } },
      );
    } catch (error) {
      logger.warn(`Error resetting stale email jobs: ${error.message}`);
    }

    const emailJob = await EmailQueueForFinding.findOneAndUpdate(
      { status: "pending" },
      { $set: { status: "processing", lastAttemptAt: new Date() } },
      { sort: { createdAt: 1 } },
    );

    if (emailJob) {
      // Use the tenant from the job to get the correct model for deletion
      const tenant = emailJob.tenant || defaultTenant;
      const EmailQueueForDeleting = EmailQueueModel(tenant);

      try {
        await transporter.sendMail(emailJob.mailOptions);
        await EmailQueueForDeleting.findByIdAndDelete(emailJob._id);
        logger.info(`Email sent successfully to: ${emailJob.mailOptions.to}`);
      } catch (error) {
        logger.error(`Failed to send email from queue: ${error.message}`);
        await EmailQueueForDeleting.findByIdAndUpdate(emailJob._id, {
          $set: { status: "failed", errorMessage: error.message },
          $inc: { attempts: 1 },
        });
      }
    }
  } catch (error) {
    logger.error(`Error processing email queue: ${error.message}`);
  } finally {
    isProcessingQueue = false;
  }
};

const startEmailQueue = () => {
  if (!queueIntervalId) {
    queueIntervalId = setInterval(processEmailQueue, EMAIL_INTERVAL);
    logger.info("Email queue processor started.");
  }
};

const stopEmailQueue = () => {
  if (queueIntervalId) {
    clearInterval(queueIntervalId);
    queueIntervalId = null;
    logger.info("Email queue processor stopped.");
  }
};

// Start the queue processor
setInterval(processEmailQueue, EMAIL_INTERVAL);

/** END: MongoDB-based Email Queue */

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

const createMailerFunction = (
  functionName,
  category,
  emailMessageFunction,
  customMailOptionsModifier = null,
) => {
  return async (params, next) => {
    let email = "";
    let otherParams = {};
    let tenant = "";
    try {
      ({ email, tenant = "airqo", ...otherParams } = params);

      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: `Email is required for ${functionName}`,
          missing: ["email"],
        });
        if (next) {
          next(error);
          return;
        }
        throw error;
      }

      // ✅ STEP 2: Handle test emails early
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: `Test ${functionName} email bypassed`,
          data: {
            email,
            testBypass: true,
            functionName,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: Subscription check based on category
      const isCoreFunction =
        EMAIL_CATEGORIES.CORE_CRITICAL.includes(functionName);

      if (!isCoreFunction) {
        const checkResult = await SubscriptionModel(
          tenant,
        ).checkNotificationStatus({
          email,
          type: "email",
        });

        if (!checkResult.success) {
          switch (checkResult.status) {
            case httpStatus.NOT_FOUND:
              // New user - create default subscription and proceed
              logText(`Creating default subscription for new user: ${email}`);
              try {
                await SubscriptionModel(tenant).createDefaultSubscription(
                  email,
                  false,
                );
              } catch (createError) {
                logger.warn(
                  `Failed to create default subscription for ${email}: ${createError.message}`,
                );
              }
              break;

            case httpStatus.FORBIDDEN:
              // User explicitly unsubscribed - block the email
              logger.warn(`Email blocked - user unsubscribed: ${email}`);
              return {
                success: false,
                message: "User has unsubscribed from email notifications",
                status: httpStatus.FORBIDDEN,
                data: {
                  email,
                  unsubscribed: true,
                  functionName,
                  blockedAt: new Date(),
                },
              };

            case httpStatus.INTERNAL_SERVER_ERROR:
              // Database error - log but proceed (fail open)
              logger.error(
                `Subscription check failed for ${email}, proceeding anyway: ${checkResult.message}`,
              );
              break;

            default:
              // Other errors - log and proceed
              logger.warn(
                `Subscription check issue for ${email}, proceeding: ${checkResult.message}`,
              );
              break;
          }
        }
      } else {
        logText(
          `Skipping subscription check for core function ${functionName}: ${email}`,
        );
      }

      // ✅ STEP 4: Continue with email sending logic

      // ✅ STEP 4a: Process BCC emails with improved subscription validation
      let subscribedBccEmails = "";

      const shouldProcessBcc = [
        "candidate",
        "siteActivity",
        "fieldActivity",
        "existingUserAccessRequest",
        "clientActivationRequest",
        "existingUserRegistrationRequest",
      ].includes(functionName);

      // Skip default BCC processing if a custom modifier will provide it.
      if (shouldProcessBcc && !customMailOptionsModifier) {
        const bccEmailSource =
          functionName === "siteActivity" || functionName === "fieldActivity"
            ? constants.HARDWARE_AND_DS_EMAILS
            : constants.REQUEST_ACCESS_EMAILS;

        if (bccEmailSource) {
          const bccEmails = bccEmailSource
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean);
          const subscribedEmails = [];

          const bccCheckPromises = bccEmails.map(async (bccEmail) => {
            try {
              const bccCheckResult = await SubscriptionModel(
                tenant,
              ).checkNotificationStatus({
                email: bccEmail,
                type: "email",
              });

              // ✅ IMPROVED LOGIC: Handle different scenarios properly
              if (bccCheckResult.success) {
                // User is subscribed
                return bccEmail;
              } else if (bccCheckResult.status === httpStatus.NOT_FOUND) {
                // No subscription record - CREATE DEFAULT and INCLUDE
                logger.info(
                  `Creating default subscription for BCC recipient: ${bccEmail}`,
                );
                try {
                  await SubscriptionModel(tenant).createDefaultSubscription(
                    bccEmail,
                    true,
                  ); // isSystemUser = true
                  return bccEmail; // Include after creating subscription
                } catch (createError) {
                  logger.warn(
                    `Failed to create subscription for BCC ${bccEmail}: ${createError.message}`,
                  );
                  // ✅ STILL INCLUDE - BCC emails are typically system notifications
                  return bccEmail;
                }
              } else if (bccCheckResult.status === httpStatus.FORBIDDEN) {
                // User explicitly unsubscribed - RESPECT THEIR CHOICE
                logger.info(
                  `BCC recipient ${bccEmail} has unsubscribed - excluding from BCC`,
                );
                return null;
              } else {
                // Other errors - INCLUDE BY DEFAULT (fail open for BCC)
                logger.warn(
                  `BCC subscription check uncertain for ${bccEmail}, including anyway`,
                );
                return bccEmail;
              }
            } catch (error) {
              logger.error(
                `BCC subscription check failed for ${bccEmail}: ${error.message}`,
                {
                  primary_email: email,
                  operation: functionName,
                  bccEmail: bccEmail,
                },
              );
              // ✅ FAIL OPEN: Include in BCC on errors (system notifications are important)
              return bccEmail;
            }
          });

          const bccResults = await Promise.all(bccCheckPromises);
          subscribedEmails.push(
            ...bccResults.filter((email) => email !== null),
          );
          subscribedBccEmails = subscribedEmails.join(",");

          logger.info(`BCC processing for ${functionName}:`, {
            totalBccEmails: bccEmails.length,
            subscribedBccEmails: subscribedEmails.length,
            excludedEmails: bccEmails.length - subscribedEmails.length,
            finalBccList: subscribedBccEmails,
          });
        }
      }

      // ✅ STEP 4b: Prepare base mail options
      const baseMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: getEmailSubject(functionName, otherParams),
        html: emailMessageFunction({ email, tenant, ...params }),
        bcc: subscribedBccEmails || undefined,
        attachments: attachments,
      };

      // ✅ STEP 4c: Apply custom mail options modifier if provided
      const mailOptions = customMailOptionsModifier
        ? customMailOptionsModifier(baseMailOptions, { email, ...otherParams })
        : baseMailOptions;

      // ✅ STEP 4d: Check for duplicates before queuing
      let emailResult;
      try {
        const shouldSend =
          await emailDeduplicator.checkAndMarkEmail(mailOptions);

        if (shouldSend) {
          // Not a duplicate, add to the queue
          const queueResult = await addToEmailQueue(mailOptions, tenant);
          if (!queueResult.success) {
            throw new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: queueResult.error || "Failed to queue email." },
            );
          }
          emailResult = {
            success: true,
            message: "Email successfully queued for sending.",
            duplicate: false,
            data: {
              accepted: [mailOptions.to],
              rejected: [],
              messageId: `queued_${new Date().getTime()}`,
            },
          };
        } else {
          // This is a duplicate, do not queue
          const message = `Duplicate email prevented: ${mailOptions.to} - ${mailOptions.subject}`;
          logger.info(message);
          emailResult = {
            success: false,
            message: "Email not sent - duplicate detected",
            duplicate: true,
            data: null,
          };
        }
      } catch (redisError) {
        // If Redis fails, we "fail open" and queue the email anyway
        logger.warn(
          `Redis deduplication check failed, queuing email anyway: ${redisError.message}`,
          {
            email: mailOptions.to,
            subject: mailOptions.subject,
            redisError: redisError.message,
          },
        );
        const queueResult = await addToEmailQueue(mailOptions, tenant);
        if (!queueResult.success) {
          throw new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: queueResult.error || "Failed to queue email." },
          );
        }
        emailResult = {
          success: true,
          message: "Email queued for sending (deduplication check failed).",
          duplicate: false, // Assumed not a duplicate
          data: {
            accepted: [mailOptions.to],
            rejected: [],
            messageId: `queued_redis_fail_${new Date().getTime()}`,
          },
        };
      }

      // The rest of the logic now deals with the result of the *queuing* action,
      // not the direct sending action. The background processor handles the actual sending.
      if (!emailResult.success && !emailResult.duplicate) {
        // This would happen if adding to the MongoDB queue itself failed.
        throw new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Failed to queue email for sending." },
        );
      }

      // ✅ STEP 4e: Handle email queuing results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          return {
            success: true, // Return success to the caller, as preventing a duplicate is a success.
            message: `${functionName} email already sent recently - duplicate prevented`,
            data: {
              email,
              functionName,
              duplicate: true,
              preventedAt: new Date(),
              ...otherParams,
            },
            status: httpStatus.OK,
          };
        } else {
          const errorMessage =
            emailResult.message || `${functionName} email queuing failed`;
          logger.error(
            `${functionName} email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              functionName,
              error: errorMessage,
              params: otherParams,
            },
          );

          const error = new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Unable to queue ${functionName} email at this time`,
              operation: functionName,
              emailResults: emailResult,
            },
          );

          if (next) {
            next(error);
            return;
          }
          throw error;
        }
      }

      // ✅ STEP 4f: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        return {
          success: true,
          message: `${functionName} email successfully queued`,
          data: {
            email,
            functionName,
            messageId: emailData.messageId,
            emailResults: emailData,
            bccCount: subscribedBccEmails
              ? subscribedBccEmails.split(",").length
              : 0,
            duplicate: false,
            sentAt: new Date(),
            ...otherParams,
          },
          status: httpStatus.OK,
        };
      } else {
        logger.error(`${functionName} email partially failed for ${email}:`, {
          email,
          functionName,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          params: otherParams,
        });

        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: `${functionName} email delivery failed or partially rejected`,
            operation: functionName,
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          },
        );

        if (next) {
          next(error);
          return;
        }
        throw error;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 ${functionName} error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          functionName,
          params: otherParams,
        },
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: `An unexpected error occurred while processing ${functionName}`,
          operation: functionName,
          email,
        },
      );

      if (next) {
        next(httpError);
        return;
      }
      throw httpError;
    }
  };
};

// Helper function to get email subjects
const getEmailSubject = (functionName, params) => {
  const subjects = {
    // ===== CORE CRITICAL FUNCTIONS =====
    verifyEmail: "Verify Your AirQo Account",
    sendVerificationEmail: `Email Verification Code: ${params.token || ""}`,
    verifyMobileEmail: "Your Login Code for AirQo Mobile",
    afterEmailVerification: "Welcome to AirQo!",
    forgot: "Link To Reset Password",
    sendPasswordResetEmail: `Password Reset Code: ${params.token || ""}`,
    updateForgottenPassword: "Your AirQo Account Password Reset Successful",
    updateKnownPassword: "Your AirQo Account Password Update Successful",
    signInWithEmailLink: "Verify your email address!",
    deleteMobileAccountEmail: "Confirm Account Deletion - AirQo",
    authenticateEmail: "Changes to your AirQo email",
    compromisedToken:
      "Urgent Security Alert - Potential Compromise of Your AIRQO API Token",
    sendBotAlert: "🚨 Security Alert: Automated Bot Activity Detected",
    expiredToken: "Action Required: Your AirQo API Token is expired",
    expiringToken: "AirQo API Token Expiry: Create New Token Urgently",

    // ===== ORG MANAGEMENT FUNCTIONS =====
    notifyAdminsOfNewOrgRequest: `New Organization Request: ${sanitizeEmailString(
      params.organization_name || "",
    )}`,
    confirmOrgRequestReceived: `Your Organization Request: ${sanitizeEmailString(
      params.organization_name || "",
    )}`,
    notifyOrgRequestApproved: `Organization Request Approved: ${sanitizeEmailString(
      params.organization_name || "",
    )}`,
    notifyOrgRequestRejected: `Organization Request Status: ${sanitizeEmailString(
      params.organization_name || "",
    )}`,
    notifyOrgRequestApprovedWithOnboarding: `Welcome to AirQo: Complete Your Setup - ${sanitizeEmailString(
      params.organization_name || "",
    )}`,
    onboardingAccountSetup: `Complete Your AirQo Account Setup - ${sanitizeEmailString(
      params.organization_name || "",
    )}`,
    onboardingCompleted: `Welcome to AirQo: Your Account is Ready! - ${sanitizeEmailString(
      params.organization_name || "",
    )}`,

    // ===== USER MANAGEMENT FUNCTIONS =====
    candidate: "Your AirQo Account JOIN request",
    request: `Your AirQo Account Request to Access ${processString(
      params.entity_title || "",
    )} Team`,
    requestToJoinGroupByEmail: `Your AirQo Account Request to Access ${processString(
      params.entity_title || "",
    )} Team`,
    afterAcceptingInvitation: `Welcome to ${
      params.entity_title ? processString(params.entity_title) : "the team"
    }!`,
    user: "Welcome to Your AirQo Account",
    assign: "Welcome to Your New Group/Network at Your AirQo Account",
    update: "Your AirQo Account Updated",
    existingUserAccessRequest:
      "Your AirQo Account: Existing User Access Request",
    existingUserRegistrationRequest:
      "Your AirQo Account: Existing User Registration Request",
    requestRejected: `Update on your AirQo Access Request for ${processString(
      params.entity_title || "",
    )}`,

    // ===== CLIENT MANAGEMENT FUNCTIONS =====
    clientActivationRequest: "AirQo API Client Activation Request",
    afterClientActivation:
      params.action === "activate"
        ? "AirQo API Client Activated!"
        : "AirQo API Client Deactivated!",

    // ===== OPTIONAL FUNCTIONS =====
    yearEndEmail: "Your AirQo Account 2024 Year in Review 🌍",
    inquiry: `Thank you for your inquiry - AirQo ${params.category || ""} team`,
    newMobileAppUser: params.subject || "AirQo Mobile App Notification",
    feedback: params.subject || "AirQo Feedback Submission",
    sendReport: "Your AirQo Account Report",
    siteActivity: "Your AirQo Account: Monitor Deployment/Recall Alert",
    fieldActivity: (() => {
      const subjectMap = {
        recall: "Field Alert: Device Recall Notification",
        deployment: "Field Alert: Device Deployment Notification",
        maintenance: "Field Alert: Device Maintenance Notification",
        inspection: "Field Alert: Device Inspection Notification",
      };
      return subjectMap[params.activityType] || "Field Activity Notification";
    })(),
    updateProfileReminder:
      "Your AirQo Account: Update Your Name to Enhance Your Experience",
    sendPollutionAlert: params.subject || "AirQo Pollution Alert",
    inactiveAccount: "We've Missed You on AirQo!",
    sendAccountDeletionConfirmation: "Confirm Your AirQo Account Deletion",
    sendAccountDeletionSuccess: "Your AirQo Account Has Been Deleted",
    sendMobileAccountDeletionCode: "Your AirQo Account Deletion Code",
    sendCompromiseSummary:
      "Daily Security Alert Summary - Compromised Token Activity",
  };

  return subjects[functionName] || `AirQo Account Notification`;
};

// Email Categories Definition
const EMAIL_CATEGORIES = {
  CORE_CRITICAL: [
    "verifyEmail",
    "sendVerificationEmail",
    "verifyMobileEmail",
    "afterEmailVerification",
    "forgot",
    "sendPasswordResetEmail",
    "updateForgottenPassword",
    "updateKnownPassword",
    "signInWithEmailLink",
    "deleteMobileAccountEmail",
    "inactiveAccount",
    "sendAccountDeletionConfirmation",
    "sendAccountDeletionSuccess",
    "sendMobileAccountDeletionCode",
    "authenticateEmail",
    "compromisedToken",
    "sendBotAlert",
    "sendCompromiseSummary",
    "expiredToken",
    "expiringToken",
    "onboardingAccountSetup",
  ],

  ORG_MANAGEMENT: [
    "notifyAdminsOfNewOrgRequest",
    "confirmOrgRequestReceived",
    "notifyOrgRequestApproved",
    "notifyOrgRequestRejected",
    "notifyOrgRequestApprovedWithOnboarding",
    "onboardingCompleted",
  ],

  USER_MANAGEMENT: [
    "candidate",
    "request",
    "requestToJoinGroupByEmail",
    "afterAcceptingInvitation",
    "user",
    "assign",
    "update",
    "existingUserAccessRequest",
    "existingUserRegistrationRequest",
    "requestRejected",
  ],

  CLIENT_MANAGEMENT: ["clientActivationRequest", "afterClientActivation"],

  OPTIONAL: [
    "yearEndEmail",
    "inquiry",
    "newMobileAppUser",
    "feedback",
    "sendReport",
    "siteActivity",
    "fieldActivity",
    "updateProfileReminder",
    "sendPollutionAlert",
  ],
};

/**
 * Enhanced wrapper for security-critical emails with cooldown tracking
 * Extends createMailerFunction with MongoDB-based cooldown checks
 */
const createSecurityEmailFunction = (
  functionName,
  emailMessageFunction,
  cooldownConfig = {},
) => {
  const { cooldownDays = 30, enableCooldown = true } = cooldownConfig;

  return async (params, next) => {
    let email = "";
    let otherParams = {};
    let tenant = "";
    try {
      ({ email, tenant = "airqo", ...otherParams } = params);

      // ✅ STEP 1: Input validation
      if (!email) {
        const error = new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: `Email is required for ${functionName}`,
          missing: ["email"],
        });
        if (next) {
          next(error);
          return;
        }
        throw error;
      }

      // ✅ STEP 2: Handle test emails early
      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: `Test ${functionName} email bypassed`,
          data: {
            email,
            testBypass: true,
            functionName,
            bypassedAt: new Date(),
          },
          status: httpStatus.OK,
        };
      }

      // ✅ STEP 3: MongoDB cooldown check (NEW - SECURITY EMAILS ONLY)
      if (enableCooldown) {
        try {
          const EmailLog = EmailLogModel(tenant);
          const cooldownCheck = await EmailLog.canSendEmail({
            email,
            emailType: functionName,
            cooldownDays,
          });

          if (!cooldownCheck.canSend) {
            logger.info(
              `${functionName} email blocked due to ${cooldownDays}-day cooldown for ${email}`,
              {
                reason: cooldownCheck.reason,
                lastSentAt: cooldownCheck.lastSentAt,
                daysRemaining: cooldownCheck.daysRemaining,
                nextAvailableDate: cooldownCheck.nextAvailableDate,
              },
            );

            // In case of a race condition where another instance just sent it,
            // we return success but indicate it was blocked.
            if (cooldownCheck.reason === "cooldown_active") {
              return {
                success: true,
                message: `Email not sent - ${cooldownDays}-day cooldown period active`,
                data: {
                  email,
                  blockedByCooldown: true,
                },
              };
            }

            return {
              success: true, // Not an error - cooldown is expected behavior
              message: `Email not sent - ${cooldownDays}-day cooldown period active`,
              data: {
                email,
                blocked: true,
                cooldownActive: true,
                cooldownInfo: {
                  lastSentAt: cooldownCheck.lastSentAt,
                  daysRemaining: cooldownCheck.daysRemaining,
                  nextAvailableDate: cooldownCheck.nextAvailableDate,
                },
              },
              status: httpStatus.OK,
            };
          }
        } catch (cooldownError) {
          // ✅ FAIL OPEN: If cooldown check fails, allow email (better safe than sorry for security alerts)
          logger.warn(
            `Cooldown check failed for ${functionName}, proceeding with email send: ${cooldownError.message}`,
            {
              email,
              tenant,
              functionName,
            },
          );
        }
      }

      // ✅ STEP 4: Subscription check (SKIP for CORE_CRITICAL security emails)
      // Security emails are always sent regardless of subscription status

      // ✅ STEP 5: Prepare email content
      const baseMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: getEmailSubject(functionName, otherParams),
        html: emailMessageFunction({ email, ...otherParams }),
        attachments: attachments,
      };

      // ✅ STEP 6: Send email with existing deduplication (5-minute Redis check)
      const emailResult = await sendMailWithDeduplication(
        transporter,
        baseMailOptions,
        {
          skipDeduplication: false,
          logDuplicates: true,
          throwOnDuplicate: false,
        },
      );

      // ✅ STEP 7: Handle email sending results
      if (!emailResult.success) {
        if (emailResult.duplicate) {
          return {
            success: true,
            message: `${functionName} email already sent recently - duplicate prevented`,
            data: {
              email,
              functionName,
              duplicate: true,
              preventedAt: new Date(),
              ...otherParams,
            },
            status: httpStatus.OK,
          };
        } else {
          const errorMessage =
            emailResult.message || `${functionName} email sending failed`;
          logger.error(
            `${functionName} email failed for ${email}: ${errorMessage}`,
            {
              email,
              tenant,
              functionName,
              error: errorMessage,
              params: otherParams,
            },
          );

          const error = new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Unable to send ${functionName} email at this time`,
              operation: functionName,
              emailResults: emailResult,
            },
          );

          if (next) {
            next(error);
            return;
          }
          throw error;
        }
      }

      // ✅ STEP 8: Validate successful email delivery
      const emailData = emailResult.data;

      if (isEmpty(emailData?.rejected) && !isEmpty(emailData?.accepted)) {
        // ✅ STEP 9: Log successful send to MongoDB for cooldown tracking
        if (enableCooldown) {
          try {
            const EmailLog = EmailLogModel(tenant);
            await EmailLog.logEmailSent({
              email,
              emailType: functionName,
              metadata: {
                messageId: emailData.messageId,
                ...otherParams,
              },
            });
          } catch (logError) {
            // Log error but don't fail the request
            logger.warn(
              `Failed to log ${functionName} email send to database: ${logError.message}`,
            );
          }
        }

        return {
          success: true,
          message: `${functionName} email successfully sent`,
          data: {
            email,
            functionName,
            messageId: emailData.messageId,
            emailResults: emailData,
            duplicate: false,
            sentAt: new Date(),
            ...otherParams,
          },
          status: httpStatus.OK,
        };
      } else {
        logger.error(`${functionName} email partially failed for ${email}:`, {
          email,
          functionName,
          accepted: emailData?.accepted,
          rejected: emailData?.rejected,
          tenant,
          params: otherParams,
        });

        const error = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: `${functionName} email delivery failed or partially rejected`,
            operation: functionName,
            emailResults: emailData,
            accepted: emailData?.accepted || [],
            rejected: emailData?.rejected || [],
          },
        );

        if (next) {
          next(error);
          return;
        }
        throw error;
      }
    } catch (error) {
      logger.error(
        `🐛🐛 ${functionName} error for ${email}: ${error.message}`,
        {
          stack: error.stack,
          email,
          tenant,
          functionName,
          params: otherParams,
        },
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: `An unexpected error occurred while processing ${functionName}`,
          operation: functionName,
          email,
        },
      );

      if (next) {
        next(httpError);
        return;
      }
      throw httpError;
    }
  };
};

const createAdminAlertFunction = (
  functionName,
  emailMessageFunction,
  options = {},
) => {
  const { maxAlertsPerDay = 2 } = options;

  return async (params, next) => {
    let tenant = "";
    let recipients = [];
    let otherParams = {};

    try {
      const {
        recipients: rawRecipients,
        tenant = "airqo",
        ...otherParams
      } = params;

      // Normalize and validate recipients
      let recipients = [];
      if (Array.isArray(rawRecipients)) {
        recipients = rawRecipients;
      } else if (typeof rawRecipients === "string") {
        recipients = rawRecipients.split(",").map((e) => e.trim());
      }

      // Filter out empty strings and remove duplicates
      recipients = [...new Set(recipients.filter(Boolean))];

      if (recipients.length === 0) {
        logger.warn(`${functionName} called without valid recipients.`);
        return { success: true, message: "No valid recipients to send to." };
      }

      // Validate SUPPORT_EMAIL before queuing
      if (!constants.SUPPORT_EMAIL || !constants.SUPPORT_EMAIL.includes("@")) {
        logger.error(
          `CRITICAL: ${functionName} cannot be sent because SUPPORT_EMAIL is not configured.`,
        );
        return {
          success: false,
          message: "Admin alert system is not configured.",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      // ✅ STEP 1: Rate-limiting check
      try {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const counter = await AdminAlertCounterModel(tenant).findOneAndUpdate(
          { date: today, emailType: functionName },
          { $inc: { count: 1 } },
          { upsert: true, new: true },
        );

        if (counter.count > maxAlertsPerDay) {
          logger.info(
            `Skipping ${functionName} email. Daily limit of ${maxAlertsPerDay} reached.`,
          );
          // Optional: Decrement the counter if we're not sending the email
          // This makes the limit "at most" rather than "first N"
          await AdminAlertCounterModel(tenant).updateOne(
            { date: today, emailType: functionName },
            { $inc: { count: -1 } },
          );
          return {
            success: true,
            message: `Daily alert limit reached. Email not sent.`,
            status: httpStatus.OK,
          };
        }
      } catch (rateLimitError) {
        logger.error(
          `Error checking rate limit for ${functionName}: ${rateLimitError.message}`,
        );
        // Fail open: proceed with sending the email if the check fails.
      }

      // ✅ STEP 2: Prepare and queue the email
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: constants.SUPPORT_EMAIL, // Validated above
        subject: getEmailSubject(functionName, otherParams),
        html: emailMessageFunction({ recipients, ...otherParams }),
        bcc: recipients.join(","),
        attachments: attachments,
      };

      const queueResult = await addToEmailQueue(mailOptions, tenant);

      if (!queueResult.success) {
        throw new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Failed to queue admin alert email." },
        );
      }

      // ✅ STEP 3: Log the successful queuing for rate-limiting
      try {
        const EmailLog = EmailLogModel(tenant);
        await EmailLog.logEmailSent({
          email: recipients.join(","),
          emailType: functionName,
          metadata: { ...otherParams },
        });
      } catch (logError) {
        logger.warn(
          `Failed to log admin alert send for ${functionName}: ${logError.message}`,
        );
      }

      return {
        success: true,
        message: "Admin alert email successfully queued.",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error in ${functionName}: ${error.message}`);
      if (next) {
        next(error);
      } else {
        // For fire-and-forget calls, just log the error.
        return { success: false, message: error.message };
      }
    }
  };
};

const mailer = {
  notifyAdminsOfNewOrgRequest: createMailerFunction(
    "notifyAdminsOfNewOrgRequest",
    "ORG_MANAGEMENT",
    (params) =>
      msgs.notifyAdminsOfNewOrgRequest({
        organization_name: params.organization_name,
        contact_name: params.contact_name,
        contact_email: params.contact_email,
      }),
  ),
  confirmOrgRequestReceived: createMailerFunction(
    "confirmOrgRequestReceived",
    "ORG_MANAGEMENT",
    (params) =>
      msgs.confirmOrgRequestReceived({
        organization_name: params.organization_name,
        contact_name: params.contact_name,
        contact_email: params.contact_email,
      }),
  ),
  notifyOrgRequestApproved: createMailerFunction(
    "notifyOrgRequestApproved",
    "ORG_MANAGEMENT",
    (params) =>
      msgs.notifyOrgRequestApproved({
        organization_name: params.organization_name,
        contact_name: params.contact_name,
        contact_email: params.contact_email,
        login_url: params.login_url,
      }),
  ),
  notifyOrgRequestRejected: createMailerFunction(
    "notifyOrgRequestRejected",
    "ORG_MANAGEMENT",
    (params) =>
      msgs.notifyOrgRequestRejected({
        organization_name: params.organization_name,
        contact_name: params.contact_name,
        contact_email: params.contact_email,
        rejection_reason: params.rejection_reason,
      }),
  ),
  candidate: createMailerFunction("candidate", "USER_MANAGEMENT", (params) =>
    msgs.joinRequest(params.firstName, params.lastName, params.email),
  ),
  request: createMailerFunction("request", "USER_MANAGEMENT", (params) =>
    msgs.joinEntityRequest(params.email, params.entity_title),
  ),

  yearEndEmail: createMailerFunction("yearEndEmail", "OPTIONAL", (params) =>
    msgs.yearEndSummary(params.userStat),
  ),
  requestToJoinGroupByEmail: createMailerFunction(
    "requestToJoinGroupByEmail",
    "USER_MANAGEMENT",
    (params) =>
      msgs.requestToJoinGroupByEmail({
        email: params.email,
        entity_title: params.entity_title,
        inviterEmail: params.inviterEmail,
        userExists: params.userExists,
        inviter_name: params.inviter_name,
        group_description: params.group_description,
        request_id: params.request_id,
        token: params.token,
        targetId: params.targetId,
      }),
    (baseMailOptions, params) => ({
      ...baseMailOptions,
      bcc: params.inviterEmail,
    }),
  ),
  inquiry: createMailerFunction("inquiry", "OPTIONAL", (params) =>
    msgs.inquiry(
      params.fullName,
      params.email,
      params.category,
      params.message,
    ),
  ),
  clientActivationRequest: createMailerFunction(
    "clientActivationRequest",
    "CLIENT_MANAGEMENT",
    (params) =>
      msgs.clientActivationRequest({
        name: params.name,
        email: params.email,
        client_id: params.client_id,
      }),
  ),
  user: createMailerFunction("user", "USER_MANAGEMENT", (params) => {
    if (params.tenant?.toLowerCase() === "kcca") {
      return msgs.welcome_kcca(
        params.firstName,
        params.lastName,
        params.password,
        params.email,
      );
    } else {
      return msgs.welcome_general(
        params.firstName,
        params.lastName,
        params.password,
        params.email,
      );
    }
  }),
  verifyEmail: createMailerFunction("verifyEmail", "CORE_CRITICAL", (params) =>
    msgTemplates.composeEmailVerificationMessage({
      email: params.email,
      firstName: params.firstName,
      user_id: params.user_id,
      token: params.token,
      category: params.category,
    }),
  ),
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
  sendVerificationEmail: createMailerFunction(
    "sendVerificationEmail",
    "CORE_CRITICAL",
    (params) =>
      msgs.mobileEmailVerification({
        token: params.token,
        email: params.email,
      }),
  ),
  verifyMobileEmail: createMailerFunction(
    "verifyMobileEmail",
    "CORE_CRITICAL",
    (params) =>
      msgTemplates.mobileEmailVerification({
        email: params.email,
        firebase_uid: params.firebase_uid,
        token: params.token,
      }),
  ),
  afterEmailVerification: createMailerFunction(
    "afterEmailVerification",
    "CORE_CRITICAL",
    (params) =>
      msgTemplates.afterEmailVerification({
        firstName: params.firstName,
        lastName: params.lastName,
        username: params.username,
        email: params.email,
        analyticsVersion: params.analyticsVersion,
      }),
  ),
  afterClientActivation: createMailerFunction(
    "afterClientActivation",
    "CLIENT_MANAGEMENT",
    (params) => {
      const isActivation = params.action === "activate";
      return isActivation
        ? msgs.afterClientActivation({
            name: params.name,
            email: params.email,
            client_id: params.client_id,
          })
        : msgs.afterClientDeactivation({
            name: params.name,
            email: params.email,
            client_id: params.client_id,
          });
    },
  ),
  afterAcceptingInvitation: createMailerFunction(
    "afterAcceptingInvitation",
    "USER_MANAGEMENT",
    (params) =>
      msgTemplates.afterAcceptingInvitation({
        firstName: params.firstName,
        username: params.username,
        email: params.email,
        entity_title: params.entity_title,
      }),
  ),
  forgot: createMailerFunction("forgot", "CORE_CRITICAL", (params) => {
    return msgs.recovery_email({
      token: params.token,
      tenant: params.tenant,
      email: params.email,
      version: params.version,
      slug: params.slug,
    });
  }),
  sendPasswordResetEmail: createMailerFunction(
    "sendPasswordResetEmail",
    "CORE_CRITICAL",
    (params) =>
      msgs.mobilePasswordReset({
        token: params.token,
        email: params.email,
      }),
  ),
  signInWithEmailLink: createMailerFunction(
    "signInWithEmailLink",
    "CORE_CRITICAL",
    (params) => msgs.join_by_email(params.email, params.token),
  ),
  deleteMobileAccountEmail: createMailerFunction(
    "deleteMobileAccountEmail",
    "CORE_CRITICAL",
    (params) =>
      msgTemplates.deleteMobileAccountEmail(params.email, params.token),
  ),
  authenticateEmail: createMailerFunction(
    "authenticateEmail",
    "CORE_CRITICAL",
    (params) => msgs.authenticate_email(params.token, params.email),
  ),

  update: createMailerFunction("update", "USER_MANAGEMENT", (params) =>
    msgs.user_updated({
      firstName: params.firstName,
      lastName: params.lastName,
      updatedUserDetails: params.updatedUserDetails,
      email: params.email,
    }),
  ),
  assign: createMailerFunction("assign", "USER_MANAGEMENT", (params) =>
    msgs.user_assigned(
      params.firstName,
      params.lastName,
      params.assignedTo,
      params.email,
    ),
  ),
  updateForgottenPassword: createMailerFunction(
    "updateForgottenPassword",
    "CORE_CRITICAL",
    (params) =>
      msgs.forgotten_password_updated(
        params.firstName,
        params.lastName,
        params.email,
      ),
  ),
  updateKnownPassword: createMailerFunction(
    "updateKnownPassword",
    "CORE_CRITICAL",
    (params) =>
      msgs.known_password_updated(
        params.firstName,
        params.lastName,
        params.email,
      ),
  ),
  newMobileAppUser: createMailerFunction(
    "newMobileAppUser",
    "OPTIONAL",
    (params) => params.message, // Direct HTML content
  ),
  feedback: createMailerFunction(
    "feedback",
    "OPTIONAL",
    (params) => params.message, // Just return the message content
    // Custom mail options modifier for feedback routing
    (baseMailOptions, params) => {
      // Validate SUPPORT_EMAIL exists
      if (!constants.SUPPORT_EMAIL) {
        throw new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "Support email configuration is missing",
            missing: ["SUPPORT_EMAIL"],
          },
        );
      }

      return {
        ...baseMailOptions,
        to: constants.SUPPORT_EMAIL, // Send to support
        cc: params.email, // Copy user on their feedback
        subject: params.subject, // Use provided subject
        text: params.message, // Use text instead of HTML for feedback
        html: undefined, // Remove HTML for feedback emails
        bcc: undefined, // No BCC for feedback
        attachments: undefined, // No attachments for feedback
      };
    },
  ),
  sendReport: async (
    {
      senderEmail,
      normalizedRecepientEmails,
      pdfFile,
      csvFile,
      tenant = "airqo",
    } = {},
    next,
  ) => {
    try {
      // Add function categorization check
      if (!EMAIL_CATEGORIES.OPTIONAL.includes("sendReport")) {
        logger.warn(
          "sendReport function not properly categorized - treating as OPTIONAL",
        );
      }

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

      // ✅ STEP 2: REMOVED SENDER SUBSCRIPTION CHECK
      // The sender is initiating the report, their subscription status shouldn't block it
      // We only need to check recipient subscription status (done later)

      logText(
        `Processing report send from ${senderEmail} to ${normalizedRecepientEmails.length} recipients`,
      );

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
              tenant,
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
              },
            );
            return {
              email: recipientEmail,
              subscribed: false,
              error: error.message,
            };
          }
        },
      );

      const recipientResults = await Promise.all(recipientCheckPromises);

      // Filter subscribed recipients and handle new users
      for (const result of recipientResults) {
        if (result.subscribed) {
          subscribedRecipients.push(result.email);
        } else if (result.testBypass) {
          subscribedRecipients.push(result.email);
        } else if (result.checkResult?.status === httpStatus.NOT_FOUND) {
          // New user - create default subscription and include them
          logText(
            `Creating default subscription for new report recipient: ${result.email}`,
          );
          try {
            await SubscriptionModel(tenant).createDefaultSubscription(
              result.email,
              false,
            );
            subscribedRecipients.push(result.email);
            logText(
              `Default subscription created for ${result.email}, including in report send`,
            );
          } catch (createError) {
            logger.warn(
              `Failed to create default subscription for ${result.email}: ${createError.message}`,
            );
            // Still add them to results as non-subscribed
            emailResults.push({
              success: false,
              message: "Failed to create subscription for new user",
              data: {
                recipientEmail: result.email,
                senderEmail,
                subscriptionCreationFailed: true,
                error: createError.message,
              },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            });
          }
        } else {
          // User explicitly unsubscribed or other error
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
      }

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
              // Using default options for deduplication
            },
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
                },
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
              },
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
            },
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
        (result) => result.data?.duplicate,
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
          },
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
          summaryData,
        );

        const error = new HttpError(
          "Partial Success",
          httpStatus.MULTI_STATUS,
          {
            message: "Some report emails failed to send",
            ...summaryData,
          },
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
        },
      );

      const httpError = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "An unexpected error occurred while processing report emails",
          operation: "sendReport",
          senderEmail,
        },
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
  siteActivity: createMailerFunction("siteActivity", "OPTIONAL", (params) =>
    msgs.site_activity({
      firstName: params.firstName,
      lastName: params.lastName,
      siteActivityDetails: params.siteActivityDetails,
      email: params.email,
      activityDetails: params.activityDetails,
      deviceDetails: params.deviceDetails,
    }),
  ),
  fieldActivity: createMailerFunction("fieldActivity", "OPTIONAL", (params) =>
    msgs.field_activity({
      firstName: params.firstName,
      lastName: params.lastName,
      activityDetails: params.activityDetails,
      deviceDetails: params.deviceDetails,
      activityType: params.activityType,
      email: params.email,
    }),
  ),
  compromisedToken: createSecurityEmailFunction(
    "compromisedToken",
    (params) =>
      msgs.token_compromised({
        firstName: params.firstName,
        lastName: params.lastName,
        ip: params.ip,
        email: params.email,
      }),
    {
      cooldownDays: constants.COMPROMISED_TOKEN_COOLDOWN_DAYS,
      enableCooldown: true,
    },
  ),
  expiredToken: createSecurityEmailFunction(
    "expiredToken",
    (params) =>
      msgs.tokenExpired({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        token: params.token,
      }),
    {
      cooldownDays: constants.COMPROMISED_TOKEN_COOLDOWN_DAYS,
      enableCooldown: true,
    },
  ),
  expiringToken: createSecurityEmailFunction(
    "expiringToken",
    (params) =>
      msgs.tokenExpiringSoon({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
      }),
    {
      cooldownDays: constants.EXPIRING_TOKEN_REMINDER_DAYS,
      enableCooldown: true,
    },
  ),
  updateProfileReminder: createMailerFunction(
    "updateProfileReminder",
    "OPTIONAL",
    (params) =>
      msgs.updateProfilePrompt({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
      }),
  ),
  existingUserAccessRequest: createMailerFunction(
    "existingUserAccessRequest",
    "USER_MANAGEMENT",
    (params) =>
      msgs.existing_user({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
      }),
  ),
  existingUserRegistrationRequest: createMailerFunction(
    "existingUserRegistrationRequest",
    "USER_MANAGEMENT",
    (params) =>
      msgs.existing_user({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
      }),
  ),
  requestRejected: createMailerFunction(
    "requestRejected",
    "USER_MANAGEMENT",
    (params) =>
      msgs.requestRejected({
        firstName: params.firstName,
        email: params.email,
        entity_title: params.entity_title,
        requestType: params.requestType,
      }),
  ),

  sendPollutionAlert: createMailerFunction(
    "sendPollutionAlert",
    "OPTIONAL",
    (params) => {
      const fullName =
        `${params.firstName} ${params.lastName}`.trim() || "User";
      return constants.EMAIL_BODY({
        email: params.email,
        content: params.content,
        name: fullName,
      });
    },
  ),
  notifyOrgRequestApprovedWithOnboarding: createMailerFunction(
    "notifyOrgRequestApprovedWithOnboarding",
    "ORG_MANAGEMENT",
    (params) =>
      msgs.notifyOrgRequestApprovedWithOnboarding({
        organization_name: params.organization_name,
        contact_name: params.contact_name,
        contact_email: params.contact_email,
        onboarding_url: params.onboarding_url,
        organization_slug: params.organization_slug,
      }),
  ),

  onboardingAccountSetup: createMailerFunction(
    "onboardingAccountSetup",
    "CORE_CRITICAL",
    (params) =>
      msgs.onboardingAccountSetup({
        organization_name: params.organization_name,
        contact_name: params.contact_name,
        contact_email: params.contact_email,
        setup_url: params.setup_url,
      }),
  ),

  onboardingCompleted: createMailerFunction(
    "onboardingCompleted",
    "ORG_MANAGEMENT",
    (params) =>
      msgs.onboardingCompleted({
        organization_name: params.organization_name,
        contact_name: params.contact_name,
        contact_email: params.contact_email,
        login_url: params.login_url,
      }),
  ),
  inactiveAccount: createMailerFunction(
    "inactiveAccount",
    "OPTIONAL",
    (params) =>
      msgs.inactiveAccount({
        firstName: params.firstName,
        email: params.email,
      }),
  ),
  sendAccountDeletionConfirmation: createMailerFunction(
    "sendAccountDeletionConfirmation",
    "CORE_CRITICAL",
    (params) => {
      return msgs.accountDeletionConfirmation({
        firstName: params.firstName,
        email: params.email,
        token: params.token,
        tenant: params.tenant,
      });
    },
  ),
  sendAccountDeletionSuccess: createMailerFunction(
    "sendAccountDeletionSuccess",
    "CORE_CRITICAL",
    (params) =>
      msgs.accountDeletionSuccess({
        firstName: params.firstName,
        email: params.email,
      }),
  ),
  sendMobileAccountDeletionCode: createMailerFunction(
    "sendMobileAccountDeletionCode",
    "CORE_CRITICAL",
    (params) =>
      msgs.mobileAccountDeletionCode({
        firstName: params.firstName,
        email: params.email,
        token: params.token,
      }),
  ),
  sendBotAlert: createAdminAlertFunction(
    "sendBotAlert",
    (params) =>
      msgs.botAlert({
        recipients: params.recipients,
        ip: params.ip,
        interval: params.interval,
        occurrences: params.occurrences,
        prefix: params.prefix,
        prefixBotCount: params.prefixBotCount,
      }),
    {
      maxAlertsPerDay: constants.MAX_BOT_ALERTS_PER_DAY || 2,
    },
  ),
  sendCompromiseSummary: createSecurityEmailFunction(
    "sendCompromiseSummary",
    (params) =>
      msgs.compromiseSummary({
        email: params.email,
        compromiseDetails: params.compromiseDetails,
        count: params.count,
      }),
    {
      cooldownDays: 1, // Ensure only one summary per day
      enableCooldown: true,
    },
  ),
};

module.exports = mailer;
