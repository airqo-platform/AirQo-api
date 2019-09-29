const DataAccess = function () {
    this.mongoose = require('mongoose');
    this.db = mongoose.connection;
    this.dbURI = 'mongodb://localhost/airqo-auth';
};

DataAccess.prototype.GetEntities = function (dbName, collectionName, query) {
    var that = this;

    if (!query) {
        query = {};
    }

    return new Promise(function (fulfill, reject) {

        //connect to db
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


        //in case there is an error


        //after a disconnection


        // in case nodeJS stops

    });
}

module.exports = new DataAccess();