const devConfig = {
    MONGO_URL: 'mongodb://localhost/incentives-devs',
    JWT_SECRET: 'thisisasecret',
    MOMO_URL_DISBURSEMENTS: "https://sandbox.momodeveloper.mtn.com/disbursement"
};
const testConfig = {
    MONGO_URL: 'mongodb://localhost/incentives-test',
    JWT_SECRET: 'thisisasecret',
    MOMO_URL_DISBURSEMENTS: "https://sandbox.momodeveloper.mtn.com/disbursement"
};
const prodConfig = {
    MONGO_URL: process.env.MLAB_URI,
    JWT_SECRET: 'thisisasecret',
    MOMO_URL_DISBURSEMENTS: "https://sandbox.momodeveloper.mtn.com/disbursement"
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
