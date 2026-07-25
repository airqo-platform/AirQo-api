require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// Bootstrap in-memory model registration so AccessTokenModel("airqo") resolves
// via mongoose.model("access_tokens") instead of requiring a live DB connection.
try {
  const _schema = rewire("@models/AccessToken").__get__("AccessTokenSchema");
  if (!mongoose.modelNames().includes("access_tokens")) {
    mongoose.model("access_tokens", _schema);
  }
} catch (_) {}

const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;

const AccessTokenModel = require("@models/AccessToken");
const { mailer } = require("@utils/common");
const {
  sendAlertsForExpiringTokens,
  REMINDER_DAY_THRESHOLDS,
} = require("../token-expiration-job");

describe("token-expiration-job: sendAlertsForExpiringTokens", () => {
  let getExpiringTokensStub;
  let expiringTokenStub;

  const tokenFor = (days, suffix) => ({
    _id: `token-id-${suffix}`,
    token: `tok_${suffix}`,
    name: `token-${suffix}`,
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    user: { email: `user-${suffix}@example.com`, firstName: "Jane", lastName: "Doe" },
  });

  beforeEach(() => {
    getExpiringTokensStub = sinon.stub(
      AccessTokenModel("airqo"),
      "getExpiringTokens"
    );
    // First page has one token, second page (skip=100) is empty — exercises
    // the pagination loop in fetchTokensExpiringWithinDays.
    getExpiringTokensStub.callsFake(async ({ skip, days }) => {
      if (skip > 0) return { success: true, data: [] };
      return { success: true, data: [tokenFor(days, days)] };
    });

    expiringTokenStub = sinon
      .stub(mailer, "expiringToken")
      .resolves({ success: true });

    sinon.stub(console, "error");
  });

  afterEach(() => {
    getExpiringTokensStub.restore();
    expiringTokenStub.restore();
    console.error.restore();
  });

  it("queries and emails once per configured day threshold", async () => {
    await sendAlertsForExpiringTokens();

    expect(getExpiringTokensStub.callCount).to.equal(
      REMINDER_DAY_THRESHOLDS.length * 2 // one call per threshold, plus the empty follow-up page
    );
    expect(expiringTokenStub.callCount).to.equal(REMINDER_DAY_THRESHOLDS.length);

    for (const days of REMINDER_DAY_THRESHOLDS) {
      expect(expiringTokenStub).to.have.been.calledWithMatch({
        email: `user-${days}@example.com`,
        daysRemaining: days,
      });
    }
  });

  it("gives each threshold's reminder a distinct cooldownKey so they don't suppress each other", async () => {
    await sendAlertsForExpiringTokens();

    const cooldownKeys = expiringTokenStub
      .getCalls()
      .map((call) => call.args[0].cooldownKey);

    expect(new Set(cooldownKeys).size).to.equal(cooldownKeys.length);
  });

  it("bounds each threshold query with the next-smaller threshold as minDays", async () => {
    await sendAlertsForExpiringTokens();

    // REMINDER_DAY_THRESHOLDS is [5, 2]: the 5-day query should be floored at
    // 2 days (band "2 to 5 days out") and the 2-day query floored at 0 (band
    // "0 to 2 days out"), so together they partition the timeline with no gap
    // and no overlap.
    expect(getExpiringTokensStub).to.have.been.calledWithMatch({
      days: 5,
      minDays: 2,
    });
    expect(getExpiringTokensStub).to.have.been.calledWithMatch({
      days: 2,
      minDays: 0,
    });
  });

  it("does not double-email a token that would match more than one threshold", async () => {
    getExpiringTokensStub.callsFake(async ({ skip, days, minDays }) => {
      if (skip > 0) return { success: true, data: [] };
      // Mimic the model's real (minDays, days] band filtering: a token with
      // 1 day left only ever satisfies the 2-day query (0 < 1 <= 2), never
      // the 5-day query (2 < 1 is false), so it must only be emailed once.
      const remaining = 1;
      const matches = remaining > minDays && remaining <= days;
      return {
        success: true,
        data: matches ? [tokenFor(remaining, "near-expiry")] : [],
      };
    });

    await sendAlertsForExpiringTokens();

    const recipientsEmailed = expiringTokenStub
      .getCalls()
      .map((call) => call.args[0].email);
    expect(recipientsEmailed).to.deep.equal(["user-near-expiry@example.com"]);
  });

  it("continues to the next threshold when one lookup fails", async () => {
    getExpiringTokensStub.restore();
    getExpiringTokensStub = sinon
      .stub(AccessTokenModel("airqo"), "getExpiringTokens")
      .rejects(new Error("db unavailable"));

    await sendAlertsForExpiringTokens(); // resolves cleanly even though every threshold's lookup rejects
    expect(expiringTokenStub).to.not.have.been.called;
  });
});
