const transporter = require("../services/mailer");

function register(req, res, mailOptions, body, entity) {
    console.log(process.env.ATLAS_URI);
    console.log("the values coming in: ")
    console.dir(body)
    entity.findOne({ email: body.email }).then((user) => {
        if (user) {
            return res
                .status(400)
                .json({ success: false, email: "Email already exists" });
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
                            console.log("here is the res: ", response);
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
}

module.exports = register;