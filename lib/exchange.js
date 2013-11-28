var util = require('util'),
    assert = require('assert'),
	CONST = require('./consts');


var OrderBook = function() {

};

OrderBook.prototype.length = function() {
    return Object.keys(this).length;
};

OrderBook.prototype.addOrder = function(order) {
    this[order.price] = this[order.price] || [];
    this[order.price].push(order);
};

OrderBook.prototype.allOrdersIssuer = function() {
	for (var _price in this) {
    	if (!this.hasOwnProperty(_price))
    		continue;
    	for (var i = 0; i< this[_price].length; i++)
    		if (!this[_price][i].issuer)
    			return false;
	}
    return true;
};

OrderBook.prototype.totalVolume = function(price) {
    if (typeof price === "undefined") {
        var s = 0;
        for (var _price in this) {
        	if (!this.hasOwnProperty(_price))
        		continue;
            s += this.totalVolume(_price);
        }
        return s;
    }

    return this[price].map(function(a) {return a.volume;})
                      .reduce(function(a,b) {return a + b;}, 0);
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
    for (var p in this) {
        var b = [];
        for (var i = 0; i<this[p].length; i++)
            b.push(util.inspect(this[p][i]));
        a.push("[ " + b.join(", ") + " ]");
    }
    return "{ " + a.join(", ") + " }";
};
//-------------------------------------------

var Exchange = function(properties){
    if (typeof properties !== "object")
        throw "Unknown start exchange format!";
	for (var p in properties) {
		this[p] = properties[p];
	}
	this.trades = [];
	this.buys = new OrderBook();
	this.sells = new OrderBook();
	this.money = CONST.MONEY;

	/* При запуске есть только одна заявка на продажу - от эмитента акций */
	if (this.startPrice && this.pool) {
		this.sells.addOrder({type: CONST.SELL, price: this.startPrice, volume: this.pool, issuer: true});
		this.pool = 0;
	}
	this.lastPrice = this.startPrice;
	this.logCallback = null;
};


Exchange.prototype.log = function(msg) {
    if (this.logCallback !== null)
        this.logCallback(msg);
};


/* Уничтожение заявок, которые слишком далеко от текущей цены или пустые */
Exchange.prototype.clear = function() {
	var curPrice = this.lastPrice;

	if (this.money < CONST.MONEY_NORM)
	    this.killCheapBuy();
    var self = this;

    var clearBook = function(ob) {
        for (var price in ob) {
        	if (!this.hasOwnProperty(price))
        		continue;
            if (ob[price].length === 0) {
                delete ob[price];
                continue;
            }
            if (Math.abs(curPrice - price) > CONST.PRICE_LAG ) {
                var i = 0;
                while (ob[price] && i < ob[price].length) {
                    var order = ob.spliceOrder(price, i);
                    this.log(util.format("{%s} <em>CLEARED</em> (%s): [%d , %d]", this.stock, order.type, order.price, order.volume));
                    if (order.type == CONST.SELL && !order.issuer) {
                        self.pool += order.volume;
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
Exchange.prototype.order = function() {
	var self = this;
	this.trades = [];

	//anti-cleench cheat
	if (this.money < 500)
		this.money += 50000;

	var ran = Math.random();
	var order = null;
	var spec_msg = ""

	//с вероятностью 0.5% на рынок поступает 500к
	if (ran < 0.005) {
	    this.money += 500000;
	}

	// с вероятностью 2.5% фирма выкупает 10000 акций по рыночной цене
	if (ran < 0.025) {
		order = {
					type: CONST.BUY,
					price: this.lastPrice + 1,
					volume: 10000,
					issuer: true
				};
		spec_msg = " !!BUYOUT!!";
	}
	// с вероятностью 5% фирма выставляет на продажу 5000 акций по рыночной цене
	else if (ran > 0.95) {
		order = {
				type: CONST.SELL,
				price: (this.lastPrice > 10)? this.lastPrice - 1: 10,
				volume: 5000,
				issuer: true
			};
		spec_msg = " !!NEW ISSUE!!";
	}
	//акций вообще не осталось на рынке
	else if (this.sells.length()===0 && this.pool === 0) {
	    order = {
				type: CONST.SELL,
				price: (this.lastPrice > 10)? this.lastPrice - 1: 10,
				volume: 15000,
				issuer: true
			};
		spec_msg = " !!NEW ISSUE!!";
	}
	else
        do {
            order = this.genOrder();
        }
        while (order === null);

	var ob = (order.type == CONST.BUY) ? this.buys : this.sells;
	var opp_b = (order.type == CONST.BUY) ? this.sells : this.buys;

	this.log(util.format("{%s} (%s) [%d , %d] %s", this.stock, order.type.toUpperCase(), order.price, order.volume, spec_msg));

	var meIssuer = !!order.issuer; //принадлежит ли текущий ордер фирме

	if (CONST.SELL == order.type && !meIssuer)
		this.pool -= order.volume;

	var traded = false; //признак, что торговали хотя бы раз
    var hasMoney = true;

	while (order.volume > 0 && opp_b.length() > 0) {
        //наилучшая цена, предлагаемая рынком
		var oppPrice = (order.type == CONST.BUY)? opp_b.minPrice(): opp_b.maxPrice();

        //будет ли исполнение заявки
		var isTrade = (order.type == CONST.BUY) ? order.price >= oppPrice : order.price <= oppPrice;
		if (!isTrade)
			break;
		else
			traded = true;

		var oppOrder = opp_b[oppPrice][0];
		var oppIssuer = !!oppOrder.issuer;

		this.log(util.format("{%s} >>>: [%d , %d]", this.stock, oppPrice, oppOrder.volume));

		var tradeVolume = Math.min(order.volume, oppOrder.volume); //объем торговли
		hasMoney = true;
	    //------------------------------------
	    //оба участника сделки - люди
		if (!oppIssuer && !meIssuer) {
		    if (tradeVolume*oppPrice > self.money) {
                tradeVolume = Math.floor(self.money/oppPrice);
                hasMoney = false;
            }
			self.money += 0;
			self.pool += tradeVolume; //возвращаем акции в пул
		}
		//оба участника сделки - фирма
		else if (oppIssuer && meIssuer) {
			//странная ситуация, ничего не меняется
		}
		//фирма продает акции
        else if ((oppIssuer && !meIssuer && order.type === CONST.BUY) ||
                (!oppIssuer && meIssuer && order.type === CONST.SELL)){

            if (tradeVolume*oppPrice > self.money) {
                tradeVolume = Math.floor(self.money/oppPrice);
                hasMoney = false;
            }
            self.money -= tradeVolume*oppPrice;
            self.pool += tradeVolume;
        }
        //фирма выкупает у людей
        else if ( (oppIssuer && !meIssuer && order.type === CONST.SELL) ||
                (!oppIssuer && meIssuer && order.type === CONST.BUY)) {
            self.money += tradeVolume*oppPrice;
            self.pool += 0; //уже вычтены при заявке
        }
		//---------------------------------------

    oppOrder.volume -= tradeVolume;
    order.volume -= tradeVolume;

    this.trades.unshift({price: oppPrice, volume: tradeVolume});

    if (oppOrder.volume === 0 || (!hasMoney && oppOrder.type === CONST.BUY)) {
        oppOrder = opp_b.shiftOrder(oppPrice, true);
        if (!hasMoney) {
            this.log(util.format("{%s} <font color=orange>NO MONEY</font> ->%s [%d, %d]",
            this.stock, oppOrder.type, oppOrder.price, oppOrder.volume));
        }
    }

    if (order.volume > 0 && order.type === CONST.BUY && !hasMoney) {
        order.volume = 0;
    }
    }

    if (traded) {
    if (order.volume > 0) {
        this.log(util.format("{%s} +++ VOLUME = %d", this.stock, order.volume));
    }
    if (order.volume === 0 && hasMoney) {
        this.log(util.format("{%s} +++ <font color=green>COMPLETE</font>", this.stock));
    }
    if (order.volume === 0 && !hasMoney) {
        this.log(util.format("{%s} +++ <font color=brown>INCOMPLETE</font>", this.stock));
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

	var prices = Object.keys(this.sells).sort(function(a,b){ return b-a; });
	var order = null;
	for (var j = 0; j<prices.length; j++) {
		var i = 0, price = prices[j];
		while (i < this.sells[price].length) {
			if (this.sells[price][i].issuer)
				i++;
			else {
				order = this.sells.spliceOrder(price, i);
				break;
			}
		}
		if (order)
			break;
	};

	if (order === null) {
		this.log(util.format("{%s} COULD NOT KILL SELL", this.stock));
	} else {
		this.pool += order.volume;
		this.log(util.format("{%s} KILLED SELL [%d , %d]", this.stock, price, order.volume));
	}
};

Exchange.prototype.killCheapBuy = function() {
    if (this.buys.length() < 5)
        return;

    var prices = Object.keys(this.buys).sort(function(a,b){ return a-b; });
	var order = null;
	for (var j = 0; j<prices.length; j++) {
		var i = 0, price = prices[j];
		while (i < this.buys[price].length) {
			if (this.buys[price][i].issuer)
				i++;
			else {
				order = this.buys.spliceOrder(price, i);
				break;
			}
		}
		if (order)
			break;
	};

	if (order === null) {
		this.log(util.format("{%s} COULD NOT KILL BUY", this.stock));
	} else {
		this.log(util.format("{%s} KILLED BUY [%d , %d]", this.stock, price, order.volume));
	}
};

/* Генерация заявки */
Exchange.prototype.genOrder = function() {
	//Акции продает только эмитент
	var nothingToSell = (this.pool === 0 && this.sells.allOrdersIssuer());

	var type = (nothingToSell || Math.random() > 0.5 ) ? CONST.BUY: CONST.SELL;

    /* если все доступные акции уже заявлены, убираем максимальную заявку */
	if (type === CONST.SELL && this.pool === 0)
		this.killExpensiveSell();

	var price = 0;
	var volume = 0;

	var buyExists = this.buys.length() > 0;
	var sellExists = this.sells.length() > 0;

	//базовая цена
	if ((!buyExists && !sellExists)) {
		price = this.startPrice;
	} else if (buyExists && sellExists) {
		price = (this.buys.maxPrice() + this.sells.minPrice())/2;
	} else if (buyExists) {
		price = this.buys.maxPrice();
	} else {
		price = this.sells.minPrice();
	}

	//аддитивный модификатор цены
	var shift = Math.random() * CONST.PRICE_RANGE * this.volatility;
	//price modifier
	var mod = 1.0;
	//volume modifier
	var vmod = 1.0;

	//модификатор цены в зависимости от намерений трейдера
	if (type === CONST.BUY)
		if (Math.random()<0.6)
			mod = -1;
		else {
			mod = 1;
			vmod = 2;
	}
	if (type === CONST.SELL)
		if (Math.random()<0.6)
			mod = 1;
		else {
			mod = -1;
			vmod = 2;
		}
	//Модификация уровнями сопротивления/поддержки (реально - потолком и минимальной)
	if (price < CONST.PRICE_FLOOR)
		mod = 1.2;
	if (price > CONST.PRICE_CEILING)
		mod = -1.1;

	var oldPrice = price;
	price += shift*mod;

	//модификация лота в зависимости от измененной цены
	vmod *= oldPrice/price;

	//минимальная цена
	if (price < CONST.PRICE_MIN)
		price = CONST.PRICE_MIN;

	//минимальный лот
	volume = (Math.random() * CONST.VOL_RANGE) + CONST.VOL_FLOOR;

	//рандомное повышение лота
	var ran = Math.random();
	if (ran > 0.9)
		vmod *= 1.5;
	if (ran > 0.95)
		vmod *= 2;
	if (ran > 0.975)
		vmod *= 2.5;
	if (ran > 0.99)
		vmod *= 5;

	var vvmod = 1.0;
	//Повышение лота в зависимости от текщего числа денег в "пуле"
	if (type == CONST.BUY) {
		vvmod *= Math.pow(CONST.PRICE_FLOOR / price, 0.33);
		vvmod *= Math.pow(this.money / CONST.MONEY_NORM, 0.2);
	}

	if (isNaN(vvmod))
		vvmod = 1.0;
	if (isNaN(vmod))
	    vmod = 1.0;

	volume *= vmod*vvmod;

	if (isNaN(price) || isNaN(volume))
		throw util.format("Order generation broken: price %d volume %d vmod %d vvmod %d",price, volume, vmod, vvmod);

	//верхний предел лота - не можем купить больше, чем осталось денег в "пуле"
	if (type == CONST.BUY && this.money < volume * price) {
		 volume = this.money / price;
		 //если денег совсем нет, тогда вообще фейл
		 if (Math.floor(volume) < CONST.VOL_FLOOR)
		    return null;
	}

	//нижний предел лота
	if (volume <  CONST.VOL_FLOOR)
		volume = CONST.VOL_FLOOR;

	//верхний предел лота для продавцов - не можем продать больше, чем акций на руках
	if (type == CONST.SELL && volume > this.pool)
		volume = this.pool;

	return {
		type: type,
		price: Math.floor(price),
		volume: Math.floor(volume)
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
	data.pool = self.pool;
	if (isNaN(data.pool) || data.pool === null)
		throw "Bad pool";
	data.money = self.money;


	for (var i = 1; i <= 5; i++) {
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
		var buyPrices = Object.keys(self.buys).sort(function(a,b) {return b - a;}).slice(0,5);
		if (buyPrices.length > 0)
			data.bullVol = self.buys.totalVolume();
		for (i=0; i < buyPrices.length; i++) {
			data['b' + (i + 1) + 'p'] = buyPrices[i];
			data['b' + (i + 1) + 'v'] = self.buys.totalVolume(buyPrices[i]);
		}
	}
	if (sellExists) {
		var askPrices = Object.keys(self.sells).sort(function(a,b) {return a - b;}).slice(0,5);
		if (askPrices.length > 0)
			data.bearVol = self.sells.totalVolume();
		for (i=0; i < askPrices.length; i++) {
			data['a' + (i + 1) + 'p'] = askPrices[i];
			data['a' + (i + 1) + 'v'] = self.sells.totalVolume(askPrices[i]);
		}
	}
	return data;
};

module.exports.Exchange = Exchange;
