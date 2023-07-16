require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const config = require("@config/constants");

describe("config", () => {
  let envStub;

  beforeEach(() => {
    envStub = sinon.stub(process, "env");
  });

  afterEach(() => {
    envStub.restore();
  });

  it("should return the default configuration", () => {
    envStub.NODE_ENV = undefined;

    const result = config;

    expect(result).to.deep.equal({
      NETWORKS: [],
      SLACK_TOKEN: undefined,
      SLACK_CHANNEL: undefined,
      SLACK_USERNAME: undefined,
      PORT: 3000,
      JWT_SECRET: "thisisasecret",
      MTN_MOMO_URL_DISBURSEMENTS:
        "https://sandbox.momodeveloper.mtn.com/disbursement",
      PHONE_NUMBER: undefined,
      MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_SECONDARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_SECRET: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_ID: undefined,
      MTN_MOMO_DISBURSEMENTS_CALLBACK_HOST: undefined,
      MTN_MOMO_DISBURSEMENTS_PROVIDER_CALLBACK_HOST: undefined,
      MONGO_URI: "mongodb://localhost/",
      DB_NAME: undefined,
      REDIS_SERVER: undefined,
      REDIS_PORT: undefined,
    });
  });

  it("should return the development configuration", () => {
    envStub.NODE_ENV = "development";
    envStub.MONGO_DEV = "testdb";
    envStub.REDIS_SERVER_DEV = "redis-server-dev";
    envStub.REDIS_PORT = "6379";

    const result = config;

    expect(result).to.deep.equal({
      NETWORKS: [],
      SLACK_TOKEN: undefined,
      SLACK_CHANNEL: undefined,
      SLACK_USERNAME: undefined,
      PORT: 3000,
      JWT_SECRET: "thisisasecret",
      MTN_MOMO_URL_DISBURSEMENTS:
        "https://sandbox.momodeveloper.mtn.com/disbursement",
      PHONE_NUMBER: undefined,
      MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_SECONDARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_SECRET: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_ID: undefined,
      MTN_MOMO_DISBURSEMENTS_CALLBACK_HOST: undefined,
      MTN_MOMO_DISBURSEMENTS_PROVIDER_CALLBACK_HOST: undefined,
      MONGO_URI: "mongodb://localhost/",
      DB_NAME: "testdb",
      REDIS_SERVER: "redis-server-dev",
      REDIS_PORT: "6379",
    });
  });

  it("should return the stage configuration", () => {
    envStub.NODE_ENV = "test";
    envStub.MONGO_GCE_URI = "stage-db-uri";
    envStub.REDIS_SERVER = "redis-server";
    envStub.REDIS_PORT = "6379";

    const result = config;

    expect(result).to.deep.equal({
      NETWORKS: [],
      SLACK_TOKEN: undefined,
      SLACK_CHANNEL: undefined,
      SLACK_USERNAME: undefined,
      PORT: 3000,
      JWT_SECRET: "thisisasecret",
      MTN_MOMO_URL_DISBURSEMENTS:
        "https://sandbox.momodeveloper.mtn.com/disbursement",
      PHONE_NUMBER: undefined,
      MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_SECONDARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_SECRET: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_ID: undefined,
      MTN_MOMO_DISBURSEMENTS_CALLBACK_HOST: undefined,
      MTN_MOMO_DISBURSEMENTS_PROVIDER_CALLBACK_HOST: undefined,
      MONGO_URI: "stage-db-uri",
      DB_NAME: undefined,
      REDIS_SERVER: "redis-server",
      REDIS_PORT: "6379",
    });
  });

  it("should return the production configuration", () => {
    envStub.NODE_ENV = "production";
    envStub.MONGO_GCE_URI = "prod-db-uri";
    envStub.REDIS_SERVER = "redis-server";
    envStub.REDIS_PORT = "6379";

    const result = config;

    expect(result).to.deep.equal({
      NETWORKS: [],
      SLACK_TOKEN: undefined,
      SLACK_CHANNEL: undefined,
      SLACK_USERNAME: undefined,
      PORT: 3000,
      JWT_SECRET: "thisisasecret",
      MTN_MOMO_URL_DISBURSEMENTS:
        "https://sandbox.momodeveloper.mtn.com/disbursement",
      PHONE_NUMBER: undefined,
      MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_SECONDARY_KEY: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_SECRET: undefined,
      MTN_MOMO_DISBURSEMENTS_USER_ID: undefined,
      MTN_MOMO_DISBURSEMENTS_CALLBACK_HOST: undefined,
      MTN_MOMO_DISBURSEMENTS_PROVIDER_CALLBACK_HOST: undefined,
      MONGO_URI: "prod-db-uri",
      DB_NAME: undefined,
      REDIS_SERVER: "redis-server",
      REDIS_PORT: "6379",
    });
  });
});
