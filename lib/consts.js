module.exports =
{
	BUY: "buys",
	SELL: "sells",
	ISSUER: "issuer",
	NPC: "npc",
	PRICE_MIN: 1,
	PRICE_FLOOR: 50,
	PRICE_RANGE: 100,
	PRICE_CEILING: 5000,
	AG_SPREAD: 10,
	MARKET_LIMIT_RATIO: 0.6,
	MARKET_VOL_MOD: 0.5,
	VOL_FLOOR: 1,
	VOL_RANGE: 2000,
	TIME_FLOOR: 500,
	TIME_RANGE: 1000,
	MONEY_NORM: 50000,
	MONEY: 10000000,
	USER_MONEY: 50000,
	PRICE_LAG: 70,
	INITIAL:{
				'MAKL' : { stock: 'MAKL', startPool: 90000, startPrice:  100, volatility: 0.1, desc: "Low-volatile stock, Max vol: 0.1"},
				'FAKL' : { stock: 'FAKL', startPool: 100000, startPrice:  100, volatility: 0.2, desc: "Low-volatile stock, Max vol: 0.2"},
				'BIKL' : { stock: 'BIKL', startPool: 120000, startPrice:  100, volatility: 0.3, desc: "Mid-volatile stock, Max vol: 0.3"},
				'SEMT' : { stock: 'SEMT', startPool: 100000, startPrice:  100,  volatility: 0.4, desc: "Mid-volatile stock, Max vol: 0.4"},
				'CUMT' : { stock: 'CUMT', startPool: 100000, startPrice:  100,  volatility: 0.5, desc: "High-volatile stock, Max vol: 0.5"}
			}
}