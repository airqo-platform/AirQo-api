"use strict";

const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const constants = require("@config/constants");
const { handleOAuthProfile } = require("@utils/social-auth.util");
const { logObject } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- passport-strategies`,
);

// ── Strategy registration guard ───────────────────────────────────────────────
// Strategies are registered once at startup (bin/server.js). This flag
// prevents re-registration on every OAuth request when setGoogleAuth and
// setOAuthProvider call configureStrategies per-request as a fallback.
// Boolean rather than per-tenant Set: strategy credentials are identical
// across all tenants; tenant is resolved at runtime from the session.
let strategiesConfigured = false;

/**
 * Builds the full callback URL for a given provider.
 * Trims any trailing slash from PLATFORM_BASE_URL to prevent double-slash URLs.
 */
function buildCallbackURL(provider) {
  const base = (constants.PLATFORM_BASE_URL || "").replace(/\/+$/, "");
  const url = `${base}/api/v2/users/auth/callback/${provider}`;
  logger.info(`[passport-strategies] callbackURL for ${provider}: ${url}`);
  return url;
}

/**
 * Resolves the tenant for a given OAuth callback request.
 *
 * Tenant resolution priority:
 *   1. req.session.oauthTenant — set by setGoogleAuth/setOAuthProvider before
 *      the redirect to the provider. This is the only value present on the
 *      callback request because the provider does not preserve query params.
 *   2. req.query.tenant — present on the initiation request, not the callback.
 *      Kept as a fallback for any direct calls that bypass the session.
 *   3. constants.DEFAULT_TENANT / "airqo" — final safety net.
 *
 * @param {object} req - Express request object
 * @returns {string} Resolved tenant string
 */
function resolveTenant(req) {
  return (
    (req && req.session && req.session.oauthTenant) ||
    (req && req.query && req.query.tenant) ||
    constants.DEFAULT_TENANT ||
    "airqo"
  );
}

/**
 * Shared strategy callback factory.
 * Resolves tenant dynamically at runtime from the session (set before the
 * OAuth redirect) so multi-tenant requests are handled correctly even though
 * the provider does not preserve query parameters across the round-trip.
 *
 * Logs only non-PII identifiers (provider name + profile.id).
 *
 * @param {string} provider               - Provider name e.g. "google", "github"
 * @param {string} [emailRequiredMessage] - Custom error when no email returned
 */
function makeStrategyCallback(provider, emailRequiredMessage) {
  return async (req, accessToken, refreshToken, profile, cb) => {
    try {
      // Resolve tenant from session (persisted before redirect) with
      // fallbacks. Clear the session value after reading so it does not
      // bleed into subsequent requests on the same session.
      const tenant = resolveTenant(req);
      if (req && req.session && req.session.oauthTenant) {
        delete req.session.oauthTenant;
      }

      logger.info(`[passport-strategies] ${provider} OAuth callback received`, {
        provider,
        profileId: profile.id || "unknown",
        tenant,
      });

      const email =
        (profile.emails && profile.emails[0] && profile.emails[0].value) ||
        (profile._json && profile._json.email) ||
        (profile._json && profile._json.userPrincipalName) ||
        null;

      if (!email) {
        const message =
          emailRequiredMessage ||
          `Your ${provider} account does not have a verified email address. ` +
            `Please add one to your ${provider} account and try again.`;
        logger.error(
          `[passport-strategies] ${provider} OAuth: no email returned`,
          { provider, profileId: profile.id || "unknown" },
        );
        return cb(new Error(message), false);
      }

      const result = await handleOAuthProfile(profile, tenant, provider);

      if (!result.success) {
        logger.error(
          `[passport-strategies] ${provider} OAuth profile handling failed: ` +
            `${result.message}`,
        );
        return cb(
          new Error(result.message || `${provider} authentication failed`),
          false,
        );
      }

      return cb(null, result.user);
    } catch (error) {
      logger.error(
        `[passport-strategies] Unhandled error in ${provider} strategy ` +
          `callback: ${error.message}`,
      );
      return cb(error, false);
    }
  };
}

/**
 * Configures all supported OAuth strategies on the supplied passport instance.
 *
 * Safe to call multiple times — strategies are only registered once per
 * process lifetime. Subsequent calls are silent no-ops (logged at DEBUG).
 *
 * Should be called once at startup in bin/server.js after
 * app.use(passport.initialize()).
 *
 * @param {object} passport - The passport instance.
 * @param {string} [tenant] - Ignored internally; kept for backward compatibility
 *                            with existing callers in passport.js.
 */
function configureStrategies(passport, tenant) {
  if (strategiesConfigured) {
    // Use debug level to avoid log noise on every request since
    // setGoogleAuth/setOAuthProvider still call this per-request.
    logger.debug(
      "[passport-strategies] strategies already configured — skipping",
    );
    return;
  }

  logger.info("[passport-strategies] configuring OAuth strategies");

  // ── Google ──────────────────────────────────────────────────────────────
  if (constants.GOOGLE_CLIENT_ID && constants.GOOGLE_CLIENT_SECRET) {
    passport.use(
      "google",
      new GoogleStrategy(
        {
          clientID: constants.GOOGLE_CLIENT_ID,
          clientSecret: constants.GOOGLE_CLIENT_SECRET,
          callbackURL: buildCallbackURL("google"),
          passReqToCallback: true,
          state: true,
        },
        makeStrategyCallback("google"),
      ),
    );
    logger.info("✅ Google OAuth strategy configured");
  } else {
    logger.warn(
      "⚠️  Google OAuth strategy skipped: GOOGLE_CLIENT_ID or " +
        "GOOGLE_CLIENT_SECRET not set",
    );
  }

  // ── GitHub ───────────────────────────────────────────────────────────────
  if (constants.GITHUB_CLIENT_ID && constants.GITHUB_CLIENT_SECRET) {
    passport.use(
      "github",
      new GitHubStrategy(
        {
          clientID: constants.GITHUB_CLIENT_ID,
          clientSecret: constants.GITHUB_CLIENT_SECRET,
          callbackURL: buildCallbackURL("github"),
          scope: ["user:email"],
          passReqToCallback: true,
          state: true,
        },
        makeStrategyCallback(
          "github",
          "Your GitHub account does not have a verified public email. " +
            "Please add one at github.com/settings/emails and try again.",
        ),
      ),
    );
    logger.info("✅ GitHub OAuth strategy configured");
  } else {
    logger.warn(
      "⚠️  GitHub OAuth strategy skipped: GITHUB_CLIENT_ID or " +
        "GITHUB_CLIENT_SECRET not set",
    );
  }

  // ── LinkedIn ─────────────────────────────────────────────────────────────
  if (constants.LINKEDIN_CLIENT_ID && constants.LINKEDIN_CLIENT_SECRET) {
    try {
      const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
      passport.use(
        "linkedin",
        new LinkedInStrategy(
          {
            clientID: constants.LINKEDIN_CLIENT_ID,
            clientSecret: constants.LINKEDIN_CLIENT_SECRET,
            callbackURL: buildCallbackURL("linkedin"),
            scope: ["r_emailaddress", "r_liteprofile"],
            passReqToCallback: true,
            state: true,
          },
          makeStrategyCallback(
            "linkedin",
            "Your LinkedIn account did not return an email address. " +
              "Please ensure your LinkedIn account has a verified primary email.",
          ),
        ),
      );
      logger.info("✅ LinkedIn OAuth strategy configured");
    } catch (e) {
      logger.warn(
        "⚠️  LinkedIn OAuth strategy skipped: passport-linkedin-oauth2 " +
          "not installed. Run: npm install passport-linkedin-oauth2",
      );
    }
  } else {
    logger.warn(
      "⚠️  LinkedIn OAuth strategy skipped: LINKEDIN_CLIENT_ID or " +
        "LINKEDIN_CLIENT_SECRET not set",
    );
  }

  // ── Microsoft ────────────────────────────────────────────────────────────
  if (constants.MICROSOFT_CLIENT_ID && constants.MICROSOFT_CLIENT_SECRET) {
    try {
      const MicrosoftStrategy = require("passport-microsoft").Strategy;
      passport.use(
        "microsoft",
        new MicrosoftStrategy(
          {
            clientID: constants.MICROSOFT_CLIENT_ID,
            clientSecret: constants.MICROSOFT_CLIENT_SECRET,
            callbackURL: buildCallbackURL("microsoft"),
            scope: ["user.read"],
            tenant: "common",
            passReqToCallback: true,
            state: true,
          },
          makeStrategyCallback(
            "microsoft",
            "Your Microsoft account did not return an email address. " +
              "Please ensure your Microsoft account has a verified email.",
          ),
        ),
      );
      logger.info("✅ Microsoft OAuth strategy configured");
    } catch (e) {
      logger.warn(
        "⚠️  Microsoft OAuth strategy skipped: passport-microsoft not " +
          "installed. Run: npm install passport-microsoft",
      );
    }
  } else {
    logger.warn(
      "⚠️  Microsoft OAuth strategy skipped: MICROSOFT_CLIENT_ID or " +
        "MICROSOFT_CLIENT_SECRET not set",
    );
  }

  // ── Twitter / X ──────────────────────────────────────────────────────────
  // NOTE: passport-twitter pulls in xmldom@0.1.31 (CVE-2021-21366).
  // Only enable once the transitive dependency risk has been assessed.
  if (constants.TWITTER_CONSUMER_KEY && constants.TWITTER_CONSUMER_SECRET) {
    try {
      const TwitterStrategy = require("passport-twitter").Strategy;
      passport.use(
        "twitter",
        new TwitterStrategy(
          {
            consumerKey: constants.TWITTER_CONSUMER_KEY,
            consumerSecret: constants.TWITTER_CONSUMER_SECRET,
            callbackURL: buildCallbackURL("twitter"),
            includeEmail: true,
            passReqToCallback: true,
            // Twitter OAuth 1.0a handles state/CSRF natively via
            // oauth_token — state: true is OAuth2-only, not set here.
          },
          makeStrategyCallback(
            "twitter",
            "Your Twitter/X account did not return an email address. " +
              "Please add a verified email to your Twitter account and try again.",
          ),
        ),
      );
      logger.info("✅ Twitter OAuth strategy configured");
    } catch (e) {
      logger.warn(
        "⚠️  Twitter OAuth strategy skipped: passport-twitter not installed. " +
          "Run: npm install passport-twitter",
      );
    }
  } else {
    logger.warn(
      "⚠️  Twitter OAuth strategy skipped: TWITTER_CONSUMER_KEY or " +
        "TWITTER_CONSUMER_SECRET not set",
    );
  }

  // ── Serialize / Deserialize ──────────────────────────────────────────────
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser(async (user, done) => {
    try {
      const UserModel = require("@models/User");
      const dbTenant =
        (user && user.tenant) || constants.DEFAULT_TENANT || "airqo";
      const freshUser = await UserModel(dbTenant).findById(user._id);
      done(null, freshUser);
    } catch (error) {
      done(error, null);
    }
  });

  // Mark as configured — placed last so a partial failure during strategy
  // registration does not incorrectly mark the process as done.
  strategiesConfigured = true;
  logger.info(
    "[passport-strategies] all OAuth strategies configured successfully",
  );
}

module.exports = { configureStrategies, buildCallbackURL };
