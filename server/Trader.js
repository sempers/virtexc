var CONST = require('./consts');

var Trader = function (type, startMoney) {
    this.type = type;
    this.sid = null;
    if (this.type === CONST.NPC) {
        this.money = startMoney || CONST.MONEY;
        this.shares = 0;
    } else if (this.type === CONST.USER) {
        this.money = startMoney || CONST.USER_MONEY;
        this.portfolio = {};
    } else if (this.type === CONST.ISSUER) {

    }
};

module.exports = Trader;