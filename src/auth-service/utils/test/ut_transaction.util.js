// Ensure Paddle initialises as configured — must be set before @config/paddle
// is evaluated. Without a valid key, isPaddleConfigured is captured as false at
// module load time and cancelSubscription short-circuits to PADDLE_NOT_CONFIGURED
// before any business logic runs, making those tests unreachable.
process.env.PADDLE_API_KEY =
  process.env.PADDLE_API_KEY || "pdl_live_apikey_test";

require("module-alias/register");

// Force a fresh require of paddle-dependent modules so the env var above takes
// effect even if another test file already cached them without it.
[
  require.resolve("@config/paddle"),
  require.resolve("@utils/transaction.util"),
].forEach((k) => {
  delete require.cache[k];
});

const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");

const transactions = require("@utils/transaction.util");
const paddleConfig  = require("@config/paddle");

// ── Scope / rate-limit constants mirrored from transaction.util.js ────────────
const FREE_SCOPES = [
  "read:recent_measurements",
  "read:devices",
  "read:sites",
  "read:cohorts",
  "read:grids",
];
const STANDARD_SCOPES = [...FREE_SCOPES, "read:historical_measurements"];
const PREMIUM_SCOPES  = [...STANDARD_SCOPES, "read:forecasts", "read:insights"];

const FREE_RATE_LIMITS = {
  hourlyLimit: 100, dailyLimit: 1000, weeklyLimit: 7000, monthlyLimit: 10000,
};

// ─────────────────────────────────────────────────────────────────────────────
// cancelSubscription
// ─────────────────────────────────────────────────────────────────────────────
describe("transactions.cancelSubscription", () => {
  let UserModelStub;
  let ClientModelStub;
  let AccessTokenModelStub;
  let paddleStub;

  const mockUser = { _id: "user123" };
  const mockSubscriptionId = "sub_abc";

  beforeEach(() => {
    sinon.restore();

    // Paddle client — cancel succeeds by default.
    // paddleConfig.paddleClient is the same object reference held by the SUT's
    // local const, so stubbing a method on it affects the SUT directly.
    paddleStub = sinon
      .stub(paddleConfig.paddleClient.subscriptions, "cancel")
      .resolves({ id: mockSubscriptionId, status: "cancelled" });

    const UserModel = require("@models/User");
    UserModelStub = sinon
      .stub(UserModel("airqo"), "findByIdAndUpdate")
      .resolves({});

    const ClientModel = require("@models/Client");
    ClientModelStub = sinon
      .stub(ClientModel("airqo"), "find")
      .returns({ lean: sinon.stub().resolves([{ _id: "client1" }, { _id: "client2" }]) });

    const AccessTokenModel = require("@models/AccessToken");
    AccessTokenModelStub = sinon
      .stub(AccessTokenModel("airqo"), "updateMany")
      .resolves({ modifiedCount: 2 });
  });

  afterEach(() => sinon.restore());

  it("resets subscriptionTier to Free on the user document", async () => {
    await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    sinon.assert.calledOnce(UserModelStub);
    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.subscriptionTier).to.equal("Free");
  });

  it("resets apiRateLimits to Free defaults on the user document", async () => {
    await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.apiRateLimits).to.deep.equal(FREE_RATE_LIMITS);
  });

  it("sets subscriptionStatus to cancelled and clears linkage fields", async () => {
    await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.subscriptionStatus).to.equal("cancelled");
    expect(updateArg.$set.subscriptionCancelledAt).to.be.instanceOf(Date);
    expect(updateArg.$set.currentSubscriptionId).to.equal(null);
    expect(updateArg.$set.nextBillingDate).to.equal(null);
    expect(updateArg.$set.automaticRenewal).to.equal(false);
  });

  it("downgrades all user tokens to Free tier and Free scopes", async () => {
    await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    sinon.assert.calledOnce(AccessTokenModelStub);
    const updateArg = AccessTokenModelStub.firstCall.args[1];
    expect(updateArg.$set.tier).to.equal("Free");
    expect(updateArg.$set.scopes).to.deep.equal(FREE_SCOPES);
  });

  it("returns success response after cancellation", async () => {
    const result = await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    expect(result.success).to.equal(true);
    expect(result.status).to.equal(httpStatus.OK);
  });

  it("returns error response and makes no local updates when Paddle call fails", async () => {
    paddleStub.rejects(new Error("Paddle unavailable"));

    const result = await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    expect(result.success).to.equal(false);
    expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    // No local side-effects should occur when Paddle itself fails
    sinon.assert.notCalled(UserModelStub);
    sinon.assert.notCalled(AccessTokenModelStub);
  });

  it("still returns success when token downgrade fails (non-fatal)", async () => {
    AccessTokenModelStub.rejects(new Error("DB timeout"));

    const result = await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    expect(result.success).to.equal(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// performAdditionalBusinessLogic (upgrade flow)
// ─────────────────────────────────────────────────────────────────────────────
describe("transactions.performAdditionalBusinessLogic", () => {
  let UserModelStub;
  let ClientModelStub;
  let AccessTokenModelStub;

  const mockUserId = "user456";

  beforeEach(() => {
    sinon.restore();

    const UserModel = require("@models/User");
    UserModelStub = sinon
      .stub(UserModel("airqo"), "findByIdAndUpdate")
      .resolves({});

    const ClientModel = require("@models/Client");
    ClientModelStub = sinon
      .stub(ClientModel("airqo"), "find")
      .returns({ lean: sinon.stub().resolves([{ _id: "client1" }]) });

    const AccessTokenModel = require("@models/AccessToken");
    AccessTokenModelStub = sinon
      .stub(AccessTokenModel("airqo"), "updateMany")
      .resolves({ modifiedCount: 1 });
  });

  afterEach(() => sinon.restore());

  it("upgrades user to Standard tier and writes correct rate limits", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: mockUserId,
      full_event_data: { customData: { tier: "Standard" } },
      is_new_user: false,
    });

    sinon.assert.calledOnce(UserModelStub);
    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.subscriptionTier).to.equal("Standard");
    expect(updateArg.$set.apiRateLimits.hourlyLimit).to.equal(500);
    expect(updateArg.$set.apiRateLimits.dailyLimit).to.equal(5000);
    expect(updateArg.$set.apiRateLimits.weeklyLimit).to.equal(35000);
    expect(updateArg.$set.apiRateLimits.monthlyLimit).to.equal(50000);
  });

  it("upgrades user to Premium tier and writes correct rate limits", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: mockUserId,
      full_event_data: { customData: { tier: "Premium" } },
      is_new_user: false,
    });

    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.subscriptionTier).to.equal("Premium");
    expect(updateArg.$set.apiRateLimits.hourlyLimit).to.equal(2000);
    expect(updateArg.$set.apiRateLimits.dailyLimit).to.equal(20000);
    expect(updateArg.$set.apiRateLimits.weeklyLimit).to.equal(140000);
    expect(updateArg.$set.apiRateLimits.monthlyLimit).to.equal(200000);
  });

  it("updates all user tokens with correct tier and Premium scopes", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: mockUserId,
      full_event_data: { customData: { tier: "Premium" } },
      is_new_user: false,
    });

    sinon.assert.calledOnce(AccessTokenModelStub);
    const updateArg = AccessTokenModelStub.firstCall.args[1];
    expect(updateArg.$set.tier).to.equal("Premium");
    expect(updateArg.$set.scopes).to.deep.equal(PREMIUM_SCOPES);
  });

  it("updates all user tokens with Standard scopes on Standard upgrade", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: mockUserId,
      full_event_data: { customData: { tier: "Standard" } },
      is_new_user: false,
    });

    const updateArg = AccessTokenModelStub.firstCall.args[1];
    expect(updateArg.$set.tier).to.equal("Standard");
    expect(updateArg.$set.scopes).to.deep.equal(STANDARD_SCOPES);
  });

  it("stamps first_transaction_completed_at for new users", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: mockUserId,
      full_event_data: { customData: { tier: "Standard" } },
      is_new_user: true,
    });

    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.first_transaction_completed_at).to.be.instanceOf(Date);
  });

  it("does nothing when user_id is missing", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: null,
      full_event_data: {},
      is_new_user: false,
    });

    sinon.assert.notCalled(UserModelStub);
    sinon.assert.notCalled(AccessTokenModelStub);
  });

  it("skips token update when user has no clients", async () => {
    ClientModelStub.returns({ lean: sinon.stub().resolves([]) });

    await transactions.performAdditionalBusinessLogic({
      user_id: mockUserId,
      full_event_data: { customData: { tier: "Premium" } },
      is_new_user: false,
    });

    sinon.assert.notCalled(AccessTokenModelStub);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tier resolution (via resolveTierFromEvent — tested through
// performAdditionalBusinessLogic since the helper is not exported)
// ─────────────────────────────────────────────────────────────────────────────
describe("tier resolution from event data", () => {
  let UserModelStub;

  beforeEach(() => {
    sinon.restore();
    const UserModel = require("@models/User");
    UserModelStub = sinon
      .stub(UserModel("airqo"), "findByIdAndUpdate")
      .resolves({});
    const ClientModel = require("@models/Client");
    sinon
      .stub(ClientModel("airqo"), "find")
      .returns({ lean: sinon.stub().resolves([]) });
    const AccessTokenModel = require("@models/AccessToken");
    sinon.stub(AccessTokenModel("airqo"), "updateMany").resolves({});
  });

  afterEach(() => sinon.restore());

  it("resolves Standard tier via customData", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: "u1",
      full_event_data: { customData: { tier: "Standard" } },
      is_new_user: false,
    });
    expect(UserModelStub.firstCall.args[1].$set.subscriptionTier).to.equal("Standard");
  });

  it("falls back to Free for unknown customData tier", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: "u1",
      full_event_data: { customData: { tier: "Unknown" } },
      is_new_user: false,
    });
    expect(UserModelStub.firstCall.args[1].$set.subscriptionTier).to.equal("Free");
  });

  it("falls back to Free when event data is empty", async () => {
    await transactions.performAdditionalBusinessLogic({
      user_id: "u1",
      full_event_data: {},
      is_new_user: false,
    });
    expect(UserModelStub.firstCall.args[1].$set.subscriptionTier).to.equal("Free");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createCheckoutSession — customer resolution paths
// ─────────────────────────────────────────────────────────────────────────────
describe("transactions.createCheckoutSession — customer resolution", () => {
  let createStub;
  let listStub;
  let transactionCreateStub;
  let UserModelStub;

  const mockSessionData = () => ({
    items: [{ price: "pri_test", quantity: 1 }],
    settings: {
      mode: "transaction",
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
    },
    custom_data: { source: "api_subscription_payment" },
  });

  const mockRequest = (userOverrides = {}) => ({
    user: {
      _id: "user123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      paddle_customer_id: null,
      ...userOverrides,
    },
    query: { tenant: "airqo" },
  });

  beforeEach(() => {
    sinon.restore();

    createStub = sinon
      .stub(paddleConfig.paddleClient.customers, "create")
      .resolves({ id: "ctm_new" });

    const mockCollection = {
      next: sinon.stub().resolves(),
      data: [{ id: "ctm_existing" }],
    };
    listStub = sinon
      .stub(paddleConfig.paddleClient.customers, "list")
      .returns(mockCollection);

    transactionCreateStub = sinon
      .stub(paddleConfig.paddleClient.transactions, "create")
      .resolves({ id: "txn_001", checkout: { url: "https://pay.paddle.com/checkout/txn_001" } });

    const UserModel = require("@models/User");
    UserModelStub = sinon
      .stub(UserModel("airqo"), "findByIdAndUpdate")
      .resolves({});
  });

  afterEach(() => sinon.restore());

  it("uses cached paddle_customer_id and skips all Paddle customer API calls", async () => {
    const req = mockRequest({ paddle_customer_id: "ctm_cached" });
    const result = await transactions.createCheckoutSession(req, mockSessionData());

    sinon.assert.notCalled(createStub);
    sinon.assert.notCalled(listStub);
    expect(result.success).to.equal(true);
    expect(result.data.url).to.equal("https://pay.paddle.com/checkout/txn_001");
    const sessionArg = transactionCreateStub.firstCall.args[0];
    expect(sessionArg.customer_id).to.equal("ctm_cached");
    expect(sessionArg.settings).to.be.undefined;
  });

  it("returns undefined url without error when Paddle returns checkout: null", async () => {
    transactionCreateStub.resolves({ id: "txn_null", checkout: null });
    const req = mockRequest({ paddle_customer_id: "ctm_cached" });
    const result = await transactions.createCheckoutSession(req, mockSessionData());

    expect(result.success).to.equal(true);
    expect(result.data.url).to.be.undefined;
  });

  it("creates a new Paddle customer when none is cached and persists the ID", async () => {
    const req = mockRequest();
    const result = await transactions.createCheckoutSession(req, mockSessionData());

    sinon.assert.calledOnce(createStub);
    sinon.assert.notCalled(listStub);
    expect(result.success).to.equal(true);
    const sessionArg = transactionCreateStub.firstCall.args[0];
    expect(sessionArg.customer_id).to.equal("ctm_new");
    expect(sessionArg.settings).to.be.undefined;
    // paddle_customer_id should be persisted fire-and-forget
    sinon.assert.calledOnce(UserModelStub);
    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.paddle_customer_id).to.equal("ctm_new");
  });

  it("recovers via customers.list on customer_already_exists and persists the recovered ID", async () => {
    const conflictErr = Object.assign(new Error("customer_already_exists"), {
      code: "customer_already_exists",
    });
    createStub.rejects(conflictErr);

    const req = mockRequest();
    const result = await transactions.createCheckoutSession(req, mockSessionData());

    sinon.assert.calledOnce(listStub);
    expect(result.success).to.equal(true);
    const sessionArg = transactionCreateStub.firstCall.args[0];
    expect(sessionArg.customer_id).to.equal("ctm_existing");
    expect(sessionArg.settings).to.be.undefined;
    sinon.assert.calledOnce(UserModelStub);
    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.paddle_customer_id).to.equal("ctm_existing");
  });

  it("uses caller-supplied customer_id and skips all customer API calls and user update", async () => {
    const req = mockRequest();
    const data = { ...mockSessionData(), customer_id: "ctm_supplied" };
    const result = await transactions.createCheckoutSession(req, data);

    sinon.assert.notCalled(createStub);
    sinon.assert.notCalled(listStub);
    sinon.assert.notCalled(UserModelStub);
    expect(result.success).to.equal(true);
    const sessionArg = transactionCreateStub.firstCall.args[0];
    expect(sessionArg.customer_id).to.equal("ctm_supplied");
    expect(sessionArg.settings).to.be.undefined;
  });

  it("self-heals stale paddle_customer_id: clears cache, resolves fresh customer, retries transaction", async () => {

    const staleId = "ctm_stale";
    const req = mockRequest({ paddle_customer_id: staleId });

    // First transactions.create fails with a Paddle "not found" detail for the stale ID
    const staleErr = Object.assign(new Error("not found"), {
      detail: `customer ${staleId} not found.`,
    });
    transactionCreateStub.onFirstCall().rejects(staleErr);
    transactionCreateStub.onSecondCall().resolves({
      id: "txn_retry",
      checkout: { url: "https://pay.paddle.com/checkout/txn_retry" },
    });

    // customers.create succeeds and returns a fresh customer
    createStub.resolves({ id: "ctm_fresh" });

    const result = await transactions.createCheckoutSession(req, mockSessionData());

    expect(result.success).to.equal(true);
    // transactions.create must have been called twice
    sinon.assert.calledTwice(transactionCreateStub);
    // Second call must use the fresh customer ID
    const retryArg = transactionCreateStub.secondCall.args[0];
    expect(retryArg.customer_id).to.equal("ctm_fresh");
    expect(retryArg.settings).to.be.undefined;
    // User model must be updated twice: once to clear, once to persist fresh ID
    sinon.assert.calledTwice(UserModelStub);
    const clearArg = UserModelStub.firstCall.args[1];
    expect(clearArg.$unset).to.have.property("paddle_customer_id");
    const persistArg = UserModelStub.secondCall.args[1];
    expect(persistArg.$set.paddle_customer_id).to.equal("ctm_fresh");
  });
});

describe("transactions.processWebhook — body normalisation", () => {
  let unmarshalStub;
  // Mirrors the real Paddle Node SDK Event object: eventType (not type) on the
  // event wrapper; camelCase fields on event.data.
  const fakeEvent = {
    eventType: "transaction.completed",
    data: {
      id: "txn_001",
      customerId: "ctm_001",
      currencyCode: "usd",
      details: { totals: { total: "9900" } }, // cents; normalization divides by 100 → $99.00
    },
  };

  beforeEach(() => {
    unmarshalStub = sinon
      .stub(paddleConfig.paddleClient.webhooks, "unmarshal")
      .resolves(fakeEvent);

    // Stub handleCompletedTransaction to prevent downstream DB calls
    sinon.stub(transactions, "handleCompletedTransaction").resolves();
    // Stub transactions.create to prevent downstream processing
    sinon.stub(transactions, "create").resolves({ success: true });
  });

  afterEach(() => sinon.restore());

  const mockWebhookRequest = (body) => ({
    headers: { "paddle-signature": "ts=1234;h1=abcd" },
    body,
    query: { tenant: "airqo" },
  });

  it("passes a UTF-8 string to unmarshal when rawBody is a Buffer", async () => {
    const bodyString = JSON.stringify({ id: "txn_001" });
    const req = mockWebhookRequest(Buffer.from(bodyString, "utf8"));

    await transactions.processWebhook(req, () => {});

    sinon.assert.calledOnce(unmarshalStub);
    const [bodyArg] = unmarshalStub.firstCall.args;
    expect(typeof bodyArg).to.equal("string");
    expect(bodyArg).to.equal(bodyString);
  });

  it("passes the string through unchanged when rawBody is already a string", async () => {
    const bodyString = JSON.stringify({ id: "txn_001" });
    const req = mockWebhookRequest(bodyString);

    await transactions.processWebhook(req, () => {});

    sinon.assert.calledOnce(unmarshalStub);
    const [bodyArg] = unmarshalStub.firstCall.args;
    expect(bodyArg).to.equal(bodyString);
  });

  it("normalises SDK camelCase fields and passes merged type to transactions.create", async () => {
    const req = mockWebhookRequest(Buffer.from("{}", "utf8"));

    await transactions.processWebhook(req, () => {});

    sinon.assert.calledOnce(transactions.create);
    const body = transactions.create.firstCall.args[0].body;
    expect(body.type).to.equal("transaction.completed");
    expect(body.customer_id).to.equal("ctm_001");
    expect(body.currency).to.equal("USD");
    expect(body.total).to.equal(99);
  });

  it("returns OK and does not call transactions.create for non-transaction events", async () => {
    unmarshalStub.resolves({
      eventType: "subscription.activated",
      data: { id: "sub_001" },
    });
    const req = mockWebhookRequest(Buffer.from("{}", "utf8"));

    const result = await transactions.processWebhook(req, () => {});

    sinon.assert.notCalled(transactions.create);
    expect(result.success).to.equal(true);
    expect(result.message).to.equal("Event received");
  });

  it("returns an error response when unmarshal throws Invalid webhook signature", async () => {
    unmarshalStub.rejects(new Error("[Paddle] Invalid webhook signature"));
    const req = mockWebhookRequest(Buffer.from("{}", "utf8"));

    const result = await transactions.processWebhook(req, () => {});

    expect(result.success).to.equal(false);
    expect(result.errors.message).to.include("Invalid webhook signature");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// identifyUserFromTransaction — tenant factory + user resolution
// ─────────────────────────────────────────────────────────────────────────────
describe("transactions.identifyUserFromTransaction", () => {
  let findOneStub;
  let createStub;

  beforeEach(() => {
    sinon.restore();
    const UserModel = require("@models/User");
    findOneStub = sinon.stub(UserModel("airqo"), "findOne");
    createStub = sinon.stub(UserModel("airqo"), "create");
  });

  afterEach(() => sinon.restore());

  it("returns existing user and isNewUser: false when paddle_customer_id matches", async () => {
    findOneStub.resolves({ _id: "user123" });

    const result = await transactions.identifyUserFromTransaction(
      { customer_id: "ctm_001" },
      "airqo",
    );

    sinon.assert.calledOnce(findOneStub);
    sinon.assert.notCalled(createStub);
    expect(result.userId).to.equal("user123");
    expect(result.isNewUser).to.equal(false);
  });

  it("creates a new user and returns isNewUser: true when no match is found", async () => {
    findOneStub.resolves(null);
    createStub.resolves({ _id: "user_new" });

    const result = await transactions.identifyUserFromTransaction(
      { customer_id: "ctm_002", email: "new@example.com" },
      "airqo",
    );

    sinon.assert.calledOnce(createStub);
    expect(result.userId).to.equal("user_new");
    expect(result.isNewUser).to.equal(true);
  });

  it("defaults to airqo tenant when none is provided", async () => {
    findOneStub.resolves({ _id: "user_default" });

    const result = await transactions.identifyUserFromTransaction({
      customer_id: "ctm_003",
    });

    sinon.assert.calledOnce(findOneStub);
    expect(result.userId).to.equal("user_default");
  });

  it("throws 'Could not identify or create user' when the DB call fails", async () => {
    findOneStub.rejects(new Error("DB connection lost"));

    try {
      await transactions.identifyUserFromTransaction(
        { customer_id: "ctm_004" },
        "airqo",
      );
      expect.fail("should have thrown");
    } catch (error) {
      expect(error.message).to.equal("Could not identify or create user");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSubscriptionStatus
// ─────────────────────────────────────────────────────────────────────────────
describe("transactions.getSubscriptionStatus", () => {
  let findByIdStub;
  let findByIdAndUpdateStub;
  let subscriptionsGetStub;

  const mockRequest = (userOverrides = {}) => ({
    user: { _id: "user123", ...userOverrides },
    query: { tenant: "airqo" },
  });

  beforeEach(() => {
    sinon.restore();

    const UserModel = require("@models/User");
    findByIdStub = sinon.stub(UserModel("airqo"), "findById").returns({
      select: sinon.stub().returns({
        lean: sinon.stub().resolves({
          _id: "user123",
          currentSubscriptionId: "sub_active",
          subscriptionStatus: "active",
        }),
      }),
    });

    findByIdAndUpdateStub = sinon
      .stub(UserModel("airqo"), "findByIdAndUpdate")
      .resolves({});

    subscriptionsGetStub = sinon
      .stub(paddleConfig.paddleClient.subscriptions, "get")
      .resolves({ status: "active" });
  });

  afterEach(() => sinon.restore());

  it("returns 200 with subscribed:false and subscriptionStatus:'none' when user has no subscription ID", async () => {
    findByIdStub.returns({
      select: sinon.stub().returns({
        lean: sinon.stub().resolves({ _id: "user123", currentSubscriptionId: null }),
      }),
    });

    const result = await transactions.getSubscriptionStatus(mockRequest());

    expect(result.status).to.equal(httpStatus.OK);
    expect(result.success).to.equal(false);
    expect(result.data.subscribed).to.equal(false);
    expect(result.data.subscriptionStatus).to.equal("none");
    sinon.assert.notCalled(subscriptionsGetStub);
  });

  it("returns 200 with subscribed:false and subscriptionStatus:'none' when user document is not found", async () => {
    findByIdStub.returns({
      select: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
    });

    const result = await transactions.getSubscriptionStatus(mockRequest());

    expect(result.status).to.equal(httpStatus.OK);
    expect(result.success).to.equal(false);
    expect(result.data.subscribed).to.equal(false);
    expect(result.data.subscriptionStatus).to.equal("none");
  });

  it("returns 200 with subscribed:true and subscriptionStatus from Paddle when subscription exists", async () => {
    const result = await transactions.getSubscriptionStatus(mockRequest());

    expect(result.status).to.equal(httpStatus.OK);
    expect(result.success).to.equal(true);
    expect(result.data.subscribed).to.equal(true);
    expect(result.data.subscriptionStatus).to.equal("active");
    expect(result.data.subscriptionId).to.equal("sub_active");
    expect(result.data.lastChecked).to.be.instanceOf(Date);
  });

  it("response data always contains subscriptionStatus field in both branches", async () => {
    // No-subscription branch
    findByIdStub.returns({
      select: sinon.stub().returns({
        lean: sinon.stub().resolves({ _id: "user123", currentSubscriptionId: null }),
      }),
    });
    const noSubResult = await transactions.getSubscriptionStatus(mockRequest());
    expect(noSubResult.data).to.have.property("subscriptionStatus");

    // Active-subscription branch
    sinon.restore();
    const UserModel = require("@models/User");
    sinon.stub(UserModel("airqo"), "findById").returns({
      select: sinon.stub().returns({
        lean: sinon.stub().resolves({ _id: "user123", currentSubscriptionId: "sub_1" }),
      }),
    });
    sinon.stub(UserModel("airqo"), "findByIdAndUpdate").resolves({});
    sinon.stub(paddleConfig.paddleClient.subscriptions, "get").resolves({ status: "trialing" });

    const activeResult = await transactions.getSubscriptionStatus(mockRequest());
    expect(activeResult.data).to.have.property("subscriptionStatus");
  });

  it("writes updated subscriptionStatus back to the user document after Paddle call", async () => {
    await transactions.getSubscriptionStatus(mockRequest());

    sinon.assert.calledOnce(findByIdAndUpdateStub);
    const updateArg = findByIdAndUpdateStub.firstCall.args[1];
    expect(updateArg.$set.subscriptionStatus).to.equal("active");
    expect(updateArg.$set.lastSubscriptionCheck).to.be.instanceOf(Date);
  });

  it("returns 500 when Paddle subscriptions.get throws", async () => {
    subscriptionsGetStub.rejects(new Error("Paddle API down"));

    const result = await transactions.getSubscriptionStatus(mockRequest());

    expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    expect(result.success).to.equal(false);
    expect(result.errors.message).to.equal("Paddle API down");
  });
});

describe("transactions.notifyAdminOfTransactionError", () => {
  let localTransactions;
  let opsLoggerErrorStub;

  before(() => {
    // log4js.getLogger returns a new object per call, so we must intercept it
    // *before* transaction.util.js binds opsLogger at module load time.
    const log4js = require("log4js");
    const fakeOpsLogger = { error: sinon.stub(), info: () => {}, warn: () => {} };
    opsLoggerErrorStub = fakeOpsLogger.error;

    const getLoggerStub = sinon.stub(log4js, "getLogger").callsFake(() => fakeOpsLogger);
    delete require.cache[require.resolve("@utils/transaction.util")];
    localTransactions = require("@utils/transaction.util");
    getLoggerStub.restore();
  });

  afterEach(() => {
    opsLoggerErrorStub.resetHistory();
  });

  it("logs TRANSACTION_COMPLETION_FAILED with message and transactionId via opsLogger", async () => {
    const error = new Error("Payment gateway timeout");
    const eventData = { id: "txn_abc123", customer_id: "cust_xyz" };

    await localTransactions.notifyAdminOfTransactionError(error, eventData);

    sinon.assert.calledOnce(opsLoggerErrorStub);
    const [errorType, payload] = opsLoggerErrorStub.firstCall.args;
    expect(errorType).to.equal("TRANSACTION_COMPLETION_FAILED");
    expect(payload).to.deep.equal({
      message: "Payment gateway timeout",
      transactionId: "txn_abc123",
    });
  });

  it("uses undefined transactionId when eventData is absent", async () => {
    await localTransactions.notifyAdminOfTransactionError(new Error("Unknown failure"), undefined);

    sinon.assert.calledOnce(opsLoggerErrorStub);
    const [, payload] = opsLoggerErrorStub.firstCall.args;
    expect(payload.transactionId).to.be.undefined;
  });
});
