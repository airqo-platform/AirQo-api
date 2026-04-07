"use strict";

const UserModel = require("@models/User");
const accessCodeGenerator = require("generate-password");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- social-auth-util`);
const { logObject } = require("@utils/shared");

/**
 * Escapes special regex characters in a string so it can be safely
 * used inside a RegExp constructor (e.g. for case-insensitive email lookup).
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts standardized user info from a Passport OAuth profile object.
 * Handles differences between provider profile shapes:
 * - Google:    profile.name.givenName/familyName, profile._json.email
 * - GitHub:    profile.displayName, profile.emails, profile.username
 * - LinkedIn:  profile.name.givenName/familyName, profile.emails
 * - Microsoft: profile.displayName, profile._json.userPrincipalName
 * - Twitter:   profile.displayName, profile.emails (if available)
 */
function extractProfileInfo(profile) {
  const json = profile._json || {};

  // ── Email extraction (provider-specific fallbacks) ─────────────────────
  const rawEmail =
    (profile.emails && profile.emails[0] && profile.emails[0].value) ||
    json.email ||
    json.userPrincipalName ||
    json.mail ||
    null;

  // Always normalize email to lowercase + trimmed to prevent duplicate
  // accounts when a provider returns a mixed-case email address.
  const email =
    rawEmail && typeof rawEmail === "string"
      ? rawEmail.toLowerCase().trim()
      : null;

  // ── First name extraction ──────────────────────────────────────────────
  const rawDisplayName =
    profile.displayName || json.name || json.displayName || "";

  const firstName =
    (profile.name && profile.name.givenName) ||
    json.given_name ||
    json.givenName ||
    (rawDisplayName ? rawDisplayName.split(" ")[0] : null) ||
    profile.username ||
    "Unknown";

  // ── Last name extraction ───────────────────────────────────────────────
  const lastName =
    (profile.name && profile.name.familyName) ||
    json.family_name ||
    json.surname ||
    json.familyName ||
    (rawDisplayName && rawDisplayName.split(" ").length > 1
      ? rawDisplayName.split(" ").slice(1).join(" ")
      : null) ||
    "";

  // ── Provider-specific ID ───────────────────────────────────────────────
  const providerId = profile.id || profile._id || json.sub || json.id || null;

  return { email, firstName, lastName, providerId };
}

/**
 * Maps a provider name to the corresponding UserSchema field name.
 * e.g. "google" → "google_id", "github" → "github_id"
 */
function providerIdField(provider) {
  return `${String(provider).toLowerCase()}_id`;
}

/**
 * Handles the OAuth profile returned by Passport after a successful provider
 * authentication. Finds or creates the user, links the social ID, and returns
 * the user document.
 *
 * Supports: google, github, linkedin, microsoft, twitter
 *
 * @param {object} profile  - The Passport profile object from the OAuth strategy.
 * @param {string} tenant   - The tenant identifier.
 * @param {string} provider - The OAuth provider name (e.g. "google", "github").
 * @returns {Promise<object>} { success, user, message, isNew }
 */
async function handleOAuthProfile(profile, tenant, provider = "google") {
  try {
    const { email, firstName, lastName, providerId } =
      extractProfileInfo(profile);

    if (!email) {
      logger.error(
        `handleOAuthProfile: no email returned by provider "${provider}" ` +
          `for profile id ${providerId || "unknown"}`,
      );
      return {
        success: false,
        message:
          `Your ${provider} account did not return an email address. ` +
          `Please ensure your ${provider} account has a verified public ` +
          `email and try again.`,
      };
    }

    const dbTenant = String(tenant).toLowerCase();
    const idField = providerIdField(provider);

    // ── STEP 1: Case-insensitive email lookup ────────────────────────────
    // The User model normalizes emails to lowercase on save, but provider
    // profiles may return mixed-case. Using a case-insensitive regex prevents
    // duplicate accounts when casing differs.
    const emailRegex = new RegExp(`^${escapeRegex(email)}$`, "i");
    let user = await UserModel(dbTenant)
      .findOne({ email: { $regex: emailRegex } })
      .exec();

    if (user) {
      // ── STEP 2a: User exists — link provider ID if not already stored ─
      if (providerId && !user[idField]) {
        try {
          await UserModel(dbTenant).findByIdAndUpdate(user._id, {
            $set: { [idField]: providerId },
          });
          user[idField] = providerId;
          logger.info(
            `handleOAuthProfile: linked ${idField}=${providerId} to ` +
              `existing user ${user.email}`,
          );
        } catch (linkError) {
          // Non-fatal — user can still log in
          logger.warn(
            `handleOAuthProfile: could not link ${idField} for user ` +
              `${user.email}: ${linkError.message}`,
          );
        }
      }

      logger.info(
        `handleOAuthProfile: existing user authenticated via ` +
          `${provider}: ${user.email}`,
      );
      return {
        success: true,
        user,
        isNew: false,
        message: "Existing user authenticated via OAuth",
      };
    }

    // ── STEP 3: No existing user — create a new account ─────────────────
    logger.info(
      `handleOAuthProfile: creating new user from ${provider} ` +
        `profile: ${email}`,
    );

    const newUserPayload = {
      [idField]: providerId,
      firstName,
      lastName: lastName || "Unknown",
      email, // already normalized to lowercase
      userName: email,
      verified: true, // OAuth email is already verified by the provider
      password: accessCodeGenerator.generate(
        constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH || 10),
      ),
    };

    // ── Optional extra fields from the profile ───────────────────────────
    const json = profile._json || {};

    if (json.hd) newUserPayload.website = json.hd;

    if (profile.photos && profile.photos[0] && profile.photos[0].value) {
      newUserPayload.profilePicture = profile.photos[0].value;
    } else if (json.avatar_url) {
      newUserPayload.profilePicture = json.avatar_url;
    } else if (json.profile_image_url) {
      newUserPayload.profilePicture = json.profile_image_url;
    } else if (json.picture) {
      newUserPayload.profilePicture = json.picture;
    }

    if (provider === "github" && profile.username) {
      newUserPayload.website =
        newUserPayload.website || `https://github.com/${profile.username}`;
    }

    const registerResult = await UserModel(dbTenant).register(
      newUserPayload,
      () => {},
    );

    if (!registerResult || registerResult.success === false) {
      logger.error(
        `handleOAuthProfile: failed to create user from ${provider} ` +
          `profile: ${(registerResult && registerResult.message) || "unknown error"}`,
      );
      return {
        success: false,
        message:
          (registerResult && registerResult.message) ||
          `Failed to create user account from ${provider} profile`,
        errors: registerResult && registerResult.errors,
      };
    }

    logger.info(
      `handleOAuthProfile: new user created from ${provider} ` +
        `profile: ${email}`,
    );
    return {
      success: true,
      user: registerResult.data,
      isNew: true,
      message: "New user account created via OAuth",
    };
  } catch (error) {
    logger.error(
      `🐛🐛 handleOAuthProfile Internal Server Error [${provider}]: ` +
        `${error.message}`,
    );
    return {
      success: false,
      message: "Internal Server Error in handleOAuthProfile",
      errors: { message: error.message },
    };
  }
}

module.exports = { handleOAuthProfile, extractProfileInfo, providerIdField };
