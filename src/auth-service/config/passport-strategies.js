"use strict";

const crypto = require("crypto");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const {
  Strategy: OAuth2Strategy,
  InternalOAuthError,
} = require("passport-oauth2");
const constants = require("@config/constants");
const { handleOAuthProfile } = require("@utils/social-auth.util");
const { logObject } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- passport-strategies`,
);

/**
 * Stateless OAuth 2.0 CSRF state store backed by HMAC-signed cookies.
 *
 * Replaces passport-oauth2's default session-based StateStore so that
 * the OAuth redirect round-trip has zero dependence on Redis or MongoDB.
 * The state is signed with SESSION_SECRET (timing-safe comparison on
 * verify) and stored in a short-lived HttpOnly cookie. Works correctly
 * across any number of pods with no shared session store.
 *
 * Implements the passport-oauth2 v1.8.0 four-argument store/verify API
 * (arity-detected by the framework).
 */
class CookieStateStore {
  constructor({ secret, cookieName, ttlSeconds = 600 } = {}) {
    if (!secret) throw new Error("CookieStateStore: secret is required");
    this._secret = secret;
    this._cookieName = cookieName || "_oauth2_state";
    this._ttl = ttlSeconds;
  }

  // Called by passport-oauth2 before redirecting to the provider.
  // The store is responsible for generating the state value — passport-oauth2
  // passes state=undefined here (it only pre-generates state when options.state
  // is an explicit string). The generated value must be returned via
  // callback(null, value) so passport-oauth2 can include it in the redirect URL.
  store(req, state, meta, callback) {
    const value = crypto.randomBytes(12).toString("hex");
    const signed = this._sign(value);
    const res = req.res;
    if (!res) {
      return callback(new Error("CookieStateStore: response object unavailable on req.res"));
    }
    res.cookie(this._cookieName, signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // allows cookie on top-level GET from provider redirect
      maxAge: this._ttl * 1000,
      path: "/",
    });
    callback(null, value);
  }

  // Called by passport-oauth2 on the callback to verify CSRF state.
  verify(req, state, meta, callback) {
    const signedCookie = req.cookies && req.cookies[this._cookieName];
    if (!signedCookie) {
      logger.warn(
        `[CookieStateStore] state cookie "${this._cookieName}" missing — ` +
          "possible CSRF attempt or browser cookie policy blocked the cookie",
      );
      return callback(null, false, { message: "OAuth state cookie missing" });
    }

    const storedState = this._unsign(signedCookie);
    if (!storedState) {
      return callback(null, false, { message: "OAuth state cookie signature invalid" });
    }

    // One-time use: clear the cookie immediately after reading.
    if (req.res) req.res.clearCookie(this._cookieName, { path: "/" });

    // Constant-time comparison guards against timing attacks.
    if (!this._safeEqual(state, storedState)) {
      return callback(null, false, { message: "OAuth state mismatch" });
    }

    callback(null, true);
  }

  _sign(value) {
    const sig = crypto
      .createHmac("sha256", this._secret)
      .update(value)
      .digest("base64url");
    return `${value}.${sig}`;
  }

  _unsign(signedValue) {
    const sep = signedValue.lastIndexOf(".");
    if (sep === -1) return null;
    const value = signedValue.substring(0, sep);
    const sig = signedValue.substring(sep + 1);
    try {
      const expected = crypto
        .createHmac("sha256", this._secret)
        .update(value)
        .digest("base64url");
      const sBuf = Buffer.from(sig, "base64url");
      const eBuf = Buffer.from(expected, "base64url");
      if (sBuf.length !== eBuf.length) return null;
      if (!crypto.timingSafeEqual(sBuf, eBuf)) return null;
      return value;
    } catch {
      return null;
    }
  }

  _safeEqual(a, b) {
    try {
      const aBuf = Buffer.from(a);
      const bBuf = Buffer.from(b);
      if (aBuf.length !== bBuf.length) return false;
      return crypto.timingSafeEqual(aBuf, bBuf);
    } catch {
      return false;
    }
  }
}

// ── LinkedIn OIDC Strategy ────────────────────────────────────────────────────
// passport-linkedin-oauth2 v2 calls the deprecated /v2/me and /v2/emailAddress
// endpoints which require r_liteprofile / r_emailaddress scopes. LinkedIn's
// Standard Tier only grants OIDC scopes (openid profile email). This class
// uses passport-oauth2 directly and calls /oidc/v2/userinfo instead.
class LinkedInOIDCStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    options.authorizationURL =
      "https://www.linkedin.com/oauth/v2/authorization";
    options.tokenURL = "https://www.linkedin.com/oauth/v2/accessToken";
    super(options, verify);
    this.name = "linkedin";
  }

  userProfile(accessToken, done) {
    this._oauth2.get(
      "https://api.linkedin.com/oidc/v2/userinfo",
      accessToken,
      (err, body) => {
        if (err) {
          return done(
            new InternalOAuthError("failed to fetch LinkedIn userinfo", err),
          );
        }
        try {
          const json = JSON.parse(body);
          const profile = {
            provider: "linkedin",
            id: json.sub,
            displayName: json.name || "",
            name: {
              givenName: json.given_name || "",
              familyName: json.family_name || "",
            },
            emails: json.email ? [{ value: json.email }] : [],
            photos: json.picture ? [{ value: json.picture }] : [],
            _raw: body,
            _json: json,
          };
          done(null, profile);
        } catch (e) {
          done(
            new InternalOAuthError(
              "failed to parse LinkedIn userinfo response",
              e,
            ),
          );
        }
      },
    );
  }
}

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
          store: new CookieStateStore({
            secret: constants.SESSION_SECRET,
            cookieName: "_oauth2_state_google",
          }),
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
          store: new CookieStateStore({
            secret: constants.SESSION_SECRET,
            cookieName: "_oauth2_state_github",
          }),
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
      passport.use(
        "linkedin",
        new LinkedInOIDCStrategy(
          {
            clientID: constants.LINKEDIN_CLIENT_ID,
            clientSecret: constants.LINKEDIN_CLIENT_SECRET,
            callbackURL: buildCallbackURL("linkedin"),
            scope: ["openid", "profile", "email"],
            passReqToCallback: true,
            store: new CookieStateStore({
              secret: constants.SESSION_SECRET,
              cookieName: "_oauth2_state_linkedin",
            }),
          },
          makeStrategyCallback(
            "linkedin",
            "Your LinkedIn account did not return an email address. " +
              "Please ensure your LinkedIn account has a verified primary email.",
          ),
        ),
      );
      logger.info("✅ LinkedIn OIDC strategy configured");
    } catch (e) {
      logger.warn(
        `⚠️  LinkedIn OIDC strategy skipped: failed to configure — ${e.message}`,
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
            store: new CookieStateStore({
              secret: constants.SESSION_SECRET,
              cookieName: "_oauth2_state_microsoft",
            }),
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
        `⚠️  Microsoft OAuth strategy skipped: failed to load passport-microsoft — ${e.message}`,
      );
    }
  } else {
    logger.warn(
      "⚠️  Microsoft OAuth strategy skipped: MICROSOFT_CLIENT_ID or " +
        "MICROSOFT_CLIENT_SECRET not set",
    );
  }

  // ── Twitter / X ──────────────────────────────────────────────────────────
  // CVE-2021-21366 (xmldom): mitigated via the "overrides.xmldom" entry in
  // package.json which pins xmldom to 0.6.0 across the entire dependency
  // tree, including passport-twitter → xtraverse → xmldom.
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
        `⚠️  Twitter OAuth strategy skipped: failed to load passport-twitter — ${e.message}`,
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

module.exports = {
  configureStrategies,
  buildCallbackURL,
  CookieStateStore,
  LinkedInOIDCStrategy,
};
