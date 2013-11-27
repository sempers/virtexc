module.exports =
{
	BUY: "buys",
	SELL: "sells",
	PRICE_MIN: 1,
	PRICE_FLOOR: 50,
	PRICE_RANGE: 100,
	PRICE_CEILING: 5000,
	VOL_FLOOR: 1,
	VOL_RANGE: 1000,
	TIME_FLOOR: 500,
	TIME_RANGE: 1000,
	MONEY_NORM: 50000,
	MONEY: 10000000,
	PRICE_LAG: 70,
	INITIAL:{
				'MAKL' : { stock: 'MAKL', pool: 80000, startPrice:  100, volatility: 0.15, desc: "Low-volatile stock, vol: 0.15"},
				'FAKL' : { stock: 'FAKL', pool: 100000, startPrice:  100, volatility: 0.2, desc: "Low-volatile stock, vol: 0.2"},
				'BIKL' : { stock: 'BIKL', pool: 120000, startPrice:  100, volatility: 0.3, desc: "Mid-volatile stock, vol: 0.3"},
				'SEMT' : { stock: 'SEMT', pool: 100000, startPrice:  100,  volatility: 0.4, desc: "Mid-volatile stock, vol: 0.4"},
				'CUMT' : { stock: 'CUMT', pool: 100000, startPrice:  100,  volatility: 0.7, desc: "High-volatile stock, vol: 0.7"}
			}
}