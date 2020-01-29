const User = require('../model/User');

const privileges = {
    //checking to see if the user is normal....ideally an admin should be able to do all that normal user can also do hence...
    isSchool: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "school") {
                    next();
                } else {
                    let response = {};
                    response.success = false;
                    response.message = "unauthorized operation";
                    res.status(401).send(response);
                }
            }
        });
    },
    //checking if the user is an administrator
    isPolicyMaker: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "policy") {
                    next();
                } else {
                    let response = {};
                    response.success = false;
                    response.message = "unauthorized operation";
                    res.status(401).send(response);
                }
            }
        });
    },

    isResearcher: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "research") {
                    next();
                } else {
                    let response = {};
                    response.success = false;
                    response.message = "unauthorized operation";
                    res.status(401).send(response);
                }
            }
        });
    },

    isGeneralPublic: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "public") {
                    next();
                } else {
                    let response = {};
                    response.success = false;
                    response.message = "unauthorized operation";
                    res.status(401).send(response);
                }

            }
        });
    },

    IsNetworkAdmin: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "admin") {
                    next();
                } else {
                    let response = {};
                    response.success = false;
                    response.message = "unauthorized operation";
                    res.status(401).send(response);
                }
            }
        });
    }

}

module.exports = privileges;