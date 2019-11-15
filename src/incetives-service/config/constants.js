const devConfig = {
    MONGO_URL: 'mongodb://localhost/incentives-devs',
    JWT_SECRET: 'thisisasecret'
};
const testConfig = {
    MONGO_URL: 'mongodb://localhost/incentives-test',
    JWT_SECRET: 'thisisasecret'
};
const prodConfig = {
    MONGO_URL: `mongodb://${process.env.MLAB_USER}:${process.env.MLAB_PASSWORD}@ds021356.mlab.com:21356/airqo-incentives`,
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
