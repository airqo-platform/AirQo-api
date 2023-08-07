require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const constants = require("@config/constants");
const msgs = require("../email.msgs");

describe("email.msgs", () => {


  describe("recovery_email", () => {
    it("should return the correct recovery email message", () => {
      const token = "example-token";
      const tenant = "example-tenant";
      const expectedMessage =
        "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
        "Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n" +
        `https://example.com/reset-password?token=${token}&tenant=${tenant}\n\n` +
        "If you did not request this, please ignore this email and your password will remain unchanged.\n";
      const result = constants.recovery_email(token, tenant);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("joinRequest", () => {
    it("should return the correct join request message with valid first name, last name and email", () => {
      const firstName = "John";
      const lastName = "Doe";
      const email = "john.doe@example.com";
      const name = firstName + " " + lastName;
      const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Your request to join AirQo Analytics has been received, we shall get back to you as soon as possible.
                                    <br />
                                    <br />
                                    Before utilising the AirQo data, your application record has to undergo the process of approval by AirQo Analytics
                                    administration.
                                    <br />
                                    Once your application is approved, you will receive a confirmation email<br />
                                    <br />Please visit our website to learn more about us. <a href="https://airqo.net/">AirQo</a>
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY(email, content, name);
      const joinRequestSpy = sinon.spy(msgs, "joinRequest");

      const result = msgs.joinRequest(firstName, lastName, email);
      expect(result).to.equal(expectedMessage);
      expect(joinRequestSpy.calledOnceWith(firstName, lastName, email)).to.be.true;
      joinRequestSpy.restore();
    });
  });
  describe("inquiry", () => {
    it("should return the correct inquiry message with valid full name depending on the category", () => {
      const name = "John";
      const email = "john.doe@example.com";
      const categories = ["policy", "partners", "general", "researchers", "developers", "champions"];
      for (let category of categories) {
        let content;
        switch (category) {
          case "policy":
            content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for getting in touch with us and for your interest in our work.
                                    <br />
                                    Kindly let us know how you would like to partner with us and we will get back to you.
                                    <br />
                                    Alternatively, you can get in touch with our Policy Engagement Officer Angela Nshimye at angela@airqo.net who will be of
                                    further support.
                                    <br />
                                </td>
                            </tr>`;
            break;
          case "champions":
            content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for getting in touch with us and for your interest in being an air quality champion in your community.
                                    <br />
                                As an air quality champion, you are key in advocating for clean air practices in your community and urging community
                                members to take action against air pollution.
                                    <br />
                                    Please get in touch with our Marketing and Communications Lead at maclina@airqo.net for further support.
                                    <br />
                                </td>
                            </tr>`;
            break;
          case "researchers":
            content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for your interest in accessing our air quality data to further research in air quality monitoring and
                                management,
                                    <br />
                            You can visit our website at airqo.net and navigate to <a href="https://airqo.net/explore-data">Explore Data</a> or
                            click <a href="https://airqo.net/explore-data">here</a> to access data.
                                    <br />
                                    If you still need further support, please contact our Data Scientists Richard Sserujogi at Richard@airqo.net or Wabinyai
                                    Fidel Raja at raja@airqo.net for further support.
                                    <br />
                                </td>
                            </tr>`;
            break;
          case "developers":
            content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for your interest in our work.
                                    <br />
                            Please get in touch with our Software Engineering Lead Martin Bbaale at martin@airqo.net for further support.
                                    <br />
                                </td>
                            </tr>`;
            break;
          case "general":
          case "partners":
          default:
            content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for getting in touch with us and for your interest in supporting our work in closing the air quality data gaps
                                in African Cities. We are happy to foster partnerships to advance air quality monitoring and management in African
                                Cities.
                                    <br />
                                    <br />
                                    Please get in touch with our project lead Professor Engineer at baino@airqo.net or Programme Manager Deo Okure at
                                    deo@airqo.net for further support.
                                    <br />
                                </td>
                            </tr>`;
            break;
        }
        const expectedMessage = constants.EMAIL_BODY(email, content, name);
        const result = msgs.inquiry(name, email, category);
        expect(result).to.equal(expectedMessage);

      }
    });
  });

  describe("welcome_kcca", () => {
    it("should return the correct welcome message for KCCA with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const password = "password123";
      const username = "john_doe123";
      const expectedMessage =
        `Dear John Doe \n\n` +
        "Welcome to the KCCA AirQo air quality monitoring platform. \n\n" +
        "Your username is: john_doe123\n" +
        "Your password is: password123\n\n" +
        "You can always change your password in your account settings after login\n" +
        `Follow this link to access the dashboard right now: ${constants.LOGIN_PAGE}\n` +
        "A guide to using AirQo Analytics will be found under the Documentation section of AirQo Analytics\n\n\n\n" +
        "PLEASE DO NOT REPLY TO THIS EMAIL\n\n" +
        "For KCCA related questions, please contact:\n" +
        "Sadam Yiga: syiga@kcca.go.ug or Eleth Nakazzi: enakazzi@kcca.go.ug \n " +
        "If you experience any technical challenges or wish to offer suggestions, please contact us at support@airqo.net";
      const result = constants.welcome_kcca(
        firstName,
        lastName,
        password,
        username
      );
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("welcome_general", () => {
    it("should return the correct welcome message with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const password = "password123";
      const username = "john_doe123";
      const expectedMessage =
        `Dear John Doe \n\n` +
        "Welcome to AirQo Analytics. Your login credentials are as follows: \n\n" +
        "YOUR USERNAME: john_doe123\n" +
        "YOUR PASSWORD: password123\n\n" +
        `To access the dashboard, please follow this link: ${constants.LOGIN_PAGE}\n` +
        "After login, you can change your password in your account settings.\n\n" +
        "You can also use your AirQo Analytics credentials to access the AirQo API\n" +
        "The AirQo API reference can be found here: https://docs.airqo.net/airqo-rest-api-documentation/ \n\n" +
        "By actively utilising AirQo Analytics, you automatically agree to the AirQo terms and conditions: https://docs.airqo.net/airqo-terms-and-conditions/HxYx3ysdA6k0ng6YJkU3/ \n\n" +
        "For any technical challenges or suggestions, please contact us at support@airqo.net. \n\n" +
        "Please note that this is an automated message, so please do not reply to this email. \n\n" +
        "To learn more about AirQo Analytics and its features, please refer to the user guide available here: https://docs.airqo.net/airqo-platform/ \n\n" +
        "Best regards, \n\n" +
        "AirQo Data Team";
      const result = constants.welcome_general(
        firstName,
        lastName,
        password,
        username
      );
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("user_updated", () => {
    it("should return the correct user_updated message with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const updatedData = {
        email: "john.doe@example.com",
        jobTitle: "Software Engineer",
      };
      const updatedFields = Object.keys(updatedData)
        .map((field) => `• ${field}`)
        .join("\n");
      const expectedMessage =
        `Dear John Doe,\n\n` +
        "Your AirQo Analytics account details have been updated.\n\n" +
        "The following fields have been updated:\n" +
        "• email\n" +
        "• jobTitle\n\n" +
        "If this activity sounds suspicious to you, please reach out to your organization's administrator.\n\n" +
        `Follow this link to access AirQo Analytics right now: ${constants.LOGIN_PAGE}\n`;
      const result = constants.user_updated(firstName, lastName, updatedData);
      expect(result).to.equal(expectedMessage);
    });

    it("should return the correct user_updated message with no updated fields", () => {
      const firstName = "John";
      const lastName = "Doe";
      const updatedData = {};
      const expectedMessage =
        `Dear John Doe,\n\n` +
        "Your AirQo Analytics account details have been updated.\n\n" +
        "The following fields have been updated:\n\n" +
        "If this activity sounds suspicious to you, please reach out to your organization's administrator.\n\n" +
        `Follow this link to access AirQo Analytics right now: ${constants.LOGIN_PAGE}\n`;
      const result = constants.user_updated(firstName, lastName, updatedData);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("forgotten_password_updated", () => {
    it("should return the correct forgotten_password_updated message with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const expectedMessage =
        `Dear John Doe,\n\n` +
        "Your AirQo Analytics account password has been successfully reset.\n\n" +
        "If you did not initiate this password reset, please reach out to your organization's administrator immediately.\n\n" +
        `Follow this link to access AirQo Analytics: ${constants.LOGIN_PAGE}\n`;
      const result = constants.forgotten_password_updated(firstName, lastName);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("known_password_updated", () => {
    it("should return the correct known_password_updated message with valid inputs", () => {
      const firstName = "Jane";
      const lastName = "Smith";
      const expectedMessage =
        `Dear Jane Smith,\n\n` +
        "Your AirQo Analytics account password has been successfully updated.\n\n" +
        "If you did not initiate this password change, please reach out to your organization's administrator immediately.\n\n" +
        `Follow this link to access AirQo Analytics: ${constants.LOGIN_PAGE}\n`;
      const result = constants.known_password_updated(firstName, lastName);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("join_by_email", () => {
    it("should return the correct join_by_email message with valid inputs", () => {
      const email = "john.doe@example.com";
      const token = "ABC123";
      const content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                To get started with "Knowing Your Air" and Breathing Clean, we need to verify your email address.
                                    <br /><br />
                                    Please Enter the code: ${token}
                                    <br /><br />
                                    That's it! Once verified, you'll gain access to all the app's features. Enjoy tracking your air quality and making
                                    informed decisions for a healthier life.

                                    <br />
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY(email, content);
      const joinRequestSpy = sinon.spy(msgs, "join_by_email");

      const result = msgs.join_by_email(email, token);
      expect(result).to.equal(expectedMessage);
      expect(joinRequestSpy.calledOnceWith(email, token)).to.be.true;
      joinRequestSpy.restore();
    });
  });
  describe("authenticate_email", () => {
    it("should return the correct authenticate_email message with valid token", () => {
      const token = "ABC123";
      const expectedMessage = `You are about to make changes to your email address. \n\nFirst, you need you to re-authenticate.\n\nEnter the code below in the app. \n\nThe code: ${token}`;
      const result = constants.authenticate_email(token);
      expect(result).to.equal(expectedMessage);
    });
  });
});
