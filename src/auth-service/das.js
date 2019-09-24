
const dataAccess = function () {
    this.MongoClient = require('mongodb').MongoClient, assert = require('assert');
    this.Mongo = require('mongodb');
    this.DBConnectionString = 'mongodb://127.0.0.1:27017/auth';
};


dataAccess.prototype.GetEntities = function (dbName, collectionName, query) {
    var that = this;

    if (!query) {
        query = {};
    }

    return new Promise(function (fulfill, reject) {
        this.MongoClient.connect
    });
}