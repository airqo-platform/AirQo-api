/* eslint-disable max-len */

require("dotenv").config();
const baseUrl = process.env.PLATFORM_BASE_URL;

module.exports = {
  mobileAppWelcome: (email, name) => {
    return `
    <div style="display: flex; align-items: center;">
      <img src="cid:AirQoEmailLogo" alt="logo" style="height: 50px; margin-right: 10px;">
      <span style="color: #135DFF; margin-left: auto; font-family: Inter; font-size: 20px; 
      font-weight: 600; line-height: 24px; letter-spacing: 0em; text-align: right;">Breathe Clean</span>
    </div>
    <img src="cid:AirQoEmailWelcomeImage" alt="Welcome Image" style ="width:529; height:177; margin-bottom: 56px; margin-top:24px">
    <p>Hi ${name},</p>
    <br/>
    <p> We're thrilled to have you onboard and excited for you to experience all that our app has to offer. This is the first step to Know Your Air and Breathe Clean.</p>  
    <br/>
    <p> With the AirQo app, you'll have access to:<p/>
    <ol>
    <li>Air quality analytics - view air quality readings by day/week in different locations</li>
    <li>For You - personalized air quality recommendations based on what you share frequently and your favorite locations</li>
    <li>Search - find locations by location name or by navigating the map</li>
    <li>Know your air - a fun way of learning about air quality</li>
    </ol>

    <br/>
    <p>We've designed it to be easy to use and navigate, so you can find what you're looking for quickly. Get air quality information like air quality lessons and tips on how to reduce air pollution that you can share with your pals through text or visual updates.</p>
     <br/>
    <p>We're constantly updating and improving our app to make sure you have the best experience possible. If you have any questions or feedback, please don't hesitate to reach out to us through the app's support feature</p>
    <br/>
    <p>Thank you for choosing our app, and we can't wait for you to see what it can do for you.</p>
    <hr style="width: 1000px; height: 8px; background-color: #EBF1FF; 
  border: none; margin-top: 48px; margin-bottom: 48px;"></hr>

        <div style="margin-left: 24px;margin-right: 24px;">

            <div
                style="display: flex;flex-wrap: wrap; justify-content: center;  align-items: center; margin-left:380px">

                <a href="https://www.facebook.com/AirQo/" target="_blank"> <img src="cid:FacebookLogo"
                        alt="FacebookLogo" style="width:24px; height: 24px;margin-right: 20px;"></a>

                <a href="https://www.youtube.com/@airqo7875" target="_blank"> <img src="cid:YoutubeLogo"
                        alt="YoutubeLogo" style="width:24px; height: 24px;margin-right: 20px;"></a>

                <a href="https://www.linkedin.com/company/airqo/" target="_blank"> <img src="cid:LinkedInLogo"
                        alt="LinkedInLogo" style="width:24px; height: 24px;margin-right: 20px;"></a>

                <a href="https://twitter.com/AirQoProject" target="_blank"> <img src="cid:Twitter" alt="Twitter"
                        style="width:24px; height: 24px;margin-right: 20px;"></a>


            </div>

            <br />
            <div style="text-align: center;">
                <p >
                This email was sent to ${email}. If you'd rather not receive this kind of email, you can unsubscribe or manage your email preferences.
                </p>
                <p >© 2022 AirQo. </p>

                <p>Makerere University, Software Systems Centre, Block B, Level 3, College of Computing and Information
                    Sciences, Plot 56 University Pool Road</p>
            </div>

        </div>
        `
    ;
  },
  deleteConfirmationEmail: (email, userId, creationTime) => {
    const deletionLink=`${baseUrl}/api/v1/users/deleteMobileUserData?userId=${userId}&creationTime=${creationTime}`;
    return `
      <div style="display: flex; align-items: center;">
    <img src="cid:AirQoEmailLogo" alt="logo" style="height: 50px; margin-right: 10px;">
    <span style="color: #135DFF; margin-left: auto; font-family: Inter; font-size: 20px; 
      font-weight: 600; line-height: 24px; letter-spacing: 0em; text-align: right;">Breathe Clean</span>
</div>
<p>Dear User,</p>
<p>Thank you for requesting to delete your account.</p>
<p>To confirm the deletion, please click the button below to delete your account:</p>
<a href=${deletionLink} target="_blank">
    <button style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; cursor: pointer;">
        Delete Account
    </button>
</a>
<p>Trouble logging in? Paste this URL into your browser:</p>
</br>
<a href=${deletionLink} target="_blank">${deletionLink}</a>
<hr style="width: 1000px; height: 8px; background-color: #EBF1FF; 
  border: none; margin-top: 48px; margin-bottom: 48px;">
</hr>

<div style="margin-left: 24px;margin-right: 24px;">

    <div style="display: flex;flex-wrap: wrap; justify-content: center;  align-items: center; margin-left:380px">

        <a href="https://www.facebook.com/AirQo/" target="_blank"> <img src="cid:FacebookLogo" alt="FacebookLogo"
                style="width:24px; height: 24px;margin-right: 20px;"></a>

        <a href="https://www.youtube.com/@airqo7875" target="_blank"> <img src="cid:YoutubeLogo" alt="YoutubeLogo"
                style="width:24px; height: 24px;margin-right: 20px;"></a>

        <a href="https://www.linkedin.com/company/airqo/" target="_blank"> <img src="cid:LinkedInLogo"
                alt="LinkedInLogo" style="width:24px; height: 24px;margin-right: 20px;"></a>

        <a href="https://twitter.com/AirQoProject" target="_blank"> <img src="cid:Twitter" alt="Twitter"
                style="width:24px; height: 24px;margin-right: 20px;"></a>


    </div>

    <br />
    <div style="text-align: center;">
        <p>
            This email was sent to ${email}. If you'd rather not receive this kind of email, you can unsubscribe or
            manage your email preferences.
        </p>
        <p>© 2022 AirQo. </p>

        <p>Makerere University, Software Systems Centre, Block B, Level 3, College of Computing and Information
            Sciences, Plot 56 University Pool Road</p>
    </div>

</div>
    `
    ;
  },
};
