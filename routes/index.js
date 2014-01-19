var db = require('../lib/db');
var virtexclib = require('../lib/virtexclib');

module.exports = {
	addStock: function(req, res) {
		if (req.xhr) {
			virtexclib.addStock(req.session._id, req.body.stock, function(err, price) {
				res.send(price);
			});
		}
	},

	getIndex: function(req, res) {
		res.render('index');
	},

	signup: function(req, res, next) {
		virtexclib.createUser(req.body.username, req.body.email, req.body.password, function(err, user) {
			if (err)
				next(err);
			else {
				req.session._id = user._id;
				res.redirect('/portfolio');
			}
		});
	},

	getTrades: function(req, res) {
		db.db.collection('transactions').find({stock: req.params.stock}).sort({_id: 1}).toArray(function(err, trades) {
		    if (err) {
		        res.json([]);
		        return;
		    }
		    var json = [];
		    trades.forEach(function(t){
		        json.push([t._id.getTimestamp().valueOf(), t.price]);
		    });
			res.json(json);
		});
	},

	getTrades1: function(req, res, callback) {
	    var json = { points: []};
	    var options = {stock: req.params.stock};

        if (req.query.last_id) {
            var oid = new db.ObjectId.createFromHexString(req.query.last_id);
            options._id = {$gt: oid};
            json.last_id = req.query.last_id;
        }

        if (req.query.openPrice) {
            json.openPrice = req.query.openPrice;
        }

		db.db.collection('transactions').find(options).sort({_id: 1}).toArray(function(err, trades) {
			if (err || trades === null) {
				res.json(json);
			}

			var candle = { prices: [], volume: 0};
			//перенесена с прошлых запросов цена открытия
			if (req.query.openPrice)
			    candle.prices.push(parseInt(req.query.openPrice, 10));

			trades.forEach(function(trade, i) {
			    var ts = trade._id.getTimestamp();
			    var sec = ts.getSeconds();
			    candle.sec = candle.sec || sec;

			    //Если в той же свече
                if (Math.floor(sec/10) === Math.floor(candle.sec/10)) {
			        candle.prices.push(trade.price);
			        candle.volume += trade.volume;
			    //свеча закрыта, формируем
			    } else {
			        var closedate = ts.setSeconds(sec - sec%10);
			        var closeprice = candle.prices[candle.prices.length - 1];
					var dataPoint = [
							closedate, //дата закрытия свечи (предыдущая свеча)
							candle.prices[0],                      //open
							Math.max.apply(Math, candle.prices),   //high
							Math.min.apply(Math, candle.prices),   //low
							closeprice,      //close
							candle.volume                          //суммарный объем торгов
						];
					json.points.push(dataPoint);
					json.last_id = trades[i-1]._id; //сделка из пред. итерации
					json.openPrice = closeprice;
					//переносим на след. итерацию
					candle = { prices: [closeprice, trade.price], volume: trade.volume, sec: sec};
				}
			});

			if (!res)
			    callback(json);
			else
			    res.json(json);
		});
	},


	getChart1: function(req, res){
		res.render('chart1', {stock: req.params.stock});
	},

	getChart: function(req, res){
		res.render('chart', {stock: req.params.stock});
	},

	market: function(req, res) {
        res.render('market', {});
	},

	portfolio: function(req, res){
		if (!req.session._id)
			res.render('market', {portfolio: [], prices: {}});

		virtexclib.getUserById(req.session._id, function(err, user) {
			var portfolio = [];
			if (user)
				if (user.portfolio) {
					portfolio = user.portfolio;
					virtexclib.getStockPrices(portfolio, function(err, prices) {
						if (req.xhr) {
							var data = [];
							for (var i = 0; i < portfolio.length; i++) {
							data.push({stock: portfolio[i], price: prices[i]});
							}
							res.json(data);
						} else
							res.render('portfolio', {portfolio: portfolio, prices: prices});
					});
				}
				else
					res.render('portfolio', {portfolio: [], prices: {}});
		});
	},

	existsUser: function(req, res) {
		virtexclib.getUser(req.params.username, function(err, user) {
		if (user)
			res.send('1');
		else
			res.send('0');
		});
	},

	login:  function(req, res) {
		virtexclib.authenticate(req.body.username, req.body.password, function(err, id) {
			if (id) {
				req.session._id = id;
				res.redirect('/portfolio');
			}
			else
				res.redirect('/');
		});
	},
};

