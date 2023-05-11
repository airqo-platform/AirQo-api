/* eslint-disable max-len */

module.exports = {
  mobileAppWelcome: (name) => {
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
    <p>Thank you for choosing our app, and we can't wait for you to see what it can do for you.</p>`;
  },
};
