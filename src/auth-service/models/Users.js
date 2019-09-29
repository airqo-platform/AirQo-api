const DataAccess = require("../DataAccess");

const Model = function () {

}

Model.prototype.GetUsers = function () {
    return new Promise(function (fulfill, reject) {
        DataAccess.GetEntities("auth_service", "users")
            .then(function (docs) {
                fulfill(docs);
            }).catch(function (err) {
                reject(err);
            });
    });
};

