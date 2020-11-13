const transporter = require("../services/mailer");

function register(req, res, mailOptions, body, entity, tenant) {
  try {
    entity
      .findOne({ email: body.email, userName: body.userName })
      .then((user) => {
        if (user) {
          return res.status(400).json({
            success: false,
            email: `email or userName already exist for this orgnanisation (${tenant})`,
          });
        } else {
          //this is where I call the registration function
          const user = new entity(body);
          user.save((error, savedData) => {
            if (error) {
              return console.log(error);
            } else {
              transporter.sendMail(mailOptions, (err, response) => {
                if (err) {
                  console.error("there was an error: ", err);
                } else {
                  res.status(200).json({
                    savedData,
                    success: true,
                    message: "user added successfully",
                  });
                }
              });
            }
          });
        }
      });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e.message,
    });
  }
}

module.exports = register;
