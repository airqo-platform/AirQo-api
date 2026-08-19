require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
// .noCallThru() so the three @models/* fakes below stay pure fakes: without
// it, proxyquire's default "call thru" behavior would still `Module._load()`
// the real Mongoose model modules to merge in any keys missing from our fake
// factories, defeating the point of faking them out. Note this does NOT make
// this file independent of @config/constants -- `@config/constants` and
// `@config/mailer.config` are required for real just below, directly by this
// test file itself (mailer.util.js's own logic is what's under test), so
// that dependency is unavoidable here regardless of this flag.
const proxyquire = require("proxyquire").noCallThru();
const httpStatus = require("http-status");

const msgs = require("@utils/common/email.msgs.util");
const msgTemplates = require("@utils/common/email.templates.util");
const constants = require("@config/constants");
const { directTransporter } = require("@config/mailer.config");
const { emailDeduplicator } = require("@utils/common/email-deduplication.util");

/**
 * mailer.util.js has moved on considerably from the version this test file
 * originally targeted:
 *   - every function under test here is now built by the `createMailerFunction`
 *     factory. Callers pass a SINGLE params object (not positional args), and
 *     the factory itself decides what to send/queue/skip based on that object.
 *   - by default (no `priority` passed) an email is never sent synchronously at
 *     all -- it's written to a Mongo-backed queue (`@models/EmailQueue`) and a
 *     background processor drains it later. Only `priority: "high"` sends
 *     synchronously via `directTransporter.sendMail` (falling back to the queue
 *     if that direct send fails).
 *   - before any of that, non-CORE_CRITICAL functions (candidate, user, update,
 *     inquiry, newMobileAppUser, feedback) gate on `@models/Subscription`'s
 *     checkNotificationStatus, and every send additionally goes through
 *     `emailDeduplicator` (Mongo-backed) and an admin-CC lookup against
 *     `@models/ApplicationEmailConfiguration`.
 *
 * All of those collaborators are real Mongoose models reached via `(tenant) =>
 * model` factory functions that throw synchronously if there's no live DB
 * connection (see `getModelByTenant` in @config/database) -- so they can't be
 * obtained and then stubbed with sinon the way `@config/mailer.config`'s
 * transporter can. Instead we `proxyquire` mailer.util.js itself, swapping
 * those three `@models/*` factories for tiny in-memory fakes. This keeps the
 * tests DB-free while still exercising mailer.util.js's real subscription
 * gating / queueing / response-shaping logic -- only the actual I/O boundaries
 * (Mongo models, the SMTP transporter) are faked.
 */
let subscriptionCheckStub;
let createDefaultSubscriptionStub;
let queueSaveStub;
let appConfigFindOneStub;

class FakeEmailQueueDoc {
  constructor(doc) {
    Object.assign(this, doc);
  }
  save() {
    return queueSaveStub(this);
  }
}

const mailer = proxyquire("../mailer.util", {
  "@models/Subscription": () => ({
    checkNotificationStatus: (...args) => subscriptionCheckStub(...args),
    createDefaultSubscription: (...args) => createDefaultSubscriptionStub(...args),
  }),
  "@models/EmailQueue": () => FakeEmailQueueDoc,
  "@models/ApplicationEmailConfiguration": () => ({
    findOne: (...args) => appConfigFindOneStub(...args),
  }),
});

describe("mailer", () => {
  let sendMailStub;

  beforeEach(() => {
    sendMailStub = sinon.stub(directTransporter, "sendMail");
    subscriptionCheckStub = sinon.stub().resolves({ success: true });
    createDefaultSubscriptionStub = sinon.stub().resolves({});
    queueSaveStub = sinon.stub().resolves({});
    appConfigFindOneStub = sinon.stub().returns({
      sort: () => ({ lean: () => Promise.resolve(null) }),
    });
    sinon.stub(emailDeduplicator, "checkAndMarkEmail").resolves(true);
    sinon.stub(emailDeduplicator, "removeEmailKey").resolves(true);
  });

  afterEach(() => {
    sinon.restore();
  });

  // Asserts that `promise` rejects with an HttpError-shaped rejection carrying
  // the given status code (createMailerFunction throws rather than resolving
  // with a {success:false,...} object whenever no `next` callback is supplied).
  const expectHttpErrorRejection = async (promise, expectedStatus) => {
    let caught;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect(caught, "expected the mailer call to reject").to.exist;
    expect(caught.statusCode).to.equal(expectedStatus);
    return caught;
  };

  describe("candidate", () => {
    const firstName = "John";
    const lastName = "Doe";
    const email = "john.doe@example.com";

    it("should queue the email for background sending when no priority is specified (default path)", async () => {
      const result = await mailer.candidate({
        firstName,
        lastName,
        email,
        tenant: "airqo",
      });

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("Email successfully queued for sending.");
      expect(result.data.email).to.equal(email);
      expect(result.data.duplicate).to.be.false;

      // Default priority never touches the transporter directly -- it only
      // persists the job onto the Mongo-backed queue for later processing.
      expect(sendMailStub.called).to.be.false;
      expect(queueSaveStub.calledOnce).to.be.true;
      const queuedMailOptions = queueSaveStub.firstCall.args[0].mailOptions;
      expect(queuedMailOptions.to).to.equal(email);
      expect(queuedMailOptions.subject).to.equal("Your AirQo Account JOIN request");
      expect(queuedMailOptions.html).to.equal(
        msgs.joinRequest(firstName, lastName, email)
      );
    });

    it("should send the email directly and return success when priority is high", async () => {
      sendMailStub.resolves({
        accepted: [email],
        rejected: [],
        messageId: "msg-1",
      });

      const result = await mailer.candidate({
        firstName,
        lastName,
        email,
        tenant: "airqo",
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("candidate email sent successfully");
      expect(result.data.email).to.equal(email);
      expect(result.data.duplicate).to.be.false;
      expect(result.data.emailResults).to.deep.equal({
        accepted: [email],
        rejected: [],
        messageId: "msg-1",
      });

      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Your AirQo Account JOIN request");
      expect(mailOptions.html).to.equal(
        msgs.joinRequest(firstName, lastName, email)
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      const error = await expectHttpErrorRejection(
        mailer.candidate({
          firstName,
          lastName,
          email,
          tenant: "airqo",
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(error.errors.message).to.include(
        "delivery failed or partially rejected"
      );
    });

    it("should return an internal server error when both the direct send and the queue fallback fail", async () => {
      sendMailStub.rejects(new Error("Mocked sendMail error"));
      queueSaveStub.rejects(new Error("Queue is down"));

      await expectHttpErrorRejection(
        mailer.candidate({
          firstName,
          lastName,
          email,
          tenant: "airqo",
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });

    it("should short-circuit with a FORBIDDEN response when the recipient has unsubscribed", async () => {
      subscriptionCheckStub.resolves({
        success: false,
        status: httpStatus.FORBIDDEN,
      });

      const result = await mailer.candidate({
        firstName,
        lastName,
        email,
        tenant: "airqo",
        priority: "high",
      });

      expect(result).to.deep.include({
        success: false,
        message: "User has unsubscribed from email notifications",
        status: httpStatus.FORBIDDEN,
      });
      expect(sendMailStub.called).to.be.false;
    });
  });

  describe("inquiry", () => {
    const fullName = "John Doe";
    const email = "john.doe@example.com";
    const category = "policy";

    it("should send the inquiry email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.inquiry({
        fullName,
        email,
        category,
        tenant: "airqo",
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);

      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal(
        `Thank you for your inquiry - AirQo ${category} team`
      );
      expect(mailOptions.html).to.equal(msgs.inquiry(fullName, email, category));
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.inquiry({
          fullName,
          email,
          category,
          tenant: "airqo",
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("user", () => {
    const firstName = "John";
    const lastName = "Doe";
    const email = "johndoe@example.com";
    const password = "securepassword";

    it("should send the KCCA welcome email when tenant is kcca", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.user({
        firstName,
        lastName,
        email,
        password,
        tenant: "kcca",
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.html).to.equal(
        msgs.welcome_kcca(firstName, lastName, password, email)
      );
    });

    it("should send the general welcome email for any other tenant", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.user({
        firstName,
        lastName,
        email,
        password,
        tenant: "airqo",
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.html).to.equal(
        msgs.welcome_general(firstName, lastName, password, email)
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.user({
          firstName,
          lastName,
          email,
          password,
          tenant: "airqo",
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("verifyEmail", () => {
    const email = "johndoe@example.com";
    const firstName = "John";
    const user_id = "123456";
    const token = "abcdef";

    it("should send the verification email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.verifyEmail({
        email,
        firstName,
        user_id,
        token,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);

      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Verify Your AirQo Account");
      expect(mailOptions.html).to.equal(
        msgTemplates.composeEmailVerificationMessage({
          email,
          firstName,
          user_id,
          token,
        })
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.verifyEmail({ email, firstName, user_id, token, priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("afterEmailVerification", () => {
    const email = "johndoe@example.com";
    const firstName = "John";
    const username = "john_doe";

    it("should send the post-verification email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.afterEmailVerification({
        email,
        firstName,
        username,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal(
        "You're in — here's what to explore first"
      );
      expect(mailOptions.html).to.equal(
        msgTemplates.afterEmailVerification({ firstName, username, email })
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.afterEmailVerification({
          email,
          firstName,
          username,
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("forgot", () => {
    const email = "johndoe@example.com";
    const token = "abcdef123456";

    it("should send the password recovery email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.forgot({
        email,
        token,
        tenant: "airqo",
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Link To Reset Password");
      expect(mailOptions.html).to.equal(
        msgs.recovery_email({ token, tenant: "airqo", email })
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.forgot({ email, token, tenant: "airqo", priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("signInWithEmailLink", () => {
    const email = "johndoe@example.com";
    const token = "abcdef123456";

    it("should send the sign-in link email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.signInWithEmailLink({
        email,
        token,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Verify your email address!");
      expect(mailOptions.html).to.equal(msgs.join_by_email(email, token));
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.signInWithEmailLink({ email, token, priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("deleteMobileAccountEmail", () => {
    const email = "johndoe@example.com";
    const token = "abcdef123456";

    it("should send the delete-account email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.deleteMobileAccountEmail({
        email,
        token,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Confirm Account Deletion - AirQo");
      expect(mailOptions.html).to.equal(
        msgTemplates.deleteMobileAccountEmail(email, token)
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.deleteMobileAccountEmail({ email, token, priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("authenticateEmail", () => {
    const email = "johndoe@example.com";
    const token = "abcdef123456";

    it("should send the email-change notice and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.authenticateEmail({
        email,
        token,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Changes to your AirQo email");
      // Note: msgs.authenticate_email takes (token, email) -- the OLD test
      // asserted msgs.authenticateEmail(email, token), a function that does
      // not exist in email.msgs.util.js.
      expect(mailOptions.html).to.equal(msgs.authenticate_email(token, email));
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.authenticateEmail({ email, token, priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("update", () => {
    const email = "johndoe@example.com";
    const firstName = "John";
    const lastName = "Doe";
    const updatedUserDetails = { firstName: "Jonathan" };

    it("should send the account-updated email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.update({
        email,
        firstName,
        lastName,
        updatedUserDetails,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Your AirQo Account Updated");
      // Note: msgs.user_updated now takes a single options object, not
      // positional (firstName, lastName, updatedUserDetails, email) args.
      expect(mailOptions.html).to.equal(
        msgs.user_updated({ firstName, lastName, updatedUserDetails, email })
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.update({
          email,
          firstName,
          lastName,
          updatedUserDetails,
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("updateForgottenPassword", () => {
    const email = "johndoe@example.com";
    const firstName = "John";
    const lastName = "Doe";

    it("should send the password-reset-successful email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.updateForgottenPassword({
        email,
        firstName,
        lastName,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal(
        "Your AirQo Account Password Reset Successful"
      );
      expect(mailOptions.html).to.equal(
        msgs.forgotten_password_updated(firstName, lastName, email)
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.updateForgottenPassword({
          email,
          firstName,
          lastName,
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("updateKnownPassword", () => {
    const email = "johndoe@example.com";
    const firstName = "John";
    const lastName = "Doe";

    it("should send the password-updated email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.updateKnownPassword({
        email,
        firstName,
        lastName,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal(
        "Your AirQo Account Password Update Successful"
      );
      expect(mailOptions.html).to.equal(
        msgs.known_password_updated(firstName, lastName, email)
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.updateKnownPassword({
          email,
          firstName,
          lastName,
          priority: "high",
        }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("newMobileAppUser", () => {
    const email = "johndoe@example.com";
    const subject = "Welcome to AirQo Mobile App";
    const message = "<p>Dear John, welcome to AirQo Mobile App!</p>";

    it("should send the notification email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.newMobileAppUser({
        email,
        subject,
        message,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      // newMobileAppUser's message-builder just passes the caller's HTML
      // through untouched -- there is no template wrapping to compare against.
      expect(mailOptions.html).to.equal(message);
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.newMobileAppUser({ email, subject, message, priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("feedback", () => {
    const email = "johndoe@example.com";
    const subject = "Feedback on AirQo Analytics";
    const message = "This is a feedback message.";

    // feedback's customMailOptionsModifier throws a BAD_REQUEST-shaped
    // HttpError outright if constants.SUPPORT_EMAIL isn't configured. That's
    // real, desired behaviour in production, but it means these tests need a
    // SUPPORT_EMAIL value to exist -- fill one in only if the environment
    // hasn't already provided one, so we don't clobber a real configured value.
    before(() => {
      if (!constants.SUPPORT_EMAIL) {
        constants.SUPPORT_EMAIL = "support@airqo.net";
      }
    });

    it("should bypass sending for the automated-tests address", async () => {
      const result = await mailer.feedback({
        email: "automated-tests@airqo.net",
        subject,
        message,
      });

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.testBypass).to.be.true;
      expect(sendMailStub.called).to.be.false;
    });

    it("should route the feedback email to the support inbox and return a success response", async () => {
      sendMailStub.resolves({ accepted: [constants.SUPPORT_EMAIL], rejected: [] });

      const result = await mailer.feedback({
        email,
        subject,
        message,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(constants.SUPPORT_EMAIL);
      expect(mailOptions.subject).to.equal(subject);
      expect(mailOptions.text).to.equal(message);
      expect(mailOptions.html).to.include(message);
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [constants.SUPPORT_EMAIL] });

      await expectHttpErrorRejection(
        mailer.feedback({ email, subject, message, priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("verifyMobileEmail", () => {
    const email = "test@example.com";
    const firebase_uid = "firebase_uid";
    const token = "12345";

    it("should send the mobile login-code email and return a success response", async () => {
      sendMailStub.resolves({ accepted: [email], rejected: [] });

      const result = await mailer.verifyMobileEmail({
        email,
        firebase_uid,
        token,
        priority: "high",
      });

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(sendMailStub.calledOnce).to.be.true;
      const mailOptions = sendMailStub.firstCall.args[0];
      expect(mailOptions.to).to.equal(email);
      expect(mailOptions.subject).to.equal("Your Login Code for AirQo Mobile");
      expect(mailOptions.html).to.equal(
        msgTemplates.mobileEmailVerification({ email, firebase_uid, token })
      );
    });

    it("should return an internal server error when the transporter rejects the recipient", async () => {
      sendMailStub.resolves({ accepted: [], rejected: [email] });

      await expectHttpErrorRejection(
        mailer.verifyMobileEmail({ email, firebase_uid, token, priority: "high" }),
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  // The original file also had a `describe("mobileEmailVerification()", ...)`
  // block that called a bare `mobileEmailVerification(...)` function that was
  // never imported anywhere. The closest real equivalent is
  // `msgTemplates.mobileEmailVerification` -- the exact template function
  // `mailer.verifyMobileEmail` above uses to build its HTML body. It was also
  // mis-nested inside `describe("feedback", ...)` in the original file; it's
  // a sibling of the other template/mailer describes here instead.
  describe("email.templates.util mobileEmailVerification()", () => {
    it("should generate the login-code email HTML content correctly", () => {
      const result = msgTemplates.mobileEmailVerification({
        email: "test@example.com",
        firebase_uid: "firebase_uid",
        token: "12345",
      });

      expect(result).to.be.a("string");
      expect(result).to.include("Welcome to AirQo Mobile!");
      expect(result).to.include(
        "Please use the code below to verify your email address"
      );
      expect(result).to.include("12345");
      expect(result).to.include(
        "This verification code will expire in 24 hours."
      );
    });
  });
});
