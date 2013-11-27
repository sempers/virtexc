var db = require('./db');
var CONST = require('./consts');
var ObjectID = require('mongodb').ObjectID;
var crypto = require('crypto');
var http = require('http');
var util = require('util');

module.exports = {
	
	getStockPrices: function(stocks, callback) {
		var stockList = '';
		stocks.forEach(function(stock) {
			stockList += stock + ',';
		});
		var options = { 
			host: 'download.finance.yahoo.com', 
			port: 80,
			path: '/d/quotes.csv?s=' + stockList + '&f=sl1c1d1&e=.csv'
		}; 
		http.get(options, function(res) { 
			var data = '';
			res.on('data', function(chunk) {
				data += chunk.toString();
			}).on('error', function(err) {
				console.err('Error retrieving Yahoo stock prices');
				throw err; 
			}).on('end', function() {
				var tokens = data.split('\r\n');
				var prices = [];
				tokens.forEach(function(line) {
					var price = line.split(",")[1];
					if (price)
						prices.push(price);
					}); 
				callback(null, prices);
			}); 
		}); 
	},
	
	getUserById: function(id, callback) {
		db.db.collection('users').findOne({_id: new ObjectID(id)}, callback);
	},
	
	addStock: function(uid, stock, callback) {
		var price;		
		
		function doCallback() {
			counter++;
			if (counter == 2) {
				callback(null, price);
			}
		}
		
		var counter = 0;
		
		module.exports.getStockPrices([stock], function(err, retrieved) { 
			price = retrieved[0];
			doCallback();
		});
		
		db.push('users', new ObjectID(uid), {portfolio: stock}, doCallback);
	},

	encryptPassword: function(p) {
		return crypto.createHash('md5').update(p).digest('hex');
	},
	
	authenticate: function(username, password, callback) {
		db.db.collection('users').findOne({username: username}, {}, function(err, user) {
			if (user && (user.password === module.exports.encryptPassword(password)))
			callback(err, user._id);
			else
			callback(err, null);
		});
	},

	ensureAuthenticated: function (req, res, next) {
		if (req.session._id) {
			return next();
		}
		res.redirect('/');
	},


	createUser: function(username, email, password, callback){
		var user = {username: username, email: email, password: module.exports.encryptPassword(password)};
		db.db.collection('users').insert(user, callback);
	},

	getUser: function(username, callback) {
		db.db.collection('users').findOne({username: username}, {}, callback);
	},
};