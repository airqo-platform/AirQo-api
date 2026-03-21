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

/**
 * Builds the full callback URL for a given provider.
 * Trims any trailing slash from PLATFORM_BASE_URL to prevent double-slash
 * URLs e.g. "http://localhost:3000//api/v2/users/auth/callback/google".
 */
function buildCallbackURL(provider) {
  const base = (constants.PLATFORM_BASE_URL || "").replace(/\/+$/, "");
  const url = `${base}/api/v2/users/auth/callback/${provider}`;
  logger.info(`[passport-strategies] callbackURL for ${provider}: ${url}`);
  return url;
}

/**
 * Shared strategy callback factory.
 * Avoids repeating the same try/catch/handleOAuthProfile pattern for every
 * provider. Logs only non-PII identifiers (provider name + profile.id) to
 * prevent personal data leaking into log files.
 *
 * @param {string} provider              - Provider name e.g. "google", "github"
 * @param {string} tenant                - Tenant identifier
 * @param {string} [emailRequiredMessage]- Custom error when no email is returned
 */
function makeStrategyCallback(provider, tenant, emailRequiredMessage) {
  return async (req, accessToken, refreshToken, profile, cb) => {
    try {
      // Log only non-PII identifiers — never dump profile._json which
      // contains email, name, avatar and other personal fields.
      logger.info(`[passport-strategies] ${provider} OAuth callback received`, {
        provider,
        profileId: profile.id || "unknown",
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
 * Each strategy is only registered if its credentials are present in constants.
 * state: true is set on all OAuth2 strategies to enable Passport's built-in
 * CSRF/state parameter validation.
 *
 * Currently supported: google, github, linkedin, microsoft, twitter
 *
 * @param {object} passport - The passport instance.
 * @param {string} tenant   - The tenant identifier (e.g. "airqo").
 */
function configureStrategies(passport, tenant) {
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
        makeStrategyCallback("google", tenant),
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
          tenant,
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
  // Requires: npm install passport-linkedin-oauth2
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
            tenant,
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
  // Requires: npm install passport-microsoft
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
            tenant,
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
  // Requires: npm install passport-twitter
  // NOTE: passport-twitter pulls in xmldom@0.1.31 which has a known CVE
  // (CVE-2021-21366). Twitter support is included here but should only be
  // enabled in production once the transitive dependency risk has been
  // assessed or resolved via an npm override.
  // Email access also requires elevated Twitter app permissions.
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
            // Twitter OAuth 1.0a handles state/CSRF natively via oauth_token
            // — state: true is an OAuth2-only option and is not set here.
          },
          makeStrategyCallback(
            "twitter",
            tenant,
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

  // ── Serialize / Deserialize (shared across all strategies) ───────────────
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser(async (user, done) => {
    try {
      const UserModel = require("@models/User");
      const dbTenant = String(tenant).toLowerCase();
      const freshUser = await UserModel(dbTenant).findById(user._id);
      done(null, freshUser);
    } catch (error) {
      done(error, null);
    }
  });
}

module.exports = { configureStrategies, buildCallbackURL };
