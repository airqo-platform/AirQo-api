const transporter = require("../services/mailer");
const HTTPStatus = require("http-status");

const sendEmail = (req, res, mailOptions, message) => {
  transporter.sendMail(mailOptions, (err, response) => {
    if (err) {
      console.error("there was an error: ", err);
    } else {
      console.log("here is the res: ", response);
      res.status(HTTPStatus.OK).json({
        success: true,
        message: message,
      });
    }
  });
};

module.exports = sendEmail;
