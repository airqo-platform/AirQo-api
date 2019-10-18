const devConfig = {
    MONGO_URL: 'mongodb://localhost/airqo-registry-dev',
    JWT_SECRET: 'thisisasecret'
};
const testConfig = {
    MONGO_URL: 'mongodb://localhost/airqo-registry-test',
    JWT_SECRET: 'thisisasecret'
};
const prodConfig = {
    MONGO_URL: 'mongodb://localhost/airqo-registry-prod',
    JWT_SECRET: 'thisisasecret'
};
const defaultConfig = {
    PORT: process.env.PORT || 3000,
};

function envConfig(env) {
    switch (env) {
        case 'development':
            return devConfig;
        case 'test':
            return testConfig;
        default:
            return prodConfig;
    }
}

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV), };
