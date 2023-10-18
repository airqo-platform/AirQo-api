/* eslint-disable object-curly-spacing */
/* eslint-disable require-jsdoc */
/* eslint-disable indent */
/* eslint-disable max-len */

require("dotenv").config();
const baseUrl = process.env.PLATFORM_BASE_URL;

module.exports = {
    email_greetings: (name) => {
        return `<tr>
                                <td
                                    style="padding-bottom: 24px; color: #344054; font-size: 16px; font-family: Inter; font-weight: 600; line-height: 24px; word-wrap: break-word;">
                                    Dear ${name},
                                </td>
                            </tr>`;
    },
    email_header_template: () => {
        return `
<table style="width: 100%; padding-bottom: 24px;">
                            <tr>
                                <td style="display: flex; align-items: center;">
                                    <img src="cid:AirQoEmailLogo" alt="logo" style="height: 100px; margin-right: 10px;">

                                </td>
                            </tr>

                        </table>
                        `;
    },
    email_footer_template: (email) => {
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
    email_body: (email, content, name) => {
        const footerTemplate = module.exports.email_footer_template(email);
        const headerTemplate = module.exports.email_header_template();
        let greetings = module.exports.email_greetings(name);
        if (!name) {
            greetings = "";
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
    mobileAppWelcome: (email, name) => {
        const content = `
<tr>
    <td
        style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        We're thrilled to have you onboard and excited for you to experience all that our
        app has to offer.
        This is the first step to Know Your Air and Breathe Clean.<br /><br /><br />
        With the AirQo app, you'll have access to:<br />
        <ol>
            <li>Air quality analytics - view air quality readings by day/week in different
                locations</li>
            <li>For You - personalized air quality recommendations based on your preferences
                and favorite locations</li>
            <li>Search - find locations by name or navigate the map</li>
            <li>Know your air - a fun way of learning about air quality</li>
        </ol>
        <br />

        We've designed it to be easy to use and navigate, so you can find what you're
        looking for quickly.
        Get air quality information, lessons, and pollution reduction tips that you can
        share with your contacts.<br /><br /><br />
        We're constantly updating and improving our app to ensure the best experience
        possible.
        If you have any questions or feedback, please don't hesitate to reach out to us
        through the app's support feature.<br /><br /><br />
        Thank you for choosing our app, and we can't wait for you to see what it can do for
        you.<br /><br /><br />
    </td>
</tr>`;
        return module.exports.email_body(email, content, name);
    },
    deleteConfirmationEmail: (email, userId, token) => {
        const deletionLink = `${baseUrl}/api/v2/users/deleteMobileUserData/${userId}/${token}`;
        const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Thank you for requesting to delete your account.
                                    <br />
                                    Please note that deleting your account will permanently remove all your
                                    data associated with AirQo. This action cannot be undone.
                                    <br /><br />
                                    To confirm the deletion, please click the button below to delete your account:
                                    <br />
                                    <a href=${deletionLink} target="_blank">
                                        <button
                                            style="background-color: #135DFF; color: white; padding: 10px 20px; border: none; cursor: pointer;">
                                            Delete Account
                                        </button>
                                    </a>
                                    <br /><br />
                                    Trouble logging in? Paste this URL into your browser:
                                    </br>
                                    <a href=${deletionLink} target="_blank">${deletionLink}</a>
                                    <br /><br />
                                    If you did not initiate this request, please contact our support team immediately.
                                    Thank you for using AirQo.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
        return module.exports.email_body(email, content);
    },

    mobileAppGoodbye: (email, name) => {
        const content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    We confirm that your account has been successfully deleted. We appreciate your time
                                    spent with us and respect your
                                    decision.
                                    <br />
                                    <br />
                                    Please note that all your data and personal information associated with the account
                                    have been permanently removed from our systems.
                                    <br />
                                    If you have any questions or require further assistance, please feel free to reach out to our support team.<br />
                                    <br />Thank you for being a part of our community.
                                    <br />
                                </td>
                            </tr>`;
        return module.exports.email_body(email, content, name);
    },

    email_notification: (userFavorites) => {
        const { userEmail } = userFavorites[0];
        const footerTemplate = module.exports.email_footer_template(userEmail);
        function generateFavoriteHTML(name, location) {
            return `
            <tr style="border: 1px #EBF1FF solid;">
                <td style="text-align: center; padding: 10px;">
                    <img src="cid:FavoriteIcon"  style="height: 20px; width: 20px;">
                </td>
                <td style ="padding-right: 60px;">
                    <div style="color: black; font-size: 16px; font-family: Inter; font-weight: 700; line-height: 20px; word-wrap: break-word">
                        ${name}
                    </div>
                    <div style="font-size: 14px; font-family: Inter; font-weight: 500; line-height: 20px; color: #8D8D8D;">
                        ${location}
                    </div>
                </td>
                <td style="text-align: center; padding: 10px; display: grid; place-items: center;">
                    <div style="width: 80px; background: #145DFF; border-radius: 6.09px; display: grid; align-content: center; justify-content: center; color: white; font-size: 14px; padding-left: 18.26px; padding-right: 18.26px; padding-top: 9.13px; padding-bottom: 9.13px;">
                        <a href ="https://airqo.page.link/NOTIF" style="text-decoration: none; color: white;"> View now</a>
                    </div>
                </td>
            </tr>
        `;
        }

        // Generate the HTML for favorites
        let favoritesContent = "<table style=\"width: 539px; border-collapse: collapse; border: 1px #EBF1FF solid; margin: 20px auto;\">";
        userFavorites.forEach((favorite) => {
            const { name, location } = favorite;
            favoritesContent += generateFavoriteHTML(name, location);
        });
        favoritesContent += "</table>";


        return `<!DOCTYPE html>
<html>

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>

    <body style="margin: 0; padding: 0;font-family:Arial, sans-serif;">

        <div style="width: 90%; height: 100%; padding: 32px; background: #F3F6F8;">
            <!-- Email content container with white background -->
            <table
                style="width: 100%; max-width: 1024px; margin: 0 auto; background: white;border-top-left-radius: 30px;border-top-right-radius: 30px;">
                <tr>
                    <td>
                        <table
                            style="width: 100%; background-color: #145DFF; border-top-left-radius: 30.46px;
                                                                                                                                                                                                                                                                                            border-top-right-radius: 30.46px;">
                            <tr>
                                <td
                                    style="text-align: center; border-top-left-radius: 30.46px; border-top-right-radius: 30.46px;">
                                    <!-- Logo goes here -->
                                    <img src="cid:AirQoEmailLogo" alt="logo" style="height: 100px; margin-right: 10px;">
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 24px;">
                        <!-- Email content section -->
                        <table style="width: 100%;">
                            <tr>
                                <td>
                                    <table style="width: 100%; text-align: center; background-color: #fff;">
                                        <tr>
                                            <td>
                                                <br />
                                                <div
                                                    style="text-align: center; color: #121723; font-size: 36.75px; font-family: Inter; font-weight: 500; line-height: 50px; word-wrap: break-word">
                                                    You have some updates <br />from your favorite locations</div>
                                                <br />
                                                <br />
                                            </td>
                                        </tr>
                                         <tr>
                                            <td style="display: grid; padding-left: 190px;">
                                                <div
                                                    style="width: 199px; height: 33px;padding-top: 12px; padding-left: 24px; padding-right: 24px; background: #145DFF; border-radius: 8px; flex-direction: column; justify-content: center; gap: 8px; display: grid;">
                                                    <div
                                                        style="text-align: center; color: white; font-size: 14px; font-family: Inter; font-weight: 500; line-height: 22px; word-wrap: break-word">
                                                        <a href ="https://airqo.page.link/NOTIF" style="text-decoration: none; color: white;"> View now</a>
                                                    </div>
                                                </div>
                                                <br />
                                                <br />
                                                <br />
                                                <br />
                                            </td>
                                        </tr>
                                    </table>

                                    ${favoritesContent}
                            <tr>
                                <td style=" height: 8px; background: #EBF1FF;"></td>
                            </tr>
                    </td>
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
