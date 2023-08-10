require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mailer = require("@utils/mailer");
const msgTemplates = require("@utils/email.templates");
const constants = require("@config/constants");
const msgs = require("@utils/email.msgs");
const transporter = require("@config/mailer");

describe("mailer", () => {
  describe("candidate", () => {
    let sendMailStub;

    before(() => {
      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(transporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.reset();
    });

    after(() => {
      // Restore the original sendMail function after all tests
      sendMailStub.restore();
    });

    it("should send an email and return success response", async () => {
      // Set up the input parameters
      const firstName = "John";
      const lastName = "Doe";
      const email = "john.doe@example.com";
      const tenant = "airqo";

      const response = {
        accepted: [email],
        rejected: [],
      };

      // Stub the sendMail function to resolve with the response
      sendMailStub.resolves(response);

      // Call the mailer.candidate function
      const result = await mailer.candidate(firstName, lastName, email, tenant);

      // Assert the result
      expect(result).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: response,
        status: 200,
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal(
        "AirQo Analytics JOIN request"
      );
      expect(sendMailStub.firstCall.args[0].html).to.equal(
        msgs.joinRequest(firstName, lastName, email)
      );
      expect(sendMailStub.firstCall.args[0].bcc).to.equal(
        constants.REQUEST_ACCESS_EMAILS
      );
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Set up the input parameters
      const firstName = "Jane";
      const lastName = "Smith";
      const email = "jane.smith@example.com";
      const tenant = "another-tenant";

      // Set up the response from the fake transporter
      const response = {
        accepted: [],
        rejected: [email],
      };

      // Stub the sendMail function to resolve with the response
      sendMailStub.resolves(response);

      // Call the mailer.candidate function
      const result = await mailer.candidate(firstName, lastName, email, tenant);

      // Assert the result
      expect(result).to.deep.equal({
        success: false,
        message: "email not sent",
        status: 500,
        errors: { message: response },
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal(
        "AirQo Analytics JOIN request"
      );
      expect(sendMailStub.firstCall.args[0].html).to.equal(
        msgs.joinRequest(firstName, lastName, email)
      );
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
    });

    it("should handle internal server error and return error response", async () => {
      // Set up the input parameters
      const firstName = "Error";
      const lastName = "Test";
      const email = "error.test@example.com";
      const tenant = "airqo";

      // Stub the sendMail function to reject with an error
      sendMailStub.rejects(new Error("Mocked sendMail error"));

      // Call the mailer.candidate function
      const result = await mailer.candidate(firstName, lastName, email, tenant);

      // Assert the result
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        error: "Mocked sendMail error",
        errors: { message: "Mocked sendMail error" },
        status: 500,
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal(
        "AirQo Analytics JOIN request"
      );
      expect(sendMailStub.firstCall.args[0].html).to.equal(
        msgs.joinRequest(firstName, lastName, email)
      );
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
    });
  });
  describe("inquiry", () => {
    let sendMailStub;

    before(() => {
      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(transporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.reset();
    });

    after(() => {
      // Restore the original sendMail function after all tests
      sendMailStub.restore();
    });

    it("should send inquiry email depending on the category and return success response", async () => {
      const fullName = "John Doe";
      const email = "john.doe@example.com";
      const tenant = "airqo";
      // const categories = ["policy", "partners", "general", "researchers", "developers", "champions"];
      const category = "policy";
      const response = {
        accepted: [email],
        rejected: [],
      };
      sendMailStub.resolves(response);


      const result = await mailer.inquiry(fullName, email, category, "", tenant);
      console.log(sendMailStub.firstCall.args[0].html)
      console.log(msgs.inquiry(fullName, email, category))

      expect(result).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: response,
        status: 200,
      });
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal("Welcome to AirQo");
      expect(sendMailStub.firstCall.args[0].html).to.equal(msgs.inquiry(fullName, email, category));


    });

    it("should handle email not sent scenario and return error response", async () => {
      const fullName = "John Doe";
      const email = "john.doe@example.com";
      const tenant = "another-tenant";
      const category = "partner";

      const response = {
        accepted: [],
        rejected: [email],
      };
      sendMailStub.resolves(response);
      const result = await mailer.inquiry(fullName, email, category, "", tenant);

      // Assert the result
      expect(result).to.deep.equal({
        success: false,
        message: "email not sent",
        status: 500,
        errors: { message: response },
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal("Welcome to AirQo");
    });

    it("should handle internal server error and return error response", async () => {
      const fullName = "John Doe";
      const email = "john.doe@example.com";
      const tenant = "airqo";
      const category = "general";

      // Stub the sendMail function to reject with an error
      sendMailStub.rejects(new Error("Mocked sendMail error"));
      const result = await mailer.inquiry(fullName, email, category, "", tenant);

      // Assert the result
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        error: "Mocked sendMail error",
        errors: { message: "Mocked sendMail error" },
        status: 500,
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal("Welcome to AirQo");
      expect(sendMailStub.firstCall.args[0].html).to.equal(msgs.inquiry(fullName, email, category));
    });

    // Add more tests for other categories (policy, champions, researchers, developers, general)...
  });
  describe("user", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send KCCA user welcome email and return success response", async () => {
      // Arrange
      const firstName = "John";
      const lastName = "Doe";
      const email = "johndoe@example.com";
      const password = "securepassword";
      const tenant = "kcca";
      const type = "confirm";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Welcome to the AirQo KCCA Platform",
        text: msgs.welcome_kcca(firstName, lastName, password, email),
        bcc: constants.REQUEST_ACCESS_EMAILS,
      };

      // Act
      // Assuming transporter is accessible from the user function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.user(
        firstName,
        lastName,
        email,
        password,
        tenant,
        type
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should send general user welcome email and return success response", async () => {
      // Arrange
      const firstName = "Jane";
      const lastName = "Smith";
      const email = "janesmith@example.com";
      const password = "password123";
      const tenant = "airqo";
      const type = "confirm";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Welcome to AirQo Analytics",
        text: msgs.welcome_general(firstName, lastName, password, email),
        bcc: constants.REQUEST_ACCESS_EMAILS,
      };

      // Act
      // Assuming transporter is accessible from the user function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.user(
        firstName,
        lastName,
        email,
        password,
        tenant,
        type
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the user function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.user(
        "John Doe",
        "johndoe@example.com",
        "Test password",
        "kcca",
        "confirm"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Email not sent" },
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the user function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.user(
        "John Doe",
        "johndoe@example.com",
        "Test password",
        "airqo",
        "confirm"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        error: "Internal server error",
        errors: { message: "Internal server error" },
      });
    });

    // Add more tests for other cases...
  });
  describe("verifyEmail", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send verification email and return success response", async () => {
      // Arrange
      const user_id = "123456";
      const token = "abcdef";
      const email = "johndoe@example.com";
      const firstName = "John Doe";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Verify your AirQo Analytics account",
        html: msgTemplates.v2_emailVerification(
          email,
          firstName,
          user_id,
          token
        ),
        bcc: constants.REQUEST_ACCESS_EMAILS,
        attachments: [
          // Your attachment objects...
        ],
      };

      // Act
      // Assuming transporter is accessible from the verifyEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.verifyEmail({
        user_id,
        token,
        email,
        firstName,
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the verifyEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.verifyEmail({
        user_id: "123456",
        token: "abcdef",
        email: "johndoe@example.com",
        firstName: "John Doe",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "email not sent",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the verifyEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.verifyEmail({
        user_id: "123456",
        token: "abcdef",
        email: "johndoe@example.com",
        firstName: "John Doe",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe("afterEmailVerification", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send verification email and return success response", async () => {
      // Arrange
      const firstName = "John";
      const username = "john_doe";
      const email = "johndoe@example.com";
      const password = "s3cr3tP@ssw0rd";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Welcome to AirQo!",
        html: msgTemplates.afterEmailVerification(
          firstName,
          username,
          password
        ),
        bcc: constants.REQUEST_ACCESS_EMAILS,
      };

      // Act
      // Assuming transporter is accessible from the afterEmailVerification function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.afterEmailVerification({
        firstName,
        username,
        email,
        password,
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the afterEmailVerification function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.afterEmailVerification({
        firstName: "John",
        username: "john_doe",
        email: "johndoe@example.com",
        password: "s3cr3tP@ssw0rd",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "email not sent",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the afterEmailVerification function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.afterEmailVerification({
        firstName: "John",
        username: "john_doe",
        email: "johndoe@example.com",
        password: "s3cr3tP@ssw0rd",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe("forgot", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send recovery email and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const token = "abcdef123456";
      const tenant = "airqo";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Link To Reset Password",
        text: msgs.recovery_email(token, tenant),
      };

      // Act
      // Assuming transporter is accessible from the forgot function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.forgot(email, token, tenant);

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the forgot function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.forgot(
        "johndoe@example.com",
        "abcdef123456",
        "airqo"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the forgot function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.forgot(
        "johndoe@example.com",
        "abcdef123456",
        "airqo"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe.only("signInWithEmailLink", () => {
    let sendMailStub;

    before(() => {
      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(transporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.reset();
    });

    after(() => {
      // Restore the original sendMail function after all tests
      sendMailStub.restore();
    });

    it("should send an email and return success response", async () => {
      // Set up the input parameters
      const email = "johndoe@example.com";
      const token = "abcdef123456";

      const response = {
        accepted: [email],
        rejected: [],
      };

      // Stub the sendMail function to resolve with the response
      sendMailStub.resolves(response);

      // Call the mailer.candidate function
      const result = await mailer.signInWithEmailLink(email, token);

      // Assert the result
      expect(result).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: response,
        status: 200,
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal("Verify your email address!");
      expect(sendMailStub.firstCall.args[0].html).to.equal(msgs.join_by_email(email, token));
    });

    it("should handle email not sent scenario and return error response", async () => {
      const email = "johndoe@example.com";
      const token = "abcdef123456";

      // Set up the response from the fake transporter
      const response = {
        accepted: [],
        rejected: [email],
      };

      // Stub the sendMail function to resolve with the response
      sendMailStub.resolves(response);

      const result = await mailer.signInWithEmailLink(email, token);

      // Assert the result
      expect(result).to.deep.equal({
        errors: { message: response },
        success: false,
        "message": "Internal Server Error",
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal("Verify your email address!");
      expect(sendMailStub.firstCall.args[0].html).to.equal(msgs.join_by_email(email, token));
    });

    it("should handle internal server error and return error response", async () => {
      const email = "johndoe@example.com";
      const token = "abcdef123456";

      // Stub the sendMail function to reject with an error
      sendMailStub.rejects(new Error("Mocked sendMail error"));

      const result = await mailer.signInWithEmailLink(email, token);

      // Assert the result
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Mocked sendMail error" },
      });

      // Assert that the sendMail function was called with the correct parameters
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0].from).to.deep.equal({
        name: constants.EMAIL_NAME,
        address: constants.EMAIL,
      });
      expect(sendMailStub.firstCall.args[0].to).to.equal(email);
      expect(sendMailStub.firstCall.args[0].subject).to.equal("Verify your email address!");
      expect(sendMailStub.firstCall.args[0].html).to.equal(msgs.join_by_email(email, token));
    });
  });
  describe("deleteMobileAccountEmail", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send delete account email with token and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const token = "abcdef123456";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Confirm Account Deletion - AirQo",
        html: msgTemplates.deleteMobileAccountEmail(email, token),
        attachments: [
          // Attachments...
        ],
      };

      // Act
      // Assuming transporter is accessible from the deleteMobileAccountEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.deleteMobileAccountEmail(email, token);

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the deleteMobileAccountEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.deleteMobileAccountEmail(
        "johndoe@example.com",
        "abcdef123456"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the deleteMobileAccountEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.deleteMobileAccountEmail(
        "johndoe@example.com",
        "abcdef123456"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe("authenticateEmail", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send email for email authentication and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const token = "abcdef123456";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "Changes to your AirQo email",
        text: msgs.authenticate_email(token),
      };

      // Act
      // Assuming transporter is accessible from the authenticateEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.authenticateEmail(email, token);

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the authenticateEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.authenticateEmail(
        "johndoe@example.com",
        "abcdef123456"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the authenticateEmail function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.authenticateEmail(
        "johndoe@example.com",
        "abcdef123456"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe("update", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send email for account update and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const firstName = "John";
      const lastName = "Doe";
      const updatedUserDetails = {
        /* your updated user details here */
      };
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "AirQo Analytics account updated",
        text: msgs.user_updated(firstName, lastName, updatedUserDetails),
      };

      // Act
      // Assuming transporter is accessible from the update function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.update(
        email,
        firstName,
        lastName,
        updatedUserDetails
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the update function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.update(
        "johndoe@example.com",
        "John",
        "Doe",
        {}
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the update function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.update(
        "johndoe@example.com",
        "John",
        "Doe",
        {}
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe("updateForgottenPassword", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send email for forgotten password update and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const firstName = "John";
      const lastName = "Doe";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "AirQo Analytics Password Reset Successful",
        text: msgs.forgotten_password_updated(firstName, lastName),
      };

      // Act
      // Assuming transporter is accessible from the updateForgottenPassword function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.updateForgottenPassword(
        email,
        firstName,
        lastName
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the updateForgottenPassword function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.updateForgottenPassword(
        "johndoe@example.com",
        "John",
        "Doe"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the updateForgottenPassword function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.updateForgottenPassword(
        "johndoe@example.com",
        "John",
        "Doe"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe("updateKnownPassword", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send email for known password update and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const firstName = "John";
      const lastName = "Doe";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: "AirQo Analytics Password Update Successful",
        text: msgs.known_password_updated(firstName, lastName),
      };

      // Act
      // Assuming transporter is accessible from the updateKnownPassword function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.updateKnownPassword(
        email,
        firstName,
        lastName
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the updateKnownPassword function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.updateKnownPassword(
        "johndoe@example.com",
        "John",
        "Doe"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Email not sent" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the updateKnownPassword function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.updateKnownPassword(
        "johndoe@example.com",
        "John",
        "Doe"
      );

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more tests for other cases...
  });
  describe("newMobileAppUser", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send email to new mobile app user and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const subject = "Welcome to AirQo Mobile App";
      const message = "<p>Dear John, welcome to AirQo Mobile App!</p>";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject,
        html: message,
        to: email,
        bcc: constants.REQUEST_ACCESS_EMAILS,
      };

      // Act
      // Assuming transporter is accessible from the newMobileAppUser function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.newMobileAppUser({
        email,
        subject,
        message,
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the newMobileAppUser function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.newMobileAppUser({
        email: "johndoe@example.com",
        subject: "Welcome to AirQo Mobile App",
        message: "<p>Dear John, welcome to AirQo Mobile App!</p>",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "email not sent",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Email not sent" },
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the newMobileAppUser function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.newMobileAppUser({
        email: "johndoe@example.com",
        subject: "Welcome to AirQo Mobile App",
        message: "<p>Dear John, welcome to AirQo Mobile App!</p>",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "internal server error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Internal server error" },
      });
    });

    // Add more tests for other cases...
  });
  describe("feedback", () => {
    let fakeTransporter;
    let sendMailStub;

    beforeEach(() => {
      // Create a fake transporter object for mocking the sendMail function
      fakeTransporter = {
        sendMail: () => {},
      };

      // Create a stub for the sendMail function to simulate sending emails
      sendMailStub = sinon.stub(fakeTransporter, "sendMail");
    });

    afterEach(() => {
      // Restore the sendMail stub after each test
      sendMailStub.restore();
    });

    it("should send feedback email and return success response", async () => {
      // Arrange
      const email = "johndoe@example.com";
      const subject = "Feedback on AirQo Analytics";
      const message = "This is a feedback message.";
      const expectedMailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject,
        text: message,
        cc: email,
        to: constants.SUPPORT_EMAIL,
        bcc: constants.REQUEST_ACCESS_EMAILS,
      };

      // Act
      // Assuming transporter is accessible from the feedback function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.feedback({ email, subject, message });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(sendMailStub.firstCall.args[0]).to.deep.equal(expectedMailOptions);
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {}, // Replace with the expected data if needed
        status: httpStatus.OK,
      });
    });

    it("should handle feedback email to automated-tests@airqo.net and return success response", async () => {
      // Arrange
      const email = "automated-tests@airqo.net";
      const subject = "Feedback on AirQo Analytics";
      const message = "This is a feedback message.";

      // Act
      // Assuming transporter is accessible from the feedback function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.feedback({ email, subject, message });

      // Assert
      expect(sendMailStub.notCalled).to.be.true;
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: [],
        status: httpStatus.OK,
      });
    });

    it("should handle email not sent scenario and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate email rejection
      sendMailStub.rejects(new Error("Email not sent"));

      // Act
      // Assuming transporter is accessible from the feedback function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.feedback({
        email: "johndoe@example.com",
        subject: "Feedback on AirQo Analytics",
        message: "This is a feedback message.",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "email not sent",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Email not sent" },
      });
    });

    it("should handle internal server error and return error response", async () => {
      // Arrange
      // Set up the fakeTransporter to simulate an error during email sending
      sendMailStub.rejects(new Error("Internal server error"));

      // Act
      // Assuming transporter is accessible from the feedback function
      // Replace the transporter with the fakeTransporter for testing
      const response = await mailer.feedback({
        email: "johndoe@example.com",
        subject: "Feedback on AirQo Analytics",
        message: "This is a feedback message.",
      });

      // Assert
      expect(sendMailStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Internal server error" },
      });
    });

    // Add more tests for other cases...
  });
  describe("verifyMobileEmail()", () => {
    let transporterStub;

    beforeEach(() => {
      transporterStub = sinon
        .stub()
        .resolves({ accepted: ["test@example.com"], rejected: [] });
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should send email successfully", async () => {
      sinon.stub(transporter, "sendMail").callsFake(transporterStub);

      const result = await mailer.verifyMobileEmail({
        firebase_uid: "firebase_uid",
        token: "token",
        email: "test@example.com",
      });

      expect(result).to.deep.equal({
        success: true,
        message: "email successfully sent",
        data: { accepted: ["test@example.com"], rejected: [] },
        status: httpStatus.OK,
      });
      expect(transporter.sendMail.calledOnce).to.be.true;
    });

    it("should handle email sending failure", async () => {
      transporterStub.rejects(new Error("Email sending failed"));

      sinon.stub(transporter, "sendMail").callsFake(transporterStub);

      const result = await mailer.verifyMobileEmail({
        firebase_uid: "firebase_uid",
        token: "token",
        email: "test@example.com",
      });

      expect(result).to.deep.equal({
        success: false,
        message: "email not sent",
        errors: { message: new Error("Email sending failed") },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
      expect(transporter.sendMail.calledOnce).to.be.true;
    });

    it("should handle internal server error", async () => {
      sinon
        .stub(transporter, "sendMail")
        .throws(new Error("Internal Server Error"));

      const result = await mailer.verifyMobileEmail({
        firebase_uid: "firebase_uid",
        token: "token",
        email: "test@example.com",
      });

      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: new Error("Internal Server Error") },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
      expect(transporter.sendMail.calledOnce).to.be.true;
    });
  });
  describe("mobileEmailVerification()", () => {
    it("should generate the email HTML content correctly", () => {
      const result = mobileEmailVerification({
        email: "test@example.com",
        firebase_uid: "firebase_uid",
        token: "12345",
      });

      expect(result).to.be.a("string");
      expect(result).to.contain("Welcome to AirQo Analytics");
      expect(result).to.contain("Thank you for choosing AirQo Mobile!");
      expect(result).to.contain("Your Login Code for AirQo Mobile");
      expect(result).to.contain("12345");
      expect(result).to.contain(
        "You can set a permanent password anytime within your AirQo Analytics personal settings"
      );
    });
  });

  // Add more describe blocks for other mailer functions if needed...
});
