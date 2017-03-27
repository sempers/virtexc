var http = require('http');
var express = require('express');
var engine = require('ejs-locals');
var path = require('path');
var routes = require('./routes');
var VirtExcApp = require('./server/VirtExcApp');

var exchange = require('./server/exchange');
var CONST = require('./server/consts');
var db = require('./server/db');


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
app.use(express.session({
    secret: 'secretpasswordforsessions'
}));

app.App = new VirtExcApp();

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

app.get('/ping', function (req, res) {
    res.send('pong');
});


var createSocket = function (app) {
    io = require('socket.io').listen(app);
    io.set('log level', 1);

    io.sockets.on('connection', function (socket) {


        var dbLogHandler = function dbLogHandler(msg) {
            socket.emit('dbLog', msg);
            socket.broadcast.emit('dbLog', msg);
        };

        for (var stock in app.App.allData) {
            if (!app.App.allData[stock].logCallback)
                app.App.allData[stock].logCallback = dbLogHandler;
        }

        socket.on('requestData', function (data) {
            if (app.App.exchangeReady)
                socket.emit('initExchangeData', gf.transformExchangeData(allData),
                    {
                        timeFactor: app.globals.currentTimeFactor,
                        dbStatus: dbOnline
                    });
        });

        socket.on('restartExchange', function (timeFactor) {
            if (app.globals.exchangeReady) {
                initAll(timeFactor, function () {
                    socket.emit('initExchangeData',
                        transformExchangeData(allData), {
                            timeFactor: currentTimeFactor,
                            dbStatus: dbOnline
                        });
                }, true);
            }
        });
    });
};

var server = http.createServer(app);
server.listen(process.env.PORT || 3000);
console.log("App started at " + (process.env.PORT || 3000));
createSocket(server);

db.open(function (result, msg) {
    if (!result)
        console.log(msg);
    else {
        console.log("Db at Mongolab opened. " + msg);
        dbOnline = true;
    }
    initAll();
});
