var db = require('../lib/db');
var index = require('./index');
var util = require('util');


var oid = new db.ObjectId.createFromHexString("529416391da68e0000e6a97a");
console.log(util.inspect(oid), oid === "529416391da68e0000e6a97a");

db.db.open(function(err){
    if (!err) {
        db.db.collection('transactions').find({_id: {$gt: oid}, stock: "MAKL"}).toArray(console.log);
    }
    else
        console.log(err);
});