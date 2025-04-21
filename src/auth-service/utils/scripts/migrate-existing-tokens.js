const ScopeModel = require("@models/Scope");
const UserModel = require("@models/User");
const AccessTokenModel = require("@models/AccessToken");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- migrate-existing-tokens`
);

async function migrateExistingTokens() {
  const users = await UserModel("airqo").find({});

  for (const user of users) {
    // Set default tier if not set
    if (!user.subscriptionTier) {
      user.subscriptionTier = "Free";
      await user.save();
    }

    // Update user's tokens
    const tokens = await AccessTokenModel("airqo").find({
      user_id: user._id,
    });

    for (const token of tokens) {
      // Get scopes for the user's tier
      const scopes = await ScopeModel("airqo")
        .find({ tier: user.subscriptionTier })
        .select("scope");

      const scopeNames = scopes.map((scope) => scope.scope);

      // Update token
      token.scopes = scopeNames;
      token.tier = user.subscriptionTier;
      await token.save();
    }
  }

  console.log("Migration completed");
}

migrateExistingTokens();
