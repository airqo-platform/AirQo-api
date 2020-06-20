const transporter = require("../services/mailer");
const User = require("../models/User");

function addList(req, res, entity, type) {
    let response = {};
    User.find({ _id: req.params.id }, (error, user) => {
        if (error) {
            response.success = false;
            response.message = "Internal Server Error";
            res.status(500).json(response);
        } else if (user.length) {
            let defaults = new entity(req.body);
            defaults.user = user[0]._id;
            defaults.save((error, savedDefault) => {
                if (error) {
                    response.success = false;
                    response.message = "Internal Server Error";
                    res.status(500).json(response);
                } else {
                    User.findByIdAndUpdate(
                        req.params.id, { $push: { graph_defaults: savedDefault._id } }, { new: true },
                        (err, updatedUser) => {
                            if (err) {
                                response.success = false;
                                response.message = "Internal Server Error";
                                res.status(500).json(response);
                            } else {
                                response.success = true;
                                response.message =
                                    "Sucessfully added the default value to the user";
                                res.status(200).json({
                                    message: "Sucessfully added the default value to the user",
                                    success: true,
                                    updatedUser,
                                });
                            }
                        }
                    );
                }
            });
        }
    });
}

module.exports = addList;