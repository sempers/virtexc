var OrderBook = function () {

};

OrderBook.prototype.length = function () {
    return Object.keys(this).length;
};

OrderBook.prototype.addOrder = function (order) {
    this[order.price] = this[order.price] || [];
    this[order.price].push(order);
};

OrderBook.prototype.noNPCOrders = function () {
    for (var _price in this) {
        if (!this.hasOwnProperty(_price))
            continue;
        for (var i = 0; i < this[_price].length; i++)
            if (this[_price][i].maker.type === CONST.NPC)
                return false;
    }
    return true;
};

OrderBook.prototype.totalVolume = function (price, func) {
    if (typeof price === "undefined" || price === null) {
        var s = 0;
        for (var _price in this) {
            if (!this.hasOwnProperty(_price))
                continue;
            s += this.totalVolume(_price, func);
        }
        return s;
    }

    var arr = this[price];
    if (typeof func !== "undefined")
        arr = arr.filter(func);

    return arr.map(function (a) {
        return a.volume;
    }).reduce(function (a, b) {
        return a + b;
    }, 0);
};

OrderBook.prototype.maxPrice = function () {
    var prices = Object.keys(this);

    if (prices.length === 0)
        throw "maxPrice error: empty prices";

    return Math.max.apply(Math, prices);
};

OrderBook.prototype.minPrice = function () {
    var prices = Object.keys(this);

    if (prices.length === 0)
        throw "minPrice error: empty prices";

    return Math.min.apply(Math, prices);
};

OrderBook.prototype.shiftOrder = function (price, canRemoveIssuer) {
    if (!this[price] || this[price].length === 0)
        throw "OrderBook.shiftOrder error";

    if (this[price][0].issuer && !canRemoveIssuer)
        return null;

    var order = this[price].shift();
    if (this[price].length === 0)
        delete this[price];
    return order;
};

OrderBook.prototype.spliceOrder = function (price, i) {
    if (!this[price] || this[price].length <= i)
        throw "OrderBook.spliceOrder error";

    var order = this[price].splice(i, 1)[0];
    if (this[price].length === 0)
        delete this[price];
    return order;
};

OrderBook.prototype.toString = function () {
    var a = [];
    for (var p in this) {
        var b = [];
        for (var i = 0; i < this[p].length; i++)
            b.push(util.inspect(this[p][i]));
        a.push("[ " + b.join(", ") + " ]");
    }
    return "{ " + a.join(", ") + " }";
};

module.exports = OrderBook;