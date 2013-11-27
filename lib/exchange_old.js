var util = require('util'),
	CONST = require('./consts');

var Exchange = function(properties){
    if (typeof properties !== "object")
        throw "Unknown start exchange format!";
	for (var p in properties) {
		this[p] = properties[p];
	}
	this.trades = [];
	this.buys = {};
	this.buys.volumes = {};
	this.buys.prices = [];
	this.sells = {};
	this.sells.volumes = {};
	this.sells.prices = [];
	this.money = CONST.MONEY;
	/* При запуске есть только одна заявка на продажу - от эмитента акций */
	if (this.startPrice && this.pool) {
		this.sells.prices.push(this.startPrice);
		this.sells.volumes[this.startPrice] = this.pool;
		this.maxPool = this.pool;
		this.pool = 0;
	}
	this.lastPrice = -1;
	this.logCallback = null;
};

Exchange.prototype.log = function(msg) {
    if (this.logCallback !== null)
        this.logCallback(msg);
};

Exchange.prototype.addPool = function(x, msg){
	if (typeof x === "undefined" || x===null) {
		//console.log({err: "pool error", msg: msg});
		throw null;
	}
	else
		this.pool += x;
};

Exchange.prototype.addMoney = function(x, msg){
	if (typeof x === "undefined" || x===null) {
		//console.log({err: "money error", msg: msg});
		throw null;
	}
	else
		this.money += x;
};

/* Уничтожение заявок, которые слишком далеко от текущей цены */
Exchange.prototype.clear = function() {
	var self = this;
	if (self.trades.length === 0)
		return;
	
	var curPrice = self.trades[0].price;
		
	for (var price in self.buys.volumes) {
		if (Math.abs(curPrice - price) > CONST.PRICE_LAG) {
			self.addMoney(self.buys.volumes[price]*price, "clear buys");
			self.buys.prices.splice(self.buys.prices.indexOf(parseInt(price, 10)), 1);
			delete self.buys.volumes[price];
		}
	}	
	for (price in self.sells.volumes) {
		if (Math.abs(curPrice - price) > CONST.PRICE_LAG) {
			self.addPool(self.sells.volumes[price], "clear sells");
			self.sells.prices.splice(self.sells.prices.indexOf(parseInt(price, 10)), 1);
			delete self.sells.volumes[price];
		}
	}
};

/* Подача заявки на покупку или продажу */
Exchange.prototype.order = function() {
	var self = this;
	self.trades = [];
	
	//anti-cleench cheat
	if (self.money < 100)
		self.money += 50000;
	
	var order = self.genOrder();
	var orderBook = (CONST.BUY == order.type) ? self.buys : self.sells;
	var oppositeBook = (CONST.BUY == order.type) ? self.sells : self.buys;
	var price = order.price;
	var volume = order.volume;
	self.log(util.format("{%s} (%s) [%d , %d]", self.stock, order.type.toUpperCase(), price, volume));
	
	if (CONST.SELL == order.type)
		self.addPool(-volume, "new sell");
		
	if (CONST.BUY == order.type)
		self.addMoney(-volume*price, "new buy");
		
	var traded = false;
	while (volume > 0 && oppositeBook.prices.length > 0) { 
		//best price and volume
		var oppPrice = oppositeBook.prices[0];
		var oppVolume = oppositeBook.volumes[oppPrice];
		var isTrade = (CONST.BUY == order.type) ? price >= oppPrice : price <= oppPrice;
		if (!isTrade)
			break;
		else
			traded = true;
		self.log(util.format("{%s} >>>: [%d , %d]", self.stock, oppPrice, oppVolume));
		
		if (oppVolume > volume) {
			self.trades.unshift({price: oppPrice, volume: volume});
			oppositeBook.volumes[oppPrice] = oppVolume - volume;
			self.addPool(volume, "compl trade");
			self.addMoney(volume*oppPrice, "trade");
			volume = 0;
		}
		else {
			self.trades.unshift({price: oppPrice, volume: oppVolume});
			volume -= oppVolume;
			self.addPool(oppVolume, "incompl trade");
			self.addMoney(oppVolume*oppPrice, "incompl trade");
			oppositeBook.prices.shift();
			delete oppositeBook.volumes[oppPrice];
		}
	}	
	if (traded)
		self.log(util.format("{%s} +++ VOLUME = %d", self.stock, volume));
	
	if (orderBook.prices.indexOf(price)<0 && volume > 0)
		orderBook.prices.push(price);
	
	if (volume > 0) {
		orderBook.volumes[price] =(orderBook.volumes[price] || 0) + volume;
	}
	if (self.trades.length > 0)
		self.lastPrice = self.trades[0].price;
};

/* Убираем заявку с минимальной ценой покупки */
Exchange.prototype.killCheapBuy = function() {
	var self = this;
	if (self.buys.prices.length === 0)
		return;
	var price = self.buys.prices.pop();	
	self.addMoney(price*self.buys.volumes[price], "kill cheap");
	self.log(util.format("{%s} KILLED BUY [%d , %d]", self.stock, price, self.buys.volumes[price]));
	delete self.buys.volumes[price];
	
};

Exchange.prototype.killExpensiveSell = function() {
	var self = this;
	if (self.sells.prices.length === 0)
		return;
	var price = self.sells.prices.pop();
	//Обходной путь, не удаляем стартовую цену
	if (price === self.startPrice)
    {
        self.log(util.format("{%s} DO NOT KILL START PRICE %d", self.stock, price));
        self.sells.prices.push(price);
        return;
    }
	self.log(util.format("{%s} KILLED SELL [%d , %d]", self.stock, price, self.sells.volumes[price]));
	self.addPool(self.sells.volumes[price], "kill exp sell");
	delete self.sells.volumes[price];
};
	
/* Генерация заявки */
Exchange.prototype.genOrder = function() {
	var self = this;
	var orderType = (Math.random() > 0.5) ? CONST.BUY: CONST.SELL;
	
	self.buys.prices.sort(function (a,b) { return b-a; });
	self.sells.prices.sort(function (a,b) { return a-b; });
		
	if (orderType == CONST.SELL && self.pool === 0)
		self.killExpensiveSell();
	var price = 0;
	var volume = 0;
	
	var buyExists = self.buys.prices.length > 0;
	var sellExists = self.sells.prices.length > 0;
	
	//базовая цена
	if ((!buyExists && !sellExists))
		price = self.startPrice;
	else if (buyExists && sellExists) {
		price = (self.buys.prices[0] + self.sells.prices[0])/2;
	} else if (buyExists) {
		price = self.buys.prices[0];
	} else {
		price = self.sells.prices[0];
	}
	
	//аддитивный модификатор цены
	var shift = Math.random() * CONST.PRICE_RANGE * self.volatility;
	//price modifier
	var mod = 1.0;
	//volume modifier
	var vmod = 1.0;
	
	//модификатор цены в зависимости от намерений трейдера
	if (orderType === CONST.BUY)
		if (Math.random()<0.7)
			mod = -1;
		else {
			mod = 1;
			vmod = 2;
	}
	if (orderType === CONST.SELL)
		if (Math.random()<0.7)
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
		vmod *= 3;
	
	var vvmod = 1.0;
	//Повышение лота в зависимости от текщего числа денег в "пуле" 
	if (orderType == CONST.BUY) {
		vvmod *= Math.pow(CONST.PRICE_FLOOR / price, 0.33);
		vvmod *= Math.pow(self.money / CONST.MONEY_NORM, 0.33);
	}
	
	if (isNaN(vvmod))
		vvmod = 1.0;
		
	if (isNaN(vmod))
	    vmod = 1.0;
	//модификация лота в зависимости от измененной цены
	vmod *= oldPrice/price;		
	
	volume *= vmod*vvmod;
	
	if (isNaN(price) || isNaN(volume))
		throw "Order generation broken " + vmod + " " + vvmod;
	
	//нижний предел лота
	if (volume <  CONST.VOL_FLOOR)
		volume = CONST.VOL_FLOOR;
	
	//верхний предел лота - не можем купить больше, чем осталось денег в "пуле"
	if (orderType == CONST.BUY && self.money < volume * price) {
		while (self.money < volume*price && self.buys.prices.length > 0)
			self.killCheapBuy();
		if (self.money < volume*price)
			volume = self.money / price;
	}
	
	//верхний предел лота для продавцов - не можем продать больше, чем акций на руках
	if (orderType == CONST.SELL && volume > self.pool)
		volume = self.pool;

	return {
		type: orderType,
		price: Math.floor(price),
		volume: Math.floor(volume)
	};
};

/* обрабатываем данные для UI */
Exchange.prototype.stockData = function() {
	var self = this;
	var data = {};
	data.st = self.stock;
	data.tv = 0;
	data.tp = 0;
	data.bullVol = 0;
	data.bearVol = 0;
	data.pool = self.pool;
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
	
	var buyExists = self.buys && self.buys.prices.length > 0;
	var sellExists = self.sells && self.sells.prices.length > 0;

	if (buyExists) {	
		var buyPrices = self.buys.prices.slice().sort(function(a,b) {return b - a;}).slice(0,5);
		if (buyPrices.length > 0)
			data.bullVol = self.buys.prices
							.map(function(x) { return self.buys.volumes[x]; })
							.reduce( function (p, v) { return p + v; });
		for (i=0; i < buyPrices.length; i++) {
			data['b' + (i + 1) + 'p'] = buyPrices[i];
			data['b' + (i + 1) + 'v'] = self.buys.volumes[buyPrices[i]];
		}
	}
	if (sellExists) {
		var askPrices = self.sells.prices.slice().sort(function(a,b) {return a - b;}).slice(0,5);
		if (askPrices.length > 0)
			data.bearVol = self.sells.prices
							.map(function(x) { return self.sells.volumes[x]; })
							.reduce( function (p, v) { return p + v; });
		for (i=0; i < askPrices.length; i++) {
			data['a' + (i + 1) + 'p'] = askPrices[i];
			data['a' + (i + 1) + 'v'] = self.sells.volumes[askPrices[i]];
		}
	}
	return data;
};

module.exports.Exchange = Exchange;
