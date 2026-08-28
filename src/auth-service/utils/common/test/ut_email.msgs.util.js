require("module-alias/register");
const { expect } = require("chai");
const constants = require("@config/constants");
const msgs = require("../email.msgs.util");

describe("email.msgs", () => {
  describe("recovery_email", () => {
    it("should return the correct recovery email message", () => {
      const token = "example-token";
      const email = "john.doe@example.com";
      const PASSWORD_RESET_URL = `${constants.NEXUS_BASE_URL}/user/forgotPwd/reset`;
      const instructions = `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it: ${PASSWORD_RESET_URL}?token=${token}`;
      const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    You are receiving this because you (or someone else) have requested the reset of the password for your AirQo account.
                                    <br />
                                    <br />
                                    ${instructions}
                                    <br />
                                    <br />
                                    If you are using the AirQo mobile app, you can also reset your password directly within the app.
                                    <br />
                                    <br />
                                    If you did not request this, please ignore this email and your password will remain unchanged.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content });
      const result = msgs.recovery_email({ token, email });
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
                                    Your request to join AirQo has been received, we shall get back to you as soon as possible.
                                    <br />
                                    <br />
                                    Before utilising the AirQo data, your application record has to undergo the process of approval by AirQo administration.
                                    <br />
                                    Once your application is approved, you will receive a confirmation email.
                                    <br />
                                    <br />
                                    Whether you use the AirQo web platform or the mobile app, you will be able to access the data once your request is approved.
                                    <br />
                                    <br />
                                    Please visit our website to learn more about us. <a href="https://airqo.net/">AirQo</a>
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content, name });
      const result = msgs.joinRequest(firstName, lastName, email);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("inquiry", () => {
    it("should return the correct inquiry message with valid full name depending on the category", () => {
      const name = "John";
      const email = "john.doe@example.com";

      // Distinguishing fragments per category, rather than duplicating the
      // full HTML content block (which drifts out of sync with the source
      // on every wording tweak — see recovery_email/joinRequest history).
      // Source only branches on "policy", "researchers", "developers"; every
      // other category (including "partners", "general", "champions") falls
      // through to the same default "funder/partner" copy.
      const distinguishingFragmentByCategory = {
        policy: "angela@airqo.net",
        researchers: "raja@airqo.net",
        developers:
          "https://docs.google.com/forms/d/e/1FAIpQLSc7xixPoIo65pe6mlbNVB8jM5F4ZKCz87SmQTY412XbsqWrLQ/viewform",
        general: "dokure@airqo.net",
        partners: "dokure@airqo.net",
        champions: "dokure@airqo.net",
      };

      for (const [category, fragment] of Object.entries(
        distinguishingFragmentByCategory
      )) {
        const result = msgs.inquiry(name, email, category);
        // Wrapped through EMAIL_BODY with the real name/email (regression
        // guard for the fullName/name key-mismatch bug that previously
        // suppressed this greeting in every inquiry email sent).
        expect(result).to.include(`Dear ${name},`);
        expect(result).to.include(email);
        expect(result).to.include(fragment);
      }
    });
  });

  describe("welcome_kcca", () => {
    it("should return the correct welcome message for KCCA with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const password = "password123";
      const email = "johndoe@test.com";
      const name = firstName + " " + lastName;
      const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Welcome to the KCCA AirQo air quality monitoring platform.
                                    <br />
                                    Your username is: ${email}
                                    <br />
                                    Your password is: ${password}
                                    <br /><br />
                                    You can always change your password in your account settings after login. Follow this link to access the dashboard right
                                    now: ${constants.LOGIN_PAGE}
                                    <br />
                                    A guide to using AirQo Nexus will be found under the Documentation section of AirQo Nexus
                                    <br /><br />
                                    PLEASE DO NOT REPLY TO THIS EMAIL. For KCCA related questions, please contact:
                                    <ul>
                                        <li>Sadam Yiga: <span
                                                style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">syiga@kcca.go.ug</span>
                                        </li>
                                        <li>Eleth Nakazzi: <span
                                                style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">enakazzi@kcca.go.ug</span>
                                        </li>
                                    </ul>
                                    <br />
                                    If you experience any technical challenges or wish to offer suggestions, please contact us at
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">support@airqo.net</span>
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content, name });
      const result = msgs.welcome_kcca(firstName, lastName, password, email);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("welcome_general", () => {
    it("should return the correct welcome message with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const password = "password123";
      const email = "johndoe@test.com";
      const name = firstName + " " + lastName;
      const content = `<tr>
                         <td
                             style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                             <p>Welcome to AirQo Nexus!! 🎉🎉</p>
                             <p>Your login details are:</p>
                             <ul>
                                 <li>USERNAME: ${email}</li>
                                 <li>PASSWORD: ${password}</li>
                                 <li>Access your dashboard: <a href="${constants.LOGIN_PAGE}">LOGIN</a></li>
                             </ul>
                             <p>Key Documentations:</p>
                             <ul>
                                 <li><a href="https://docs.airqo.net/airqo-rest-api-documentation/">API Documentation</a></li>
                                 <li><a href="https://docs.airqo.net/airqo-terms-and-conditions/HxYx3ysdA6k0ng6YJkU3/">AirQo Terms and Conditions</a></li>
                                 <li><a href="https://docs.airqo.net/airqo-platform/">User Guide</a></li>
                             </ul>
                             <p>For support, contact us at support@airqo.net. This is an automated message. Do not reply</p>
                             <p>Best regards, AirQo Data Team</p>
                         </td>
                    </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content, name });
      const result = msgs.welcome_general(firstName, lastName, password, email);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("user_updated", () => {
    it("should return the correct user_updated message with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const email = "johndoe@test.com";
      const name = firstName + " " + lastName;
      const updatedData = {
        email: "john.doe@example.com",
        jobTitle: "Software Engineer",
      };
      let updatedFields = "<ol>\n";
      Object.keys(updatedData).forEach((field) => {
        updatedFields += ` <li>${field}</li>\n`;
      });
      updatedFields += "</ol>";
      const content = ` <tr>
                            <td
                                style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Your AirQo account details have been updated.
                                <br />
                                The following fields have been updated:
                                
                                ${updatedFields}
                                
                                <br />
                                If this activity sounds suspicious to you, please reach out to your organization's administrator immediately.
                                <br />
                                If you are using the AirQo web platform, follow this link to access AirQo Nexus: ${constants.LOGIN_PAGE}
                                <br />
                                <br />
                                If you are using the AirQo mobile app, you can view your updated details directly within the app.
                                <br />
                                <br />
                            </td>
                        </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content, name });
      const result = msgs.user_updated({
        firstName,
        lastName,
        updatedUserDetails: updatedData,
        email,
      });
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("forgotten_password_updated", () => {
    it("should return the correct forgotten_password_updated message with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const email = "johndoe@test.com";
      const name = firstName + " " + lastName;
      const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Your AirQo account password has been successfully reset.
                                <br />
                                If you did not initiate this password reset, please reach out to your organization's administrator immediately.
                                    <br />
                                    <br />
                                    If you are using the AirQo web platform, follow this link to access <a href="${constants.LOGIN_PAGE}">AirQo Nexus:</a>
                                    <br />
                                    Or Paste this link into your browser: ${constants.LOGIN_PAGE}
                                    <br />
                                    <br />
                                    If you are using the AirQo mobile app, you can log in directly within the app using your new password.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content, name });
      const result = msgs.forgotten_password_updated(
        firstName,
        lastName,
        email
      );
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("known_password_updated", () => {
    it("should return the correct known_password_updated message with valid inputs", () => {
      const firstName = "John";
      const lastName = "Doe";
      const email = "johndoe@test.com";
      const name = firstName + " " + lastName;
      const content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Your AirQo account password has been successfully updated.
                                <br />
                                If you did not initiate this password update, please reach out to your organization's administrator immediately.
                                    <br />
                                    <br />
                                    If you are using the AirQo web platform, follow this link to access <a href="${constants.LOGIN_PAGE}">AirQo Nexus right now:</a>
                                    <br />
                                    Or Paste this link into your browser: ${constants.LOGIN_PAGE}
                                    <br />
                                    <br />
                                    If you are using the AirQo mobile app, you can log in directly within the app using your new password.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content, name });
      const result = msgs.known_password_updated(firstName, lastName, email);
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
                                    Enter this code directly in the AirQo mobile app to verify your email.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content });
      const result = msgs.join_by_email(email, token);
      expect(result).to.equal(expectedMessage);
    });
  });
  describe("authenticate_email", () => {
    it("should return the correct authenticate_email message with valid token", () => {
      const email = "john.doe@example.com";
      const token = "ABC123";
      const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                You are about to make changes to your email address.
                                <br />
                                <br />
                                First, you need you to re-authenticate.
                                    <br />
                                Enter the code below in the app.
                                <br />
                                The code: ${token}
                                    <br />
                                    <br />
                                    Enter this code directly in the AirQo mobile app to re-authenticate.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
      const expectedMessage = constants.EMAIL_BODY({ email, content });
      const result = msgs.authenticate_email(token, email);
      expect(result).to.equal(expectedMessage);
    });
  });

  describe("feedbackConfirmation", () => {
    it("should return a confirmation email body containing the subject", () => {
      const email = "user@example.com";
      const subject = "App feedback";
      const result = msgs.feedbackConfirmation({ email, subject });
      expect(result).to.be.a("string");
      expect(result).to.include("App feedback");
      expect(result).to.include("Thank you");
    });

    it("should fall back to 'your feedback' when subject is omitted", () => {
      const result = msgs.feedbackConfirmation({ email: "user@example.com" });
      expect(result).to.include("your feedback");
    });

    it("should HTML-escape a subject containing special characters", () => {
      const result = msgs.feedbackConfirmation({
        email: "user@example.com",
        subject: "<script>alert(1)</script>",
      });
      expect(result).to.not.include("<script>");
      expect(result).to.include("&lt;script&gt;");
    });
  });

  describe("compromiseSummary", () => {
    const baseArgs = {
      email: "user@example.com",
      count: 2,
      compromiseDetails: [
        { tokenSuffix: "abcd", ip: "1.2.3.4", timestamp: "2024-01-01T00:00:00Z" },
        { tokenSuffix: "efgh", ip: "5.6.7.8", timestamp: "2024-01-01T01:00:00Z" },
      ],
    };

    it("should return a string", () => {
      expect(msgs.compromiseSummary(baseArgs)).to.be.a("string");
    });

    it("should include the event count", () => {
      const result = msgs.compromiseSummary(baseArgs);
      expect(result).to.include("2");
    });

    it("should include token suffix and IP details", () => {
      const result = msgs.compromiseSummary(baseArgs);
      expect(result).to.include("abcd");
      expect(result).to.include("1.2.3.4");
    });

    it("should include the client-facing security guidance section", () => {
      const result = msgs.compromiseSummary(baseArgs);
      expect(result).to.include("Protecting Your Token in Client-Facing Applications");
      expect(result).to.include("backend proxy");
      expect(result).to.include("public repositories");
    });

    it("should HTML-escape token suffix containing special characters", () => {
      const result = msgs.compromiseSummary({
        ...baseArgs,
        compromiseDetails: [
          { tokenSuffix: '<img src=x onerror="alert(1)">', ip: "1.2.3.4", timestamp: "" },
        ],
      });
      // The tag opening must be escaped so the browser never renders it as markup.
      expect(result).to.include("&lt;img src=x");
      expect(result).to.include("&quot;alert(1)&quot;");
    });

    it("should handle empty compromiseDetails without throwing", () => {
      const result = msgs.compromiseSummary({ email: "user@example.com", count: 0, compromiseDetails: [] });
      expect(result).to.be.a("string");
    });
  });

  describe("bypassExpiryReminder", () => {
    const baseArgs = {
      firstName: "Jane",
      lastName: "Doe",
      email: "user@example.com",
      token: "ABCDEFGH12345678WXYZ",
      tokenName: "OpenAQ ingestion",
      bypassLabel: "IP-blacklist request-blocking bypass",
      expiresAt: new Date("2050-01-01T00:00:00Z"),
    };

    it("should return a string", () => {
      expect(msgs.bypassExpiryReminder(baseArgs)).to.be.a("string");
    });

    it("should include the masked token and bypass label", () => {
      const result = msgs.bypassExpiryReminder(baseArgs);
      expect(result).to.include("ABCDEFGH");
      expect(result).to.include("IP-blacklist request-blocking bypass");
    });

    it("should HTML-escape a bypass label containing special characters", () => {
      const result = msgs.bypassExpiryReminder({
        ...baseArgs,
        bypassLabel: '<img src=x onerror="alert(1)">',
      });
      expect(result).to.include("&lt;img src=x");
      expect(result).to.include("&quot;alert(1)&quot;");
    });
  });

  describe("subscriptionPastDueReminder", () => {
    const baseArgs = {
      firstName: "Jane",
      lastName: "Doe",
      email: "user@example.com",
      subscriptionId: "sub_01hzxyz1234567890",
    };

    it("should return a string", () => {
      expect(msgs.subscriptionPastDueReminder(baseArgs)).to.be.a("string");
    });

    it("should include the subscription id", () => {
      const result = msgs.subscriptionPastDueReminder(baseArgs);
      expect(result).to.include("sub_01hzxyz1234567890");
    });

    it("should HTML-escape a subscription id containing special characters", () => {
      const result = msgs.subscriptionPastDueReminder({
        ...baseArgs,
        subscriptionId: '<img src=x onerror="alert(1)">',
      });
      expect(result).to.include("&lt;img src=x");
      expect(result).to.include("&quot;alert(1)&quot;");
    });
  });

  describe("bypassExpired", () => {
    const baseArgs = {
      firstName: "Jane",
      lastName: "Doe",
      email: "user@example.com",
      token: "ABCDEFGH12345678WXYZ",
      tokenName: "OpenAQ ingestion",
      bypassLabel: "High-compromise-activity auto-suspension bypass",
    };

    it("should return a string", () => {
      expect(msgs.bypassExpired(baseArgs)).to.be.a("string");
    });

    it("should include the masked token and bypass label", () => {
      const result = msgs.bypassExpired(baseArgs);
      expect(result).to.include("ABCDEFGH");
      expect(result).to.include("High-compromise-activity auto-suspension bypass");
    });
  });

  describe("bypassReportDigest", () => {
    const baseArgs = {
      recipients: ["admin@airqo.net"],
      bypasses: [
        {
          token_suffix: "6NZN",
          token_name: "OpenAQ ingestion",
          owner_email: "owner@example.com",
          bypasses: [
            { type: "bypass_ip_blacklist", expires_at: "2050-01-01T00:00:00Z" },
          ],
        },
      ],
    };

    it("should return a string", () => {
      expect(msgs.bypassReportDigest(baseArgs)).to.be.a("string");
    });

    it("should include the token suffix and owner email", () => {
      const result = msgs.bypassReportDigest(baseArgs);
      expect(result).to.include("6NZN");
      expect(result).to.include("owner@example.com");
    });

    it("should handle an empty bypasses array without throwing", () => {
      const result = msgs.bypassReportDigest({ recipients: ["admin@airqo.net"], bypasses: [] });
      expect(result).to.be.a("string");
      expect(result).to.include("0");
    });

    it("should HTML-escape an owner email containing special characters", () => {
      const result = msgs.bypassReportDigest({
        recipients: ["admin@airqo.net"],
        bypasses: [
          {
            token_suffix: "abcd",
            token_name: "",
            owner_email: '<script>alert(1)</script>',
            bypasses: [{ type: "bypass_anomaly_detection", expires_at: null }],
          },
        ],
      });
      expect(result).to.include("&lt;script&gt;");
    });
  });

  // ── New feedback workflow templates ──────────────────────────────────────────

  describe("feedbackStatusUpdate", () => {
    it("should return a non-empty HTML string", () => {
      const result = msgs.feedbackStatusUpdate({
        email: "user@example.com",
        subject: "Map not loading",
        oldStatus: "pending",
        newStatus: "resolved",
      });
      expect(result).to.be.a("string").and.not.be.empty;
    });

    it("should HTML-escape the subject", () => {
      const result = msgs.feedbackStatusUpdate({
        email: "user@example.com",
        subject: "<script>alert(1)</script>",
        oldStatus: "pending",
        newStatus: "reviewed",
      });
      expect(result).to.not.include("<script>");
      expect(result).to.include("&lt;script&gt;");
    });

    it("should render correct body copy for reviewed status", () => {
      const result = msgs.feedbackStatusUpdate({
        email: "user@example.com",
        subject: "Test",
        oldStatus: "pending",
        newStatus: "reviewed",
      });
      expect(result).to.include("under review");
    });

    it("should render correct body copy for resolved status", () => {
      const result = msgs.feedbackStatusUpdate({
        email: "user@example.com",
        subject: "Test",
        oldStatus: "pending",
        newStatus: "resolved",
      });
      expect(result).to.include("has been resolved");
    });

    it("should render correct body copy for archived status", () => {
      const result = msgs.feedbackStatusUpdate({
        email: "user@example.com",
        subject: "Test",
        oldStatus: "pending",
        newStatus: "archived",
      });
      expect(result).to.include("been archived");
    });

    it("should fall back gracefully when newStatus is not in the label map", () => {
      const result = msgs.feedbackStatusUpdate({
        email: "user@example.com",
        subject: "Test",
        oldStatus: "pending",
        newStatus: "custom_status",
      });
      expect(result).to.be.a("string").and.not.be.empty;
      expect(result).to.include("custom_status");
    });

    it("should not produce a duplicate greeting line", () => {
      const result = msgs.feedbackStatusUpdate({
        email: "user@example.com",
        subject: "Test",
        oldStatus: "pending",
        newStatus: "resolved",
      });
      // EMAIL_BODY adds "Dear <name>," when name is non-empty, or "Hello!" when
      // name is empty but greetings is non-suppressed. This template passes
      // name:"" so EMAIL_BODY suppresses all wrapper greetings entirely.
      expect(result).to.not.match(/Dear .+,|Hello!/);
    });
  });

  describe("feedbackAdminReply", () => {
    it("should return a non-empty HTML string", () => {
      const result = msgs.feedbackAdminReply({
        email: "user@example.com",
        subject: "Crash on login",
        replyMessage: "We have fixed the issue.",
      });
      expect(result).to.be.a("string").and.not.be.empty;
    });

    it("should strip script tags from replyMessage (sanitize, not escape)", () => {
      const result = msgs.feedbackAdminReply({
        email: "user@example.com",
        subject: "Test",
        replyMessage: "<script>alert(1)</script>",
      });
      expect(result).to.not.include("<script>");
      // sanitizeHtml removes the block entirely — no escaped remnant expected.
      expect(result).to.not.include("alert(1)");
    });

    it("should preserve safe HTML formatting tags in replyMessage", () => {
      const result = msgs.feedbackAdminReply({
        email: "user@example.com",
        subject: "Test",
        replyMessage: "<p>Hello <strong>world</strong></p>",
      });
      expect(result).to.include("<strong>world</strong>");
    });

    it("should not produce a duplicate greeting line", () => {
      const result = msgs.feedbackAdminReply({
        email: "user@example.com",
        subject: "Test",
        replyMessage: "Hello from admin",
      });
      // Same as feedbackStatusUpdate: name:"" suppresses EMAIL_BODY's wrapper
      // greeting entirely. If this regresses, "Dear <name>," would appear.
      expect(result).to.not.match(/Dear .+,|Hello!/);
    });

    it("should include the subject in the output", () => {
      const result = msgs.feedbackAdminReply({
        email: "user@example.com",
        subject: "Unique subject text",
        replyMessage: "Reply body",
      });
      expect(result).to.include("Unique subject text");
    });
  });

  describe("feedbackAssigned", () => {
    it("should return a non-empty HTML string", () => {
      const result = msgs.feedbackAssigned({
        email: "admin@example.com",
        name: "Jane",
        subject: "Bug report",
        feedbackId: "abc123",
      });
      expect(result).to.be.a("string").and.not.be.empty;
    });

    it("should HTML-escape subject and name", () => {
      const result = msgs.feedbackAssigned({
        email: "admin@example.com",
        name: "<b>Jane</b>",
        subject: "<script>alert(1)</script>",
        feedbackId: "abc",
      });
      expect(result).to.not.include("<script>");
      expect(result).to.include("&lt;script&gt;");
      expect(result).to.not.include("<b>Jane</b>");
    });

    it("should not produce a duplicate greeting — regression guard", () => {
      const result = msgs.feedbackAssigned({
        email: "admin@example.com",
        name: "Jane",
        subject: "Bug",
        feedbackId: "abc",
      });
      // Content includes "Hi Jane,"; EMAIL_BODY gets name:"" so must NOT add
      // its own "Dear Jane," wrapper. Both assertions are needed: the first
      // confirms the inline greeting is present, the second guards against the
      // duplicate-greeting regression where EMAIL_BODY also adds one.
      const greetingCount = (result.match(/Hi Jane/g) || []).length;
      expect(greetingCount).to.equal(1);
      expect(result).to.not.include("Dear Jane,");
    });

    it("should fall back to 'Team member' when name is omitted", () => {
      const result = msgs.feedbackAssigned({
        email: "admin@example.com",
        subject: "Bug",
        feedbackId: "abc",
      });
      expect(result).to.include("Team member");
    });
  });

  describe("feedbackWatcherNotification", () => {
    it("should return a non-empty HTML string for status_changed event", () => {
      const result = msgs.feedbackWatcherNotification({
        email: "watcher@example.com",
        name: "Alex",
        subject: "Map issue",
        event: "status_changed",
        detail: "Status changed to resolved",
      });
      expect(result).to.be.a("string").and.not.be.empty;
    });

    it("should return a non-empty HTML string for reply_added event", () => {
      const result = msgs.feedbackWatcherNotification({
        email: "watcher@example.com",
        name: "Alex",
        subject: "Map issue",
        event: "reply_added",
        detail: "Admin has replied",
      });
      expect(result).to.be.a("string").and.not.be.empty;
    });

    it("reply_added output should not contain <p><div> — regression guard for invalid HTML nesting", () => {
      const result = msgs.feedbackWatcherNotification({
        email: "watcher@example.com",
        name: "Alex",
        subject: "Map issue",
        event: "reply_added",
        detail: "Some reply text",
      });
      expect(result).to.not.include("<p><div");
    });

    it("should HTML-escape the detail field", () => {
      const result = msgs.feedbackWatcherNotification({
        email: "watcher@example.com",
        name: "Alex",
        subject: "Map issue",
        event: "status_changed",
        detail: "<script>alert(1)</script>",
      });
      expect(result).to.not.include("<script>");
      expect(result).to.include("&lt;script&gt;");
    });

    it("should render fallback copy when event is unknown", () => {
      const result = msgs.feedbackWatcherNotification({
        email: "watcher@example.com",
        name: "Alex",
        subject: "Map issue",
        event: "unknown_event",
        detail: "Some update",
      });
      expect(result).to.be.a("string").and.not.be.empty;
      expect(result).to.include("Some update");
    });

    it("should not produce a duplicate greeting when name is provided — regression guard", () => {
      const result = msgs.feedbackWatcherNotification({
        email: "watcher@example.com",
        name: "Alex",
        subject: "Map issue",
        event: "status_changed",
        detail: "Status updated",
      });
      // Content includes "Hi Alex,"; EMAIL_BODY gets name:"" so must NOT add
      // its own "Dear Alex," wrapper — same dual-assertion pattern as feedbackAssigned.
      const greetingCount = (result.match(/Hi Alex/g) || []).length;
      expect(greetingCount).to.equal(1);
      expect(result).to.not.include("Dear Alex,");
    });
  });

  describe("feedbackWeeklyDigest", () => {
    const sampleItems = [
      {
        subject: "Map tiles broken",
        email: "user1@example.com",
        category: "bug",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        reminderCount: 1,
      },
      {
        subject: "Add dark mode",
        email: "user2@example.com",
        category: "feature_request",
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        reminderCount: 0,
      },
    ];

    it("should return a non-empty HTML string", () => {
      const result = msgs.feedbackWeeklyDigest({ count: 2, items: sampleItems });
      expect(result).to.be.a("string").and.not.be.empty;
    });

    it("should render one table row per item", () => {
      const result = msgs.feedbackWeeklyDigest({ count: 2, items: sampleItems });
      expect(result).to.include("Map tiles broken");
      expect(result).to.include("Add dark mode");
    });

    it("should HTML-escape subject and email values in each row", () => {
      const maliciousItems = [
        {
          subject: "<script>alert(1)</script>",
          email: "<img src=x>@example.com",
          category: "bug",
          createdAt: new Date().toISOString(),
          reminderCount: 0,
        },
      ];
      const result = msgs.feedbackWeeklyDigest({ count: 1, items: maliciousItems });
      expect(result).to.not.include("<script>");
      expect(result).to.not.include("<img src=x>");
      expect(result).to.include("&lt;script&gt;");
    });

    it("should use singular copy for count of 1", () => {
      const result = msgs.feedbackWeeklyDigest({ count: 1, items: [sampleItems[0]] });
      // "1 actionable feedback item" — no trailing 's'
      expect(result).to.match(/\b1\b.*actionable feedback item[^s]/);
    });

    it("should use plural copy for count greater than 1", () => {
      const result = msgs.feedbackWeeklyDigest({ count: 3, items: sampleItems });
      expect(result).to.include("actionable feedback items");
    });

    it("footer email should be populated — regression guard for blank email bug", () => {
      // Stub SUPPORT_EMAIL to a known value so the assertion always runs
      // regardless of environment configuration. The test module and the util
      // share the same cached constants object, so direct assignment propagates.
      const saved = constants.SUPPORT_EMAIL;
      constants.SUPPORT_EMAIL = "support@example.com";
      try {
        const result = msgs.feedbackWeeklyDigest({ count: 1, items: [sampleItems[0]] });
        expect(result).to.include("support@example.com");
      } finally {
        constants.SUPPORT_EMAIL = saved;
      }
    });

    it("should handle an empty items array without throwing", () => {
      expect(() =>
        msgs.feedbackWeeklyDigest({ count: 0, items: [] })
      ).to.not.throw();
      const result = msgs.feedbackWeeklyDigest({ count: 0, items: [] });
      expect(result).to.be.a("string");
    });
  });

  describe("newDeviceLogin", () => {
    const baseArgs = {
      firstName: "John",
      lastName: "Doe",
      email: "user@example.com",
      os: "macOS",
      browser: "Chrome",
      deviceType: "desktop",
      loginTime: new Date("2026-01-01T00:00:00Z"),
    };

    it("should include the login-page line when LOGIN_PAGE is configured", () => {
      const saved = constants.LOGIN_PAGE;
      constants.LOGIN_PAGE = "https://nexus.airqo.net/user/login";
      try {
        const result = msgs.newDeviceLogin(baseArgs);
        expect(result).to.include(
          '<a href="https://nexus.airqo.net/user/login">click here</a>'
        );
      } finally {
        constants.LOGIN_PAGE = saved;
      }
    });

    it("should omit the login-page line when LOGIN_PAGE is not configured", () => {
      const saved = constants.LOGIN_PAGE;
      constants.LOGIN_PAGE = undefined;
      try {
        const result = msgs.newDeviceLogin(baseArgs);
        expect(result).to.not.include("click here");
        expect(result).to.not.include("href=\"undefined\"");
      } finally {
        constants.LOGIN_PAGE = saved;
      }
    });

    it("should HTML-escape a LOGIN_PAGE value containing metacharacters", () => {
      const saved = constants.LOGIN_PAGE;
      constants.LOGIN_PAGE = '"><script>alert(1)</script>';
      try {
        const result = msgs.newDeviceLogin(baseArgs);
        expect(result).to.not.include('href="">');
        expect(result).to.not.include("<script>alert(1)</script>");
        expect(result).to.include("&lt;script&gt;");
      } finally {
        constants.LOGIN_PAGE = saved;
      }
    });
  });
});
