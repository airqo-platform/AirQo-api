const transporter = require("../services/mailer");

function register(mailOptions, body, entity) {
  try {
    entity
      .findOne({ email: body.email, userName: body.userName })
      .then((user) => {
        if (user) {
          return {
            success: false,
            message:
              "this is a duplicate request, please crosscheck documentation",
          };
        } else {
          const user = new entity(body);
          user.save((error, createdUser) => {
            if (error) {
              return {
                success: false,
                message: "unable to create the user",
                error,
              };
            } else {
              transporter.sendMail(mailOptions, (error, response) => {
                if (error) {
                  return {
                    success: false,
                    message: "unable to create the user",
                    error,
                  };
                } else {
                  return {
                    createdUser,
                    success: true,
                    message: "user added successfully",
                  };
                }
              });
            }
          });
        }
      });
  } catch (e) {
    return {
      success: false,
      message: e.message,
      error: e.message,
    };
  }
}

module.exports = register;
