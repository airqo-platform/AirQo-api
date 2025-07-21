const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${(
    process.env.NODE_ENV || "production"
  ).toUpperCase()} ENVIRONMENT -- config/global/email-template`
);

const emailTemplates = {
  EMAIL_GREETINGS: function ({ name } = {}) {
    try {
      let greetingText;
      if (isEmpty(name) || typeof name !== "string") {
        greetingText = "Hello!";
      } else {
        const nameWords = name.split(" ");
        if (
          nameWords.some(
            (word) => word.toLowerCase() === "unknown".toLowerCase()
          )
        ) {
          greetingText = "Hello!";
        } else {
          greetingText = `Dear ${name},`;
        }
      }

      return `<tr>
                <td
                    style="padding-bottom: 24px; color: #344054; font-size: 16px; font-family: Inter; font-weight: 600; line-height: 24px; word-wrap: break-word;">
                    ${greetingText}
                </td>
            </tr>`;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    }
  },

  EMAIL_HEADER_TEMPLATE: function () {
    return `
    <table style="width: 100%; padding-bottom: 24px;">
                                <tr>
                                    <td style="display: flex; align-items: center;">
                                        <img src="cid:AirQoEmailLogo" alt="logo" style="height: 48px; width: 71px; margin-right: 10px;">
                                       
                                    </td>
                                </tr>
    
                            </table>
                            `;
  },

  EMAIL_FOOTER_TEMPLATE: function ({ email, optional } = {}) {
    const currentYear = new Date().getFullYear();
    return `
    <table style="width: 100%; text-align: center; padding-top: 32px; padding-bottom: 32px;">
                                <tr>
                                    <td>
                                        <a href="https://www.facebook.com/AirQo/" target="_blank"><img
                                                src="cid:FacebookLogo" alt="FacebookLogo"
                                                style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                        <a href="https://www.youtube.com/@airqo7875" target="_blank"><img
                                                src="cid:YoutubeLogo" alt="YoutubeLogo"
                                                style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                        <a href="https://www.linkedin.com/company/airqo/" target="_blank"><img
                                                src="cid:LinkedInLogo" alt="LinkedInLogo"
                                                style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                        <a href="https://twitter.com/AirQoProject" target="_blank"><img src="cid:Twitter"
                                                alt="Twitter"
                                                style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                    </td>
                                </tr>
                            </table>
    
                            <!-- Footer section -->
                            <table style="width: 100%; text-align: center;">
                                <tr>
                                    <td>
                                        <span
                                            style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">This
                                            email was sent to</span>
                                        <span
                                            style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">${email}<br/></span>
                                            
                                        ${this.EMAIL_UNSUBSCRIBE_CLAUSE({ optional })}
                                        <span
                                            style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
                                            <br/>
                                            ©${currentYear} AirQo<br /><br />
                                            Makerere University, Software Systems Centre, Block B, Level 3, College of
                                            Computing and
                                            Information Sciences, Plot 56 University Pool Road</span>
                                    </td>
                                </tr>
                            </table>
    `;
  },

  EMAIL_UNSUBSCRIBE_CLAUSE: function ({ optional = false } = {}) {
    if (optional) {
      return `<span
                                            style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">.
                                            If you'd rather not receive this kind of email, you can </span>
                                        <span
                                            style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">unsubscribe</span>
                                        <span
                                            style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
                                            or </span>
                                        <span
                                            style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">manage
                                            your email preferences.</span><br /><br />`;
    } else {
      return `<span
                                            style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">.
                                            You're receiving this email because you have an AirQo account. This email is not a marketing or promotional email. This is why
                                            this email does not contain an unsubscribe link. You will receive this email even if you have unsubscribed from AirQo's marketing emails.
                                             </span>`;
    }
  },

  EMAIL_BODY: function ({ email, content, name, optional } = {}) {
    const footerTemplate = this.EMAIL_FOOTER_TEMPLATE({ email, optional });
    const headerTemplate = this.EMAIL_HEADER_TEMPLATE();
    let greetings = this.EMAIL_GREETINGS({ name });
    if (!name) {
      greetings = ``;
    }
    return `<!DOCTYPE html>
    <html>
    
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
    
        <body style="margin: 0; padding: 0;font-family:Arial, sans-serif;">
    
            <div style="width: 90%; height: 100%; padding: 32px; background: #F3F6F8;">
                <!-- Email content container with white background -->
                <table style="width: 100%; max-width: 1024px; margin: 0 auto; background: white;">
                    <tr>
                        <td style="padding: 24px;">
                            <!-- Logo and title section -->
                             ${headerTemplate}
    
                            <!-- Email content section -->
                            <table style="width: 100%;">
                               ${greetings}
                                ${content}
                                <tr>
                                    <td style=" height: 8px; background: #EBF1FF;"></td>
                                </tr>
                            </table>
    
                            <!-- Social media section -->
                            ${footerTemplate}
                        </td>
                    </tr>
                </table>
            </div>
    
        </body>
    
    </html>`;
  },
};

module.exports = emailTemplates;
