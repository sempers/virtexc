var CONST = require('./consts');
var Exchange = require('./Exchange');


function VirtExcApp() {
    this.allData = {};
    this.exchangeReady = false;
    this.dbOnline = false;
    this.timeOutIds = {};
    this.currentTimeFactor = 1.0;
    this.sockets = null;
}

VirtExcApp.prototype.submitRandomOrder = function (timeFactor, stock) {
    if (!this.exchangeReady)
        return;
    var self = this;

    var exchangeData = this.allData[stock];

    var order = exchangeData.genOrder();
    exchangeData.putOrder(order);
    exchangeData.clear();

    if (exchangeData.trades && exchangeData.trades.length > 0) {
        var trades = exchangeData.trades.map(
            function (trade) {
                trade.stock = stock;
                return trade;
            });

        db.db
            .collection('transactions')
            .insert(
                trades,
                function (err, trades) {
                    if (err) {
                        self.sockets.emit('db_error', "Database is probably full. You need to restart the exchange.");
                        self.exchangeReady = false;
                    } else {
                        var data = exchangeData.stockData();
                        data.timestamp = trades[0]._id.getTimestamp().valueOf();
                        self.sockets.emit('exchangeData', data);
                        pauseThenTrade();
                    }
                });
    } else
        pauseThenTrade();

    function pauseThenTrade() {
        var pause = Math.floor(Math.random() * CONST.TIME_RANGE * timeFactor)
            + CONST.TIME_FLOOR * timeFactor;
        self.timeOutIds[stock] = setTimeout(self.submitRandomOrder.bind(this, timeFactor,
            stock), pause);
    }
};

VirtExcApp.prototype.initAll = function (timeFactor, callback, restart) {
    var self = this;

    this.exchangeReady = false;
    // проверяем таймфактор
    timeFactor = parseFloat(timeFactor);
    if (!timeFactor || isNaN(timeFactor) || timeFactor < 0)
        timeFactor = 1.0;
    this.currentTimeFactor = timeFactor;

    // уничтожаем старые таймауты
    for (var stock in this.timeOutIds) {
        clearTimeout(this.timeOutIds[stock]);
        delete this.timeOutIds[stock];
    }

    var newData = {};
    for (stock in CONST.INITIAL) {
        newData[stock] = new Exchange(CONST.INITIAL[stock]);
        if (allData[stock] && allData[stock].logCallback)
            newData[stock].logCallback = allData[stock].logCallback;
    }

    this.allData = newData;

    function endInit() {
        self.exchangeReady = true;
        for (var stock in self.allData) {
            self.submitRandomOrder(timeFactor, stock);
        }
        if (callback)
            callback();
    }

    if (restart)
        db.db.collection('transactions').remove({}, function () {
            endInit();
        });
    else
        endInit();
};

VirtExcApp.transformExchangeData = function () {
    var transformed = {};
    for (var stock in this.allData) {
        transformed[stock] = this.allData[stock].stockData();
    }
    return transformed;
};


module.exports = VirtExcApp;