require("module-alias/register");
const { expect } = require("chai");
const emailTemplatesUtil = require("@utils/email.templates");
const sinon = require("sinon");
const constants = require("@config/constants");

describe("email.templates", () => {
  describe("confirm", () => {
    it("should return the correct confirm object", () => {
      const id = "12345";
      const expectedConfirmObject = {
        subject: "AirQo Analytics JOIN request",
        html: `<a href='${constants.CLIENT_ORIGIN}/confirm/${id}'>Click to know more about AirQo</a>`,
        text: `Copy and paste this link: ${constants.CLIENT_ORIGIN}/confirm/${id}`,
      };
      const result = emailTemplatesUtil.confirm(id);
      expect(result).to.deep.equal(expectedConfirmObject);
    });
  });
  describe("inquiryTemplate", () => {
    it("should return the correct inquiry template with full name", () => {
      const fullName = "John Doe";
      const expectedInquiryTemplate = `
      <h3>Hi ${fullName}</h3>
      <p>We are excited to welcome you to AirQo and we are even more excited about what we have got planned. You are already on your way to creating beautiful visual products.</p>
      <br> 
      <p>Whether you are here for your brand, for a cause, or just for fun, welcome!</p>
      <p>If there is anything you need, we will be here every step of the way.</p>
      <br> 
      <a href=${constants.PLATFORM_BASE_URL}> Check out AirQo Analytics</a>
      <p>Weekly new updates and improvements to our products</p>
      <br> 
      <a href=${constants.PLATFORM_BASE_URL}> Support our expansion in Africa</a>
      <p>Stay up to date with the latest announcements and jobs</p>
      <br> 
      <a href=${constants.PLATFORM_BASE_URL}> Support our ongoing projects</a>
      <p>Find out how you can support our ongoing projects</p>
      <br> 
      <p>Thank you for signing up. If you have any questions, send us a message at info@airqo.net or on <a href=${constants.TWITTER_ACCOUNT}>Twitter</a>. We would love to hear from you.</p>
      <br> 
      <p>--The AirQo team.</p>
      </div>`;
      const result = emailTemplatesUtil.inquiryTemplate(fullName);
      expect(result).to.equal(expectedInquiryTemplate);
    });
  });
  describe("emailVerification", () => {
    it("should return the correct email verification template with provided details", () => {
      const firstName = "John";
      const user_id = "123456789";
      const token = "abcdef123456";
      const expectedEmailVerificationTemplate = `
      <h3>Dear ${firstName}</h3>
      <p> Thank you for signing up for AirQo Analytics! We are excited to have you on board.</p>
      <p> Before you can fully access all of the features and services offered by AirQo Analytics, we need to verify your account. </p>
      <p> This is a quick and easy process that helps us ensure the security and privacy of our users. </p>
      <br>
      <p> To verify your account, please click on the following link: <a href=${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}>verification link</a></p>
      <p> This verification link will be valid for ${constants.EMAIL_VERIFICATION_HOURS} hour(s). If you do not verify your email within this time, you will need to request a new verification email.</p>
      <br>
      <p> If you have any questions or need assistance with the verification process, please don't hesitate to reach out to our support team: support@airqo.net.</p>
      <br>
      <p> Thank you for choosing AirQo Analytics, and we look forward to helping you achieve your goals</p>
      <br>
      <p> Sincerely,</p>
      <p> The AirQo Data Team</p>
      `;
      const result = emailTemplatesUtil.emailVerification(
        firstName,
        user_id,
        token
      );
      expect(result).to.equal(expectedEmailVerificationTemplate);
    });
  });
  describe("v2_emailVerification", () => {
    it("should generate the email content with the correct URL", () => {
      // Define test data
      const testData = {
        email: "test@example.com",
        firstName: "John",
        user_id: "123",
        token: "abc123",
        category: "individual", // or 'organization'
      };

      // Mock the constants.ANALYTICS_BASE_URL
      sinon.stub(constants, "ANALYTICS_BASE_URL").value("http://example.com");

      // Call the function
      const result = emailTemplatesUtil.v2_emailVerification(testData);

      // Expectations
      expect(result).to.be.an("object");
      expect(result.subject).to.be.a("string");
      expect(result.content).to.be.a("string");
      expect(result.email).to.equal("test@example.com");

      // Restore the stub after the test
      constants.ANALYTICS_BASE_URL.restore();
    });

    // Add more test cases as needed
  });
  describe("afterEmailVerification", () => {
    it("should return the correct after email verification template with provided details", () => {
      const firstName = "John";
      const username = "john.doe";
      const password = "securepassword";
      const expectedAfterEmailVerificationTemplate = `
<h3>Dear ${firstName}</h3>
<p> Congratulations! Your account has been successfully verified.</p>
<p> We are pleased to inform you that you can now fully access all of the features and services offered by AirQo Analytics.</p>
<br>
<p>YOUR USERAME: ${username} </p>
<p>YOUR PASSWORD: ${password} </p>
<p>ACCESS LINK: ${constants.PLATFORM_BASE_URL}/login </p>
<br>
<p> If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support team. We are here to help.</p>
<p> Thank you for choosing AirQo Analytics, and we look forward to helping you achieve your goals </p>
<br>
<p> Sincerely, <p>
<p> The AirQo Data Team </p>
`;
      const result = emailTemplatesUtil.afterEmailVerification(
        firstName,
        username,
        password
      );
      expect(result).to.equal(expectedAfterEmailVerificationTemplate);
    });
  });

  describe("mobileAppWelcome", () => {
    it("should return the correct mobile app welcome template with provided full name", () => {
      const fullName = "John Doe";
      const expectedMobileAppWelcomeTemplate = `
<p> We're thrilled to have you onboard and excited for you to experience all that our app has to offer. This is the first step to Know Your Air and Breathe Clean.</p>  
<p> With the AirQo app, you'll have access to:<p/>
<p>1. Air quality analytics - view air quality readings by day/week in different locations</p>
<p>2. For You - personalized air quality recommendations based on what you share frequently and your favorite locations</p>
<p>3. Search - find locations by location name or by navigating the map</p>
<p>4. Know your air - a fun way of learning about air quality</p>
<p>We've designed it to be easy to use and navigate, so you can find what you're looking for quickly. Get air quality information like air quality lessons and tips on how to reduce air pollution that you can share with your pals through text or visual updates.</p>
<p>We're constantly updating and improving our app to make sure you have the best experience possible. If you have any questions or feedback, please don't hesitate to reach out to us through the app's support feature</p>
<p>Thank you for choosing our app, and we can't wait for you to see what it can do for you. Happy exploring!</p>`;
      const result = emailTemplatesUtil.mobileAppWelcome(fullName);
      expect(result).to.equal(expectedMobileAppWelcomeTemplate);
    });
  });
  describe("deleteMobileAccountEmail", () => {
    it("should return the correct email template with provided email and token", () => {
      const email = "johndoe@test.com";
      const token = "abcdef123456";

      const url = `${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}`;
      const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    We received your request to delete your AirQo account. Before we proceed, we need to verify your identity. Please follow
                                    the instructions below:
                                    <br />
                                    <ol>
                                        <li>Open the app.</li>
                                        <li>Enter the verification code: ${token}</li>
                                    </ol>
                                    
                                    Please note that deleting your account will permanently remove all your data associated with AirQo. This action cannot
                                    be undone.
                                    <br /><br />
                                    
                                    If you did not initiate this request, please contact our support team immediately.
                                    Thank you for using AirQo.

                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY(email, content, name);
      const result = emailTemplatesUtil.deleteMobileAccountEmail(email, token);
      const joinRequestSpy = sinon.spy(
        emailTemplatesUtil,
        "deleteMobileAccountEmail"
      );
      expect(result).to.equal(expectedMessage);
      expect(joinRequestSpy.calledOnceWith(email, token)).to.be.true;
      joinRequestSpy.restore();
      expect(result).to.equal(expectedMessage);
    });
  });
});
