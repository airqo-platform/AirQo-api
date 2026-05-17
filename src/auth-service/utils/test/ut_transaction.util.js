require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");

// ── Modules under test ────────────────────────────────────────────────────────
const transactions = require("@utils/transaction.util");

// ── Helpers re-exported by the module for test visibility ─────────────────────
// TIER_SCOPE_MAP and TIER_RATE_LIMITS are internal constants; their values are
// asserted indirectly through the observable side-effects of each function.
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

    // Paddle client — cancel succeeds by default
    const paddleConfig = require("@config/paddle");
    paddleStub = sinon.stub(paddleConfig.paddleClient.subscriptions, "cancel").resolves({
      id: mockSubscriptionId,
      status: "cancelled",
    });
    sinon.stub(paddleConfig, "isPaddleConfigured").value(true);

    // UserModel stub
    const UserModel = require("@models/User");
    UserModelStub = sinon.stub(UserModel("airqo"), "findByIdAndUpdate").resolves({});

    // ClientModel stub — returns two mock clients
    const ClientModel = require("@models/Client");
    ClientModelStub = sinon.stub(ClientModel("airqo"), "find").returns({
      lean: sinon.stub().resolves([{ _id: "client1" }, { _id: "client2" }]),
    });

    // AccessTokenModel stub
    const AccessTokenModel = require("@models/AccessToken");
    AccessTokenModelStub = sinon.stub(AccessTokenModel("airqo"), "updateMany").resolves({
      modifiedCount: 2,
    });
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

  it("sets subscriptionStatus to cancelled on the user document", async () => {
    await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    const updateArg = UserModelStub.firstCall.args[1];
    expect(updateArg.$set.subscriptionStatus).to.equal("cancelled");
    expect(updateArg.$set.subscriptionCancelledAt).to.be.instanceOf(Date);
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

  it("returns error response when Paddle call fails", async () => {
    paddleStub.rejects(new Error("Paddle unavailable"));

    const result = await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    expect(result.success).to.equal(false);
    expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
  });

  it("still returns success when token downgrade fails (non-fatal)", async () => {
    AccessTokenModelStub.rejects(new Error("DB timeout"));

    const result = await transactions.cancelSubscription(mockSubscriptionId, mockUser);

    // Cancellation itself succeeded — token downgrade failure is non-fatal
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
    UserModelStub = sinon.stub(UserModel("airqo"), "findByIdAndUpdate").resolves({});

    const ClientModel = require("@models/Client");
    ClientModelStub = sinon.stub(ClientModel("airqo"), "find").returns({
      lean: sinon.stub().resolves([{ _id: "client1" }]),
    });

    const AccessTokenModel = require("@models/AccessToken");
    AccessTokenModelStub = sinon.stub(AccessTokenModel("airqo"), "updateMany").resolves({
      modifiedCount: 1,
    });
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
    expect(updateArg.$set.apiRateLimits.weeklyLimit).to.equal(140000);
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
    const ClientModel = require("@models/Client");
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
// Tier resolution (via handleCompletedTransaction / resolveTierFromEvent)
// Tested indirectly through performAdditionalBusinessLogic event data shapes
// ─────────────────────────────────────────────────────────────────────────────
describe("tier resolution from event data", () => {
  let UserModelStub;
  let ClientModelStub;
  let AccessTokenModelStub;

  beforeEach(() => {
    sinon.restore();
    const UserModel = require("@models/User");
    UserModelStub = sinon.stub(UserModel("airqo"), "findByIdAndUpdate").resolves({});
    const ClientModel = require("@models/Client");
    ClientModelStub = sinon.stub(ClientModel("airqo"), "find").returns({
      lean: sinon.stub().resolves([]),
    });
    const AccessTokenModel = require("@models/AccessToken");
    AccessTokenModelStub = sinon.stub(AccessTokenModel("airqo"), "updateMany").resolves({});
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
