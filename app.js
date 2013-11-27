/* Based on Nockmarket by nodeninja */
var express = require('express');
var engine = require('ejs-locals');
var path = require('path');
var routes = require('./routes');

var exchange = require('./lib/exchange');
var CONST = require('./lib/consts');
var db = require('./lib/db');
var http = require('http');

var MAX_COUNTER = 10000;

var app = express();

var io;

app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.cookieParser());
app.use(express.session({secret: 'secretpasswordforsessions'}));
app.use(app.router);

var allData = {};
var exchangeReady = false;
var dbOnline = false;
var timeOutIds = {};
var currentTimeFactor = 1.0;

function submitRandomOrder(timeFactor, stock) {
        if (!exchangeReady)
            return;

		var exchangeData = allData[stock];

		exchangeData.order();
		exchangeData.clear();

		if (exchangeData.trades && exchangeData.trades.length > 0) {
			io.sockets.emit('exchangeData', exchangeData.stockData());

			var trades = exchangeData.trades.map(function(trade) {
				trade.stock = stock;
				return trade;
			});

			db.db.collection('transactions').insert(trades, function(err, trades) {
				if (err) {
			        io.sockets.emit('db_error', "Database is probably full. You need to restart the exchange.");
			        exchangeReady = false;
				}
				else
				    pauseThenTrade();
			});
		}
		else pauseThenTrade();

		function pauseThenTrade() {
			var pause = Math.floor(Math.random() * CONST.TIME_RANGE*timeFactor) + CONST.TIME_FLOOR*timeFactor;
			timeOutIds[stock] = setTimeout(submitRandomOrder.bind(this, timeFactor, stock), pause);
		}
}

function initAll(timeFactor, callback, restart) {
    exchangeReady = false;
    //проверяем таймфактор
    timeFactor = parseFloat(timeFactor);
    if (!timeFactor || isNaN(timeFactor) || timeFactor<0)
        timeFactor = 1.0;
    currentTimeFactor = timeFactor;
    //уничтожаем старые таймауты
    for (var stock in timeOutIds) {
        clearTimeout(timeOutIds[stock]);
        delete timeOutIds[stock];
    }

    var newData = {};
    for (var stock in CONST.INITIAL) {
        newData[stock] = new exchange.Exchange(CONST.INITIAL[stock]);
		if (allData[stock] && allData[stock].logCallback)
		    newData[stock].logCallback = allData[stock].logCallback;
	}

	allData = newData;

	function endInit(){
	    exchangeReady = true;
	    for (var stock in allData)
    	{
    		submitRandomOrder(timeFactor, stock);
    	}
    	if (callback)
    	    callback();
	}

	if (restart)
	    db.db.collection('transactions').remove({}, function(err){ endInit(); });
	else
	    endInit();
}

app.get('/', routes.market);
app.post('/signup', routes.signup);
app.post('/login', routes.login);
app.get('/api/trades/:stock', routes.getTrades);
app.get('/api/trades1/:stock', routes.getTrades1);
app.get('/chart/:stock', routes.getChart);
app.get('/chart1/:stock', routes.getChart1);
app.get('/portfolio', routes.portfolio);
app.get('/api/user/:username', routes.existsUser);
app.post('/api/add-stock', routes.addStock);

app.get('/ping', function (req, res){
    res.send('pong');
});

function transformExchangeData() {
	var transformed = {};
	for (var stock in allData) {
		transformed[stock] = allData[stock].stockData();
	}
	return transformed;
}

var createSocket = function(app) {
	io = require('socket.io').listen(app);
	io.set('log level', 1);
	io.sockets.on('connection', function (socket) {

        function dbLogHandler(msg) {
            socket.emit('dbLog', msg);
            socket.broadcast.emit('dbLog', msg);
        }

	    for (var stock in allData) {
	        if (!allData[stock].logCallback)
	           allData[stock].logCallback = dbLogHandler;
	    }

		socket.on('requestData', function (data) {
		    if (exchangeReady)
			    socket.emit('initExchangeData', transformExchangeData(allData), {timeFactor: currentTimeFactor, dbStatus: dbOnline});
		});

        socket.on('restartExchange', function(timeFactor) {
            if (exchangeReady) {
                initAll(timeFactor, function() {
                    socket.emit('initExchangeData', transformExchangeData(allData), {timeFactor: currentTimeFactor, dbStatus: dbOnline});
                }, true);
            }
	    });
	});
};

var server = http.createServer(app);
server.listen(process.env.PORT || 3000);
console.log("App started at " + process.env.PORT);
createSocket(server);

db.open(function(result, msg) {
    if (!result)
        console.log(msg);
    else {
        console.log("Db at Mongolab opened. "+msg);
        dbOnline = true;
    }
    initAll();
});

