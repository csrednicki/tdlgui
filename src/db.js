var config = require('../config');
var MongoClient = require('mongodb').MongoClient;

var connectionPromise = MongoClient.connect(config.mongoDbUrl, {bufferMaxEntries: 0});
var collectionPromise = connectionPromise.then(function (db) {
    return db.collection('tidalgui');
});

module.exports = {
    addAlbum(album) {
        return collectionPromise.then(function (collection) {
            return collection.insertOne(album);
        });
    },
    // findAll: function () {
    //     return collectionPromise.then(function (collection) {
    //         return collection.find({}).toArray();
    //     });
    // },
    find: function (albumId) {
        return collectionPromise.then(function (collection) {
            return collection.find({albumId: albumId}).limit(1).toArray();
        });
    }
};