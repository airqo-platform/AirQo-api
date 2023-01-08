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
      `We are excited to welcome you to AirQo and we are even more excited \n` +
      `about what we have got planned. You are already on your way to creating \n` +
      `beautiful visual products. \n\n` +
      `Whether you are here for your brand, for a cause, or just for fun---,welcome! \n` +
      `If there is anything you need, we will be here every step of the way. \n\n` +
      `Thank you for signing up. If you have any questions, send us a message at\n` +
      `info@airqo.net or on Twitter. We would love to hear from you.\n\n` +
      `The AirQo team.`
    );
  },

  inquiryTemplate: (fullName) => {
    return `
    <h3>Hi ${fullName}</h3>
    <p>We are excited to welcome you to AirQo and we are even more excited about what we have got planned. You are already on your way to creating beautiful visual products.</p>
    <br> 
    <p>Whether you are here for your brand, for a cause, or just for fun, welcome!</p>
    <p>If there is anything you need, we will be here every step of the way.</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Check out our air quality analytics platform</a>
    <p>Weekly new updates and improvements to our products</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Support our expansion in Africa</a>
    <p>Stay up to date with the latest announcements and jobs</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Support our ongoing projects</a>
    <p>Find out how you can support our ongoing projects</p>
    <br> 
    <p>Thank you for signing up. If you have any questions, send us a message at info@airqo.net or on Twitter. We would love to hear from you.</p>
    <br> 
    <p>--The AirQo team.</p>
    </div>`;
  },

  policyInquiry: (fullName) => {
    return `
    <p> Dear ${fullName}<p/>
    <p> Thank you for getting in touch with us and for your interest in our work.</p>  
    <p> Kindly let us know how you would like to partner with us and we will get back to you.<p/>
    <p> Alternatively, you can get in touch with our Policy Engagement Officer Angela Nshimye at angela@airqo.net who will be of further support.</p>`;
  },

  championInquiry: (fullName) => {
    return `
    <p> Dear ${fullName}</p>
    <p>Thank you for getting in touch with us and for your interest in being an air quality champion in your community.</p> 
    <p> As an air quality champion, you are key in advocating for clean air practices in your community and urging community members to take action against air pollution.</p>
    <p> Please get in touch with our Marketing and Communications Lead at maclina@airqo.net for further support.</p>`;
  },

  developerInquiry: (fullName) => {
    return `
    <p> Dear ${fullName}</p>
    <p> Thank you for your interest in our work. Please get in touch with our Software Engineering Lead Martin Bbaale at martin@airqo.net for further support</p>`;
  },

  partnerInquiry: (fullName) => {
    return `
    <p> Dear ${fullName} </p>,
    <p>Thank you for getting in touch with us and for your interest in supporting our work in closing the air quality data gaps in African Cities.</p>
    <p> We are happy to foster partnerships to advance air quality monitoring and management in African Cities.</p>
    <p> Please get in touch with our project lead Professor Engineer at baino@airqo.net or Programme Manager Deo Okure at deo@airqo.net for further support.</p>`;
  },

  researcherInquiry: (fullName) => {
    return `
    <p> Dear ${fullName} </p>
    <p> Thank you for your interest in accessing our air quality data to further research in air quality monitoring and management.</p>
    <p> You can visit our website at airqo.net and navigate to https://airqo.net/explore-data or click here to access data.</p>
    <p> If you still need further support, please contact our Data Scientists Richard Sserujogi at richard.sserunjogi@airqo.net or Wabinyai Fidel Raja at raja@airqo.net for further support.</p>`;
  },
};
