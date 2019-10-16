const constants = require('./constants');

const DataAccess = function () {
    const mongoose = require('mongoose');
    this.db = mongoose.connection;
    this.dbURI = constants.MONGO_URL;
};

DataAccess.prototype.GetEntities = function (dbName, collectionName, query) {
    var that = this;

    if (!query) {
        query = {};
    }

    return new Promise(function (fulfill, reject) {
        that.mongoose.connect(that.dbURI)
            .then(function (db) {
                let database = db.db(dbName);
                let collection = database.collection(collectionName);
                collection.find(query).toArray(function (err, docs) {
                    db.close();
                    if (err) {
                        reject(err);
                    }
                    else {
                        fulfill(docs);
                    }
                })
            }
            ).catch(function (err) {
                reject(err);
            })

    });
}

module.exports = new DataAccess();