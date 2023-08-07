const emailConstants = {
    greetings: (name) => {
        return `<tr>
                                <td
                                    style="padding-bottom: 24px; color: #344054; font-size: 16px; font-family: Inter; font-weight: 600; line-height: 24px; word-wrap: break-word;">
                                    Dear ${name},
                                </td>
                            </tr>`
    },
    headerTemplate: () => {
        return `
<table style="width: 100%; padding-bottom: 24px;">
                            <tr>
                                <td style="display: flex; align-items: center;">
                                    <img src="cid:AirQoEmailLogo" alt="logo" style="height: 50px; margin-right: 10px;">
                                    <span
                                        style="color: #135DFF; margin-left: auto; font-family: Inter; font-size: 20px; font-weight: 600; line-height: 24px; letter-spacing: 0em; text-align: right;">Breathe
                                        Clean</span>
                                </td>
                            </tr>

                        </table>
                        `;
    },
    footerTemplate: (email) => {
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
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">${email}</span>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">.
                                        If you'd rather not receive this kind of email, you can </span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">unsubscribe</span>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
                                        or </span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">manage
                                        your email preferences.</span><br /><br />
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">©
                                        2023 AirQo<br /><br />
                                        Makerere University, Software Systems Centre, Block B, Level 3, College of
                                        Computing and
                                        Information Sciences, Plot 56 University Pool Road</span>
                                </td>
                            </tr>
                        </table>
`;
    },

    fullBody: (email, content, name) => {
        const footerTemplate = emailConstants.footerTemplate(email);
        const headerTemplate = emailConstants.headerTemplate();
        let greetings = emailConstants.greetings(name);
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

</html>`
    },
}

module.exports = emailConstants;