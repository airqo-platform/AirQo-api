const constants = require("../config/constants");

module.exports = {
  confirm: (id) => ({
    subject: "AirQo Analytics JOIN request",
    html: `
      <a href='${constants.CLIENT_ORIGIN}/confirm/${id}'>
        Click to know more about AirQo
      </a>
    `,
    text: `Copy and paste this link: ${constants.CLIENT_ORIGIN}/confirm/${id}`,
  }),
  inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      "We are excited to welcome you to AirQo and we are even more excited \n" +
      "about what we have got planned. You are already on your way to creating \n" +
      "beautiful visual products. \n\n" +
      "Whether you are here for your brand, for a cause, or just for fun---,welcome! \n" +
      "If there is anything you need, we will be here every step of the way. \n\n" +
      "Thank you for signing up. If you have any questions, send us a message at\n" +
      "info@airqo.net or on Twitter. We would love to hear from you.\n\n" +
      "The AirQo team."
    );
    // return `${message} \n\n` + `https://airqo.net/`;
  },

  sample_html: (fullName) => {
    return `
    <h3>Hi ${fullName}</h3>
    <br> 
    <p>We are excited to welcome you to AirQo and we are even more excited</p>
    <p>about what we have got planned. You are already on your way to creating</p>
    <p>beautiful visual products.</p>
    <br> 
    <p>Whether you are here for your brand, for a cause, or just for fun---,welcome! </p>
    <p>If there is anything you need, we will be here every step of the way.</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Check out our air quality analytics platform</a>
    <p> Weekly new updates and improvements to our products </p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Support our expansion in Africa</a>
    <p> Stay up to date with the latest announcements and jobs </p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Support our ongoing projects</a>
    <p> Fibd out how you can support our ongoing projects </p>
    <br> 
    <p>Thank you for signing up. If you have any questions, send us a message at</p>
    <p>info@airqo.net or on Twitter. We would love to hear from you.</p>
    <br> 
    <p>--The AirQo team.</p>
    </div>`;
  },
};
