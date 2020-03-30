const constants = require("../config/constants");

module.exports = {
  confirm: id => ({
    subject: "Confirm Email",
    html: `
      <a href='${constants.CLIENT_ORIGIN}/confirm/${id}'>
        click to confirm email
      </a>
    `,
    text: `Copy and paste this link: ${constants.CLIENT_ORIGIN}/confirm/${id}`
  })
};
