const User = require("../models/User");

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

    isNetworkAdmin: (req, res, next) => {
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
    },

    isPrivate: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "private") {
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

    isUniversity: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "university") {
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

    isAirQoHost: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "host") {
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

    isMedia: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "media") {
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

    isInstitution: (req, res, next) => {
        let user_id = req.params.id;
        User.findById(user_id, (error, userDetails) => {
            if (error) {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            } else {
                if (userDetails.privilege === "institution") {
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

    isCollaborator: (req, res, next) => {},

    isUser: (req, res, next) => {
        User.findOne({ userName: req.body.userName })
            .then((userInfo) => {
                if (userInfo != null) {
                    next();
                } else {
                    let response = {};
                    response.success = false;
                    response.message = "bad request?";
                    res.status(401).send(response);
                }
            })
            .catch((error) => {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            });
    },

    isCollab: (req, res, next) => {
        Colaborator.findOne({ userName: req.body.userName })
            .then((userInfo) => {
                if (userInfo != null) {
                    next();
                } else {
                    let response = {};
                    response.success = false;
                    response.message = "bad request?";
                    res.status(401).send(response);
                }
            })
            .catch((error) => {
                let response = {};
                response.success = false;
                response.message = "internal server error";
                res.status(500).send(response);
            });
    },
};

module.exports = privileges;