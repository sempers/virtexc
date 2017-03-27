var mgdrv = require('mongodb');

var db = new mgdrv.Db('virtexc', new mgdrv.Server(process.env.IP || 'localhost', 27017), {safe: true});
//var db = new mgdrv.Db('virtexc', new mgdrv.Server("ds053778.mongolab.com", 53778), {safe: true});

module.exports = {
    find: function (name, query, limit, callback) {
        db.collection(name).find(query)
            .sort({_id: -1})
            .limit(limit)
            .toArray(callback);
    },

    findOne: function (name, query, callback) {
        db.collection(name).findOne(query, callback);
    },

    insert: function (name, items, callback) {
        db.collection(name).insert(items, callback);
    },

    ObjectId: mgdrv.ObjectID,

    db: db,

    open: function (callback) {
        db.open(function (err) {
            if (err) {
                callback(false, "Db failed to open");
                return;
            }
            db.authenticate('semp-virtexc', 'c9user', function (err, result) {
                if (err || !result) {
                    callback(false, "Db authentication failed. Check connection settings.");
                }
                else
                    callback(true, "Authentication passed");
            });
        });
    },

    push: function (name, id, updateQuery, callback) {
        db.collection(name).update({_id: id}, {$push: updateQuery}, {safe: true}, callback);
    }
};