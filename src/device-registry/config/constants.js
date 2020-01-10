const devConfig = {
    MONGO_URL: 'mongodb://localhost/airqo-registry-dev',
    JWT_SECRET: 'thisisasecret',
    REGION: 'europe-west1',
    MQTT_BRIDGE_HOST_NAME: 'mqtt.googleapis.com',
    MQTT_BRIDGE_PORT: 8883,
    NUM_MESSAGES: 5,
    TOKEN_EXP_MINS: 360,
    ALGORITHM: 'RS256',
    HTTP_BRIDGE_ADDRESS: 'cloudiotdevice.googleapis.com',
    MESSAGE_TYPE: 'events',
    MINIMUM_BACKOFF_TIME: 1,
    MAXIMUM_BACKOFF_TIME: 32
};
const testConfig = {
    MONGO_URL: 'mongodb://localhost/airqo-registry-test',
    JWT_SECRET: 'thisisasecret',
    REGION: 'europe-west1',
    MQTT_BRIDGE_HOST_NAME: 'mqtt.googleapis.com',
    MQTT_BRIDGE_PORT: 8883,
    NUM_MESSAGES: 5,
    TOKEN_EXP_MINS: 360,
    ALGORITHM: 'RS256',
    HTTP_BRIDGE_ADDRESS: 'cloudiotdevice.googleapis.com',
    MESSAGE_TYPE: 'events',
    MINIMUM_BACKOFF_TIME: 1,
    MAXIMUM_BACKOFF_TIME: 32
};
const prodConfig = {
    MONGO_URL: 'mongodb://localhost/airqo-registry-prod',
    JWT_SECRET: 'thisisasecret',
    REGION: 'europe-west1',
    MQTT_BRIDGE_HOST_NAME: 'mqtt.googleapis.com',
    MQTT_BRIDGE_PORT: 8883,
    NUM_MESSAGES: 5,
    TOKEN_EXP_MINS: 360,
    ALGORITHM: 'RS256',
    HTTP_BRIDGE_ADDRESS: 'cloudiotdevice.googleapis.com',
    MESSAGE_TYPE: 'events',
    MINIMUM_BACKOFF_TIME: 1,
    MAXIMUM_BACKOFF_TIME: 32
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
