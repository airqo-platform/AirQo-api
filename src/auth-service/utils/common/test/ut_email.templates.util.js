require("module-alias/register");
const { expect } = require("chai");
const emailTemplatesUtil = require("@utils/common/email.templates.util");
const constants = require("@config/constants");

describe("email.templates", () => {
  describe("confirm", () => {
    it("should return the correct confirm object", () => {
      const id = "12345";
      const expectedConfirmObject = {
        subject: "AirQo Nexus JOIN request",
        html: `
      <a href='${constants.CLIENT_ORIGIN}/confirm/${id}'>
        Click to know more about AirQo
      </a>
    `,
        text: `Copy and paste this link: ${constants.CLIENT_ORIGIN}/confirm/${id}`,
      };
      const result = emailTemplatesUtil.confirm(id);
      expect(result).to.deep.equal(expectedConfirmObject);
    });
  });

  describe("inquiryTemplate", () => {
    it("should return the correct inquiry template with full name", () => {
      const fullName = "John Doe";
      const result = emailTemplatesUtil.inquiryTemplate(fullName);

      // Content-based assertions rather than a full exact-string match:
      // the source template mixes incidental whitespace (e.g. trailing
      // spaces after some <br> tags) that a future formatter pass could
      // silently strip, which would break a byte-exact comparison without
      // any actual behavior change.
      expect(result).to.be.a("string");
      expect(result).to.include(`<h3>Hi ${fullName}</h3>`);
      expect(result).to.include("welcome to AirQo");
      expect(result).to.include(`<a href=${constants.PLATFORM_BASE_URL}> Check out AirQo Nexus</a>`);
      expect(result).to.include(`<a href=${constants.PLATFORM_BASE_URL}> Support our expansion in Africa</a>`);
      expect(result).to.include(`<a href=${constants.PLATFORM_BASE_URL}> Support our ongoing projects</a>`);
      expect(result).to.include("info@airqo.net");
      expect(result).to.include("--The AirQo team.");
    });
  });

  describe("emailVerification", () => {
    it("should return the correct email verification template with provided details", () => {
      const firstName = "John";
      const user_id = "123456789";
      const token = "abcdef123456";
      const expectedEmailVerificationTemplate = `
<h3>Dear ${firstName}</h3>
<p> Thank you for signing up for AirQo! We are excited to have you on board.</p>
<p> Before you can fully access all of the features and services offered by AirQo, we need to verify your account. </p>
<p> This is a quick and easy process that helps us ensure the security and privacy of our users. </p>
<p> If you are using the AirQo web platform, please click on the following link to verify your account: <a href="${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}">verification link</a></p>
<p> If you are using the AirQo mobile app, you can verify your account directly within the app.</p>
<p> This verification link will be valid for ${constants.EMAIL_VERIFICATION_HOURS} hour(s). If you do not verify your email within this time, you will need to request a new verification email.</p>
<p> If you have any questions or need assistance with the verification process, please don't hesitate to reach out to our support team: support@airqo.net.</p>
<p> Thank you for choosing AirQo, and we look forward to helping you achieve your goals</p>
<p> Sincerely,</p>
<p> The AirQo Data Team</p>
`;
      const result = emailTemplatesUtil.emailVerification(
        firstName,
        user_id,
        token,
      );
      expect(result).to.equal(expectedEmailVerificationTemplate);
    });
  });

  describe("composeEmailVerificationMessage", () => {
    it("should build the individual verification URL when no category is given", () => {
      const result = emailTemplatesUtil.composeEmailVerificationMessage({
        email: "test@example.com",
        firstName: "John",
        user_id: "123",
        token: "abc123",
      });

      expect(result).to.be.a("string");
      expect(result).to.include(
        `${constants.NEXUS_BASE_URL}/user/creation/individual/interest/123/abc123`,
      );
      expect(result).to.include("Welcome to AirQo");
      expect(result).to.include("Verify Email");
    });

    it("should build the organisation verification URL when category is 'organisation'", () => {
      const result = emailTemplatesUtil.composeEmailVerificationMessage({
        email: "test@example.com",
        firstName: "John",
        user_id: "123",
        token: "abc123",
        category: "organisation",
      });

      expect(result).to.include(
        `${constants.NEXUS_BASE_URL}/user/creation/organisation/verify/123/abc123`,
      );
    });
  });

  describe("afterEmailVerification", () => {
    it("should return the mobile-app copy when analyticsVersion is 4", () => {
      const result = emailTemplatesUtil.afterEmailVerification({
        firstName: "John",
        username: "john.doe",
        email: "john@example.com",
        analyticsVersion: 4,
      });

      expect(result).to.be.a("string");
      expect(result).to.include(
        "Congratulations! Your AirQo account has been successfully verified.",
      );
      expect(result).to.include(
        "the features and services offered by the AirQo mobile application.",
      );
    });

    it("should return the web-app copy with the AirQo Nexus and AirQo Vertex product cards by default", () => {
      const result = emailTemplatesUtil.afterEmailVerification({
        firstName: "John",
        username: "john.doe",
        email: "john@example.com",
      });

      expect(result).to.be.a("string");
      expect(result).to.include("Your email is verified");
      expect(result).to.include("AirQo Nexus");
      expect(result).to.include("Open Nexus");
      expect(result).to.include("AirQo Vertex");
      expect(result).to.include("Open AirQo Vertex");
      expect(result).to.include("john.doe");
    });
  });

  describe("afterAcceptingInvitation", () => {
    it("should include the entity title, username, and login link", () => {
      const result = emailTemplatesUtil.afterAcceptingInvitation({
        firstName: "John",
        username: "john.doe",
        email: "john@example.com",
        entity_title: "clean air team",
        login_url: "https://nexus.airqo.net/user/login",
      });

      expect(result).to.be.a("string");
      expect(result).to.include("CLEAN AIR TEAM");
      expect(result).to.include("YOUR USERNAME: john.doe");
      expect(result).to.include("https://nexus.airqo.net/user/login");
    });

    it("should fall back to the NEXUS_BASE_URL login link when login_url is not provided", () => {
      const result = emailTemplatesUtil.afterAcceptingInvitation({
        firstName: "John",
        username: "john.doe",
        email: "john@example.com",
        entity_title: "",
      });

      expect(result).to.include(`${constants.NEXUS_BASE_URL}/user/login`);
      expect(result).to.include("the team");
    });
  });

  describe("deleteMobileAccountEmail", () => {
    it("should return the correct email template with provided email and token", () => {
      const email = "johndoe@test.com";
      const token = "abcdef123456";

      const result = emailTemplatesUtil.deleteMobileAccountEmail(
        email,
        token,
      );

      expect(result).to.be.a("string");
      expect(result).to.include(
        "We received your request to delete your AirQo account.",
      );
      expect(result).to.include(`Enter the verification code: ${token}`);
    });
  });

  describe("mobileEmailVerification", () => {
    it("should include the token, email, and firebase_uid", () => {
      const result = emailTemplatesUtil.mobileEmailVerification({
        email: "johndoe@test.com",
        firebase_uid: "firebase-uid-123",
        token: "654321",
      });

      expect(result).to.be.a("string");
      expect(result).to.include("Welcome to AirQo Mobile!");
      expect(result).to.include("654321");
      expect(result).to.include("johndoe@test.com");
      expect(result).to.include("firebase-uid-123");
    });
  });
});
