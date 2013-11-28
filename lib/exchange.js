var util = require('util'), assert = require('assert'), CONST = require('./consts'), Gaussian = require('./mathutils');

var Trader = function(type, startMoney) {
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
}

// -------------------------------------------------------------
var OrderBook = function() {

};

OrderBook.prototype.length = function() {
	return Object.keys(this).length;
};

OrderBook.prototype.addOrder = function(order) {
	this[order.price] = this[order.price] || [];
	this[order.price].push(order);
};

OrderBook.prototype.noNPCOrders = function() {
	for ( var _price in this) {
		if (!this.hasOwnProperty(_price))
			continue;
		for ( var i = 0; i < this[_price].length; i++)
			if (this[_price][i].maker.type === CONST.NPC)
				return false;
	}
	return true;
};

OrderBook.prototype.totalVolume = function(price) {
	if (typeof price === "undefined") {
		var s = 0;
		for ( var _price in this) {
			if (!this.hasOwnProperty(_price))
				continue;
			s += this.totalVolume(_price);
		}
		return s;
	}

	return this[price].map(function(a) {
		return a.volume;
	}).reduce(function(a, b) {
		return a + b;
	}, 0);
};

OrderBook.prototype.maxPrice = function() {
	var prices = Object.keys(this);

	if (prices.length === 0)
		throw "maxPrice error: empty prices"

	return Math.max.apply(Math, prices);
};

OrderBook.prototype.minPrice = function() {
	var prices = Object.keys(this);

	if (prices.length === 0)
		throw "minPrice error: empty prices"

	return Math.min.apply(Math, prices);
};

OrderBook.prototype.shiftOrder = function(price, canRemoveIssuer) {
	if (!this[price] || this[price].length === 0)
		throw "OrderBook.shiftOrder error";

	if (this[price][0].issuer && !canRemoveIssuer)
		return null;

	var order = this[price].shift();
	if (this[price].length === 0)
		delete this[price];
	return order;
};

OrderBook.prototype.spliceOrder = function(price, i) {
	if (!this[price] || this[price].length <= i)
		throw "OrderBook.spliceOrder error";

	var order = this[price].splice(i, 1)[0];
	if (this[price].length === 0)
		delete this[price];
	return order;
};

OrderBook.prototype.toString = function() {
	var a = [];
	for ( var p in this) {
		var b = [];
		for ( var i = 0; i < this[p].length; i++)
			b.push(util.inspect(this[p][i]));
		a.push("[ " + b.join(", ") + " ]");
	}
	return "{ " + a.join(", ") + " }";
};

// -------------------------------------------

var Exchange = function(properties) {
	if (typeof properties !== "object")
		throw "Unknown start exchange format!";
	for ( var p in properties) {
		this[p] = properties[p];
	}
	this.trades = [];
	this.buys = new OrderBook();
	this.sells = new OrderBook();
	this.npc = new Trader(CONST.NPC);
	this.issuer = new Trader(CONST.ISSUER);
	this.gaussian = new Gaussian();

	/* При запуске есть только одна заявка на продажу - от эмитента акций */
	if (this.startPrice && this.startPool) {
		this.sells.addOrder({
		    type : CONST.SELL,
		    price : this.startPrice,
		    volume : this.startPool,
		    maker : this.issuer,
		    market : false
		});
	}

	this.lastPrice = this.startPrice;
	this.logCallback = null;
	this.traders = [];
};

Exchange.prototype.getBid = function() {
	return this.buys.maxPrice();
}

Exchange.prototype.getAsk = function() {
	return this.sells.minPrice();
}

Exchange.prototype.log = function(msg) {
	if (this.logCallback !== null)
		this.logCallback(msg);
};

/*
 * Уничтожение заявок, которые слишком далеко от текущей цены или пустые.
 * Относится только к NPC
 */
Exchange.prototype.clear = function() {
	var curPrice = this.lastPrice;

	if (this.npc.money < CONST.MONEY_NORM)
		this.killCheapBuy();
	var self = this;

	var clearBook = function(ob) {
		for ( var price in ob) {
			if (!this.hasOwnProperty(price))
				continue;
			if (ob[price].length === 0) {
				delete ob[price];
				continue;
			}
			if (Math.abs(curPrice - price) > CONST.PRICE_LAG) {
				var i = 0;
				while (ob[price] && i < ob[price].length) {
					var order = ob[price][i];
					if (order.maker.type === CONST.NPC) {
						order = ob.spliceOrder(price, i);
						this.log(util.format(
						        "{%s} <em>CLEARED</em> (%s): [%d , %d]",
						        this.stock, order.type, order.price,
						        order.volume));
						if (order.type == CONST.SELL) {
							this.npc.shares += order.volume;
						}
					} else
						i++;
				}
			}
		}
	}

	clearBook(this.buys);
	clearBook(this.sells);
};

/* Подача заявки на покупку или продажу */
Exchange.prototype.putOrder = function(order) {
	this.trades = [];

	var ob = (order.type == CONST.BUY) ? this.buys : this.sells;
	var opp_b = (order.type == CONST.BUY) ? this.sells : this.buys;

	this.log(util.format("{%s} (%s) [%d , %d] %s", this.stock, order.type
	        .toUpperCase(), order.price, order.volume, (order.spec_msg || "")));

	if (order.type === CONST.SELL && order.maker.type === CONST.NPC)
		this.npc.shares -= order.volume;

	var traded = false; // признак, что торговали хотя бы раз
	var hasMoney = true;

	while (order.volume > 0 && opp_b.length() > 0) {
		// наилучшая цена, предлагаемая рынком
		var oppPrice = (order.type == CONST.BUY) ? this.getAsk() : this
		        .getBid();

		// будет ли исполнение заявки
		var isTrade = order.market
		        || ((order.type == CONST.BUY) ? order.price >= oppPrice
		                : order.price <= oppPrice);
		if (!isTrade)
			break;
		else
			traded = true;

		var oppOrder = opp_b[oppPrice][0];
		var oppIssuer = !!oppOrder.issuer;

		this.log(util.format("{%s} >>>: [%d , %d]", this.stock, oppPrice,
		        oppOrder.volume));

		var tradeVolume = Math.min(order.volume, oppOrder.volume); // объем
																	// торговли
		hasMoney = true;
		// ------------------------------------
		// оба участника сделки - NPC
		if (order.maker.type === CONST.NPC && oppOrder.maker.type === CONST.NPC) {
			if (tradeVolume * oppPrice > this.npc.money) {
				tradeVolume = Math.floor(this.npc.money / oppPrice);
				hasMoney = false;
			}
			this.npc.money += 0;
			this.npc.shares += tradeVolume; // возвращаем акции в пул
		}
		// оба участника сделки - фирма
		else if (order.maker.type === CONST.ISSUER
		        && oppOrder.maker.type === CONST.ISSUER) {
			// странная ситуация, ничего не меняется
		}
		// фирма продает акции
		else if ((oppOrder.maker.type === CONST.ISSUER
		        && order.maker.type === CONST.NPC && order.type === CONST.BUY)
		        || (oppOrder.maker.type === CONST.NPC
		                && order.maker.type === CONST.ISSUER && order.type === CONST.SELL)) {

			if (tradeVolume * oppPrice > this.npc.money) {
				tradeVolume = Math.floor(this.npc.money / oppPrice);
				hasMoney = false;
			}
			this.npc.money -= tradeVolume * oppPrice;
			this.npc.shares += tradeVolume;
		}
		// фирма выкупает у людей
		else if ((oppOrder.maker.type === CONST.ISSUER
		        && order.maker.type === CONST.NPC && order.type === CONST.SELL)
		        || (oppOrder.maker.type === CONST.NPC
		                && order.maker.type === CONST.ISSUER && order.type === CONST.BUY)) {
			this.npc.money += tradeVolume * oppPrice;
			this.npc.shares += 0; // уже вычтены при заявке
		}
		// ---------------------------------------

		oppOrder.volume -= tradeVolume;
		order.volume -= tradeVolume;

		this.trades.unshift({
		    price : oppPrice,
		    volume : tradeVolume
		});

		if (oppOrder.volume === 0 || (!hasMoney && oppOrder.type === CONST.BUY)) {
			oppOrder = opp_b.shiftOrder(oppPrice, true);
			if (!hasMoney) {
				this
				        .log(util
				                .format(
				                        "{%s} <font color=orange>NO MONEY</font> ->%s [%d, %d]",
				                        this.stock, oppOrder.type,
				                        oppOrder.price, oppOrder.volume));
			}
		}

		if (order.volume > 0 && order.type === CONST.BUY && !hasMoney) {
			order.volume = 0;
		}
	}

	if (traded) {
		if (order.volume > 0) {
			this.log(util.format("{%s} +++ VOLUME = %d", this.stock,
			        order.volume));
		}
		if (order.volume === 0 && hasMoney) {
			this.log(util.format("{%s} +++ <font color=green>COMPLETE</font>",
			        this.stock));
		}
		if (order.volume === 0 && !hasMoney) {
			this
			        .log(util.format(
			                "{%s} +++ <font color=brown>INCOMPLETE</font>",
			                this.stock));
		}
	}

	if (order.volume > 0) {
		ob.addOrder(order);
	}

	if (this.trades.length > 0)
		this.lastPrice = this.trades[0].price;
};

/* Убираем заявку с максимальной ценой продажи */
Exchange.prototype.killExpensiveSell = function() {
	if (this.sells.length() === 0)
		return;

	var prices = Object.keys(this.sells).sort(function(a, b) {
		return b - a;
	});
	var order = null;

	for ( var j = 0; j < prices.length; j++) {
		var i = 0, price = prices[j];
		while (i < this.sells[price].length) {
			if (this.sells[price][i].maker.type !== CONST.NPC)
				i++;
			else {
				order = this.sells.spliceOrder(price, i);
				break;
			}
		}
		if (order)
			break;
	}
	;

	if (order === null) {
		this.log(util.format("{%s} COULD NOT KILL SELL", this.stock));
	} else {
		this.npc.shares += order.volume;
		this.log(util.format("{%s} KILLED SELL [%d , %d]", this.stock, price,
		        order.volume));
	}
};

Exchange.prototype.killCheapBuy = function() {
	if (this.buys.length() < 5)
		return;

	var prices = Object.keys(this.buys).sort(function(a, b) {
		return a - b;
	});
	var order = null;

	for ( var j = 0; j < prices.length; j++) {
		var i = 0, price = prices[j];
		while (i < this.buys[price].length) {
			if (this.buys[price][i].maker.type !== CONST.NPC)
				i++;
			else {
				order = this.buys.spliceOrder(price, i);
				break;
			}
		}
		if (order)
			break;
	}
	;

	if (order === null) {
		this.log(util.format("{%s} COULD NOT KILL BUY", this.stock));
	} else {
		this.log(util.format("{%s} KILLED BUY [%d , %d]", this.stock, price,
		        order.volume));
	}
};

/* Генерация заявки */
Exchange.prototype.genOrder = function() {
	var order = null;
	var ran = Math.random();

	// с вероятностью 0.5% на рынок поступает 500к
	if (ran < 0.005) {
		this.npc.money += 500000;
	}

	// с вероятностью 1% фирма выкупает 10000 акций по (рыночной цене - 10),
	// отложкой
	if (ran < 0.01) {
		order = {
		    type : CONST.BUY,
		    price : Math.max(this.lastPrice - 10, CONST.PRICE_MIN),
		    volume : 10000,
		    maker : this.issuer,
		    spec_msg : " !!BUYOUT LIM!!"
		};
		;
	}
	// с вероятностью 1,5% фирма выкупает 10000 акций по рыночной цене
	else if (ran < 0.02) {
		order = {
		    type : CONST.BUY,
		    market : true,
		    price : this.lastPrice,
		    volume : 10000,
		    maker : this.issuer,
		    spec_msg : " !!BUYOUT!!"
		};
	}
	// с вероятностью 3.5% фирма выставляет на продажу 5000 акций по рыночной
	// цене, но если она < 10, то все таки отложенный ордер
	else if (ran > 0.965) {
		order = {
		    type : CONST.SELL,
		    market : (this.lastPrice >= 10),
		    price : (this.lastPrice >= 10) ? this.lastPrice : 10,
		    volume : 5000,
		    maker : this.issuer,
		    spec_msg : " !!NEW ISSUE!!"
		};
	}
	// акций вообще не осталось на рынке - отложенным ордером 20000 штук -
	// текущая цена + 5
	else if (this.sells.length() === 0 && this.npc.shares === 0) {
		order = {
		    type : CONST.SELL,
		    price : this.lastPrice + 5,
		    volume : 20000,
		    maker : this.issuer,
		    spec_msg : " !!EXTRA ISSUE!!"
		};
	} else
		do {
			order = this.genNPCOrder();
		} while (order === null);

	return order;
}

/* Генерация заявки NPC */
Exchange.prototype.genNPCOrder = function() {
	// Акции продает только эмитент или юзеры
	var nothingToSell = (this.npc.shares === 0 && this.sells.noNPCOrders());

	var type = (nothingToSell || Math.random() > 0.5) ? CONST.BUY : CONST.SELL;

	/*
	 * если все доступные акции NPS уже продаются, аннулируем заявку с
	 * максимальной ценой
	 */
	if (type === CONST.SELL && this.npc.shares === 0)
		this.killExpensiveSell();

	var price = 0;
	var volume = 0;
	var market = false;

	var buyExists = this.buys.length() > 0;
	var sellExists = this.sells.length() > 0;

	// базовая цена -
	if (buyExists && sellExists) {
		price = (type === CONST.BUY) ? this.getBid() : this.getAsk();
	} else if (buyExists && type === CONST.SELL) {
		price = this.getBid() + CONST.AG_SPREAD;
	} else if (sellExists && type === CONST.BUY) {
		price = this.getAsk() - CONST.AG_SPREAD;
	}

	// аддитивный модификатор цены
	var shift = Math.random() * CONST.PRICE_RANGE * this.volatility;

	// модификатор объема
	var vmod = 1.0;

	// устанавливаем исполнение ордера и цену
	if (Math.random() < CONST.MARKET_LIMIT_RATIO) {
		market = true;
		price = this.lastPrice;
		vmod *= CONST.MARKET_VOL_MOD;
	} else {
		if (type === CONST.BUY) {
			if (Math.random() > 0.5)
				price = Math.min(price + shift, this.lastPrice - 1);
			else
				price = price - shift;
		} else {
			if (Math.random() > 0.5)
				price = Math.max(price - shift, this.lastPrice + 1);
			else
				price = price + shift;
		}
	}

	// минимальная цена
	if (price < CONST.PRICE_MIN)
		price = CONST.PRICE_MIN;

	// объем
	volume = Math.max(Math.abs(this.gaussian.nextGaussian() * CONST.VOL_RANGE),
	        1);

	var vvmod = 1.0;
	// Повышение лота в зависимости от текщего числа денег в "пуле"
	if (type == CONST.BUY) {
		vvmod *= Math.pow(CONST.PRICE_FLOOR / price, 0.33);
		vvmod *= Math.pow(this.npc.money / CONST.MONEY_NORM, 0.33);
	}

	if (isNaN(vvmod))
		vvmod = 1.0;
	if (isNaN(vmod))
		vmod = 1.0;

	volume *= vmod * vvmod;

	if (isNaN(price) || isNaN(volume))
		throw util.format(
		        "Order generation broken: price %d volume %d vmod %d vvmod %d",
		        price, volume, vmod, vvmod);

	// верхний предел объема для покупателей - не можем купить больше, чем
	// осталось денег
	if (type == CONST.BUY && this.npc.money < volume * price) {
		volume = this.npc.money / price;
		// если денег совсем нет, тогда вообще фейл
		if (Math.floor(volume) < CONST.VOL_FLOOR)
			return null;
	}

	// верхний предел лота для продавцов - не можем продать больше, чем акций на
	// руках
	if (type == CONST.SELL && volume > this.npc.shares)
		volume = this.npc.shares;

	// нижний предел объема
	if (volume < CONST.VOL_FLOOR)
		volume = CONST.VOL_FLOOR;

	return {
	    market : market,
	    maker : this.npc,
	    type : type,
	    price : Math.floor(price),
	    volume : Math.floor(volume)
	};
};

/* обрабатываем данные для UI */
Exchange.prototype.stockData = function() {
	var self = this;
	var data = {};
	data.st = self.stock;
	data.desc = self.desc;
	data.tv = 0;
	data.tp = 0;
	data.bullVol = 0;
	data.bearVol = 0;
	data.pool = self.npc.shares;
	data.money = self.npc.money;

	if (isNaN(data.pool) || data.pool === null)
		throw "Bad pool";
	if (isNaN(data.money) || data.money === null)
		throw "Bad money";

	for ( var i = 1; i <= 5; i++) {
		data['b' + i + 'p'] = 0;
		data['b' + i + 'v'] = 0;
		data['a' + i + 'p'] = 0;
		data['a' + i + 'v'] = 0;
	}

	if (self.trades.length > 0) {
		data.tp = self.trades[0].price;
		data.tv = self.trades[0].volume;
	}

	var buyExists = this.buys.length() > 0;
	var sellExists = this.sells.length() > 0;

	if (buyExists) {
		var buyPrices = Object.keys(self.buys).sort(function(a, b) {
			return b - a;
		}).slice(0, 5);
		if (buyPrices.length > 0)
			data.bullVol = self.buys.totalVolume();
		for (i = 0; i < buyPrices.length; i++) {
			data['b' + (i + 1) + 'p'] = buyPrices[i];
			data['b' + (i + 1) + 'v'] = self.buys.totalVolume(buyPrices[i]);
		}
	}
	if (sellExists) {
		var askPrices = Object.keys(self.sells).sort(function(a, b) {
			return a - b;
		}).slice(0, 5);
		if (askPrices.length > 0)
			data.bearVol = self.sells.totalVolume();
		for (i = 0; i < askPrices.length; i++) {
			data['a' + (i + 1) + 'p'] = askPrices[i];
			data['a' + (i + 1) + 'v'] = self.sells.totalVolume(askPrices[i]);
		}
	}
	return data;
};

module.exports.Exchange = Exchange;