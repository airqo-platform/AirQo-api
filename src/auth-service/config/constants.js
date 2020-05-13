const { Bigtable } = require("@google-cloud/bigtable");
const bigtableClient = new Bigtable();
const instance = bigtableClient.instance(process.env.INSTANCE_ID);

const devConfig = {
    MONGO_URI: "mongodb://localhost/airqo-auth-dev",
    JWT_SECRET: process.env.JWT_SECRET,
    CLIENT_ORIGIN: "https://airqo.net/",
    BCRYPT_SALT_ROUNDS: 12,
    BIGTABLE_INSTANCE: instance,
    USERS_BT: "Users",
    COLUMN_FAMILY_ID: "cf1",
    COLUMN_QUALIFIER: "greeting",
};
const testConfig = {
    MONGO_URI: "mongodb://localhost/airqo-auth-test",
    JWT_SECRET: process.env.JWT_SECRET,
    CLIENT_ORIGIN: "https://airqo.net/",
    BCRYPT_SALT_ROUNDS: 12,
    BIGTABLE_INSTANCE: instance,
    USERS_BT: "Users",
    COLUMN_FAMILY_ID: "cf1",
    COLUMN_QUALIFIER: "greeting",
};
const prodConfig = {
    MONGO_URI: process.env.ATLAS_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    CLIENT_ORIGIN: "https://airqo.net/",
    BCRYPT_SALT_ROUNDS: 12,
    BIGTABLE_INSTANCE: instance,
    USERS_BT: "Users",
    COLUMN_FAMILY_ID: "cf1",
    COLUMN_QUALIFIER: "greeting",
};
const defaultConfig = {
    PORT: process.env.PORT || 3000,
};

function envConfig(env) {
    switch (env) {
        case "development":
            return devConfig;
        case "test":
            return testConfig;
        default:
            return prodConfig;
    }
}

module.exports = {
    ...defaultConfig,
    ...envConfig(process.env.NODE_ENV),
};