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
    <p>Thank you for signing up. If you have any questions, send us a message at info@airqo.net or on <a href=${constants.TWITTER_ACCOUNT}>Twitter</a>. We would love to hear from you.</p>
    <br> 
    <p>--The AirQo team.</p>
    </div>`;
  },

  emailVerification: (firstName, user_id, token) => {
    return `
<h3>Dear ${firstName}</h3>
<p> Thank you for signing up for our platform! We are excited to have you on board.</p>
<p> Before you can fully access all of the features and services offered by our platform, we need to verify your account. </p>
<p> This is a quick and easy process that helps us ensure the security and privacy of our users. </p>
<br>
<p> To verify your account, please click on the following link: <a href=${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}>verification link</a></p>
<p> This verification link will be valid for ${constants.EMAIL_VERIFICATION_HOURS} hours. If you do not verify your email within this time, you will need to request a new verification email.</p>
<br>
<p> If you have any questions or need assistance with the verification process, please don't hesitate to reach out to our support team: support@airqo.net.</p>
<br>
<p> Thank you for choosing our platform, and we look forward to helping you achieve your goals</p>
<br>
<p> Sincerely,</p>
<p> The AirQo Data Team</p>
`;
  },

  v2_emailVerification: (firstName, user_id, token) => {
    return `
<h3>Dear ${firstName}</h3>
<p> Thank you for signing up to join the AirQo data platform! We are excited to have you on board</p>
<p> To complete your account setup, please verify that this is your email address by <a href=${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}>clicking on this verification link</a></p>
<p> This link will be valid for ${constants.EMAIL_VERIFICATION_HOURS} hour(s). If you did not initiate this request, please disregard this email!</p>
<p> For help, please contact our support team: support@airqo.net.</p>
<br>
<p> See you in the platform,</p>
<br>
<p> The AirQo Data Team</p>
`;
  },

  afterEmailVerification: (firstName, username, password) => {
    return `
<h3>Dear ${firstName}</h3>
<p> Congratulations! Your account has been successfully verified.</p>
<p> We are pleased to inform you that you can now fully access all of the features and services offered by our platform.</p>
<br>
<p>YOUR USERAME: ${username} </p>
<p>YOUR PASSWORD: ${password} </p>
<p>ACCESS LINK: ${constants.PLATFORM_BASE_URL}/login </p>
<br>
<p> Thank you for your patience and understanding during the verification process.</p>
<p> We take the security and privacy of our users very seriously, and the verification process is an important part of ensuring that our platform is safe and secure for all.</p>
<br>
<p> If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support team. We are here to help.</p>
<p> Thank you for choosing our platform, and we look forward to helping you achieve your goals </p>
<br>
<p> Sincerely, <p>
<p> The AirQo Data Team </p>
`;
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
    <p> Dear ${fullName} </p>
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
