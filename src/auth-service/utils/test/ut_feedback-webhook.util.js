require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");

const rewireWebhook = rewire("@utils/feedback-webhook.util");

describe("feedback-webhook util", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("signPayload (internal)", () => {
    it("should produce a sha256 HMAC signature prefixed with sha256=", () => {
      const signPayload = rewireWebhook.__get__("signPayload");
      const sig = signPayload("mysecretkey", '{"event":"feedback.submitted"}');

      expect(sig).to.be.a("string");
      expect(sig.startsWith("sha256=")).to.equal(true);
      expect(sig.length).to.be.greaterThan(7);
    });

    it("should produce the same signature for the same inputs", () => {
      const signPayload = rewireWebhook.__get__("signPayload");
      const body = '{"event":"feedback.submitted"}';
      const secret = "consistent-secret";

      const sig1 = signPayload(secret, body);
      const sig2 = signPayload(secret, body);

      expect(sig1).to.equal(sig2);
    });

    it("should produce different signatures for different secrets", () => {
      const signPayload = rewireWebhook.__get__("signPayload");
      const body = '{"event":"test"}';

      const sig1 = signPayload("secret-a", body);
      const sig2 = signPayload("secret-b", body);

      expect(sig1).to.not.equal(sig2);
    });
  });

  describe("postWebhook (internal)", () => {
    it("should reject when given an invalid URL", async () => {
      const postWebhook = rewireWebhook.__get__("postWebhook");

      let error;
      try {
        await postWebhook("not-a-url", '{"data":"x"}', "sha256=abc");
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.include("Invalid webhook URL");
    });
  });

  describe("dispatchWebhooks()", () => {
    it("should resolve without throwing when no active webhooks exist", async () => {
      const origFeedbackWebhookModel = rewireWebhook.__get__("FeedbackWebhookModel");
      rewireWebhook.__set__("FeedbackWebhookModel", () => ({
        findActiveForEvent: sinon.stub().resolves([]),
      }));

      const { dispatchWebhooks } = rewireWebhook;

      let threw = false;
      try {
        await dispatchWebhooks("airqo", "feedback.submitted", { email: "a@b.com" });
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireWebhook.__set__("FeedbackWebhookModel", origFeedbackWebhookModel);
    });

    it("should resolve without throwing even when a webhook POST fails", async () => {
      const origFeedbackWebhookModel = rewireWebhook.__get__("FeedbackWebhookModel");
      rewireWebhook.__set__("FeedbackWebhookModel", () => ({
        findActiveForEvent: sinon.stub().resolves([
          { _id: "wh1", name: "Broken Hook", url: "https://broken.example.com", secret: "s3cr3t16ch+" },
        ]),
      }));

      const origPostWebhook = rewireWebhook.__get__("postWebhook");
      rewireWebhook.__set__("postWebhook", sinon.stub().rejects(new Error("Connection refused")));

      const { dispatchWebhooks } = rewireWebhook;

      let threw = false;
      try {
        await dispatchWebhooks("airqo", "feedback.submitted", { email: "a@b.com" });
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireWebhook.__set__("FeedbackWebhookModel", origFeedbackWebhookModel);
      rewireWebhook.__set__("postWebhook", origPostWebhook);
    });

    it("should resolve without throwing when FeedbackWebhookModel.findActiveForEvent throws", async () => {
      const origFeedbackWebhookModel = rewireWebhook.__get__("FeedbackWebhookModel");
      rewireWebhook.__set__("FeedbackWebhookModel", () => ({
        findActiveForEvent: sinon.stub().rejects(new Error("DB error")),
      }));

      const { dispatchWebhooks } = rewireWebhook;

      let threw = false;
      try {
        await dispatchWebhooks("airqo", "feedback.submitted", { email: "a@b.com" });
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);

      rewireWebhook.__set__("FeedbackWebhookModel", origFeedbackWebhookModel);
    });

    it("should call postWebhook for each active webhook", async () => {
      const origFeedbackWebhookModel = rewireWebhook.__get__("FeedbackWebhookModel");
      const origPostWebhook = rewireWebhook.__get__("postWebhook");

      const postStub = sinon.stub().resolves(200);
      rewireWebhook.__set__("postWebhook", postStub);
      rewireWebhook.__set__("FeedbackWebhookModel", () => ({
        findActiveForEvent: sinon.stub().resolves([
          { _id: "wh1", name: "Hook A", url: "https://a.example.com/hook", secret: "secret1111111111" },
          { _id: "wh2", name: "Hook B", url: "https://b.example.com/hook", secret: "secret2222222222" },
        ]),
      }));

      const { dispatchWebhooks } = rewireWebhook;
      await dispatchWebhooks("airqo", "feedback.submitted", { email: "a@b.com" });

      expect(postStub.callCount).to.equal(2);

      rewireWebhook.__set__("FeedbackWebhookModel", origFeedbackWebhookModel);
      rewireWebhook.__set__("postWebhook", origPostWebhook);
    });
  });
});
