module.exports =
{
	BUY: "buys",
	SELL: "sells",
	ISSUER: "issuer",
	NPC: "npc",
	PRICE_MIN: 1,
	PRICE_FLOOR: 50,
	PRICE_CEILING: 1000,
	NO_EXTRA: false,
	AG_SPREAD: 5,
	MARKET_LIMIT_RATIO_BUY: 0.25,
	MARKET_LIMIT_RATIO_SELL: 0.25,
	BAD_PRICE_BUY: 0.15,
	BAD_PRICE_SELL: 0.15,
	MARKET_VOL_MOD: 0.5,
	VOL_FLOOR: 1,
	VOL_RANGE: 2000,
	TIME_FLOOR: 500,
	TIME_RANGE: 1000,
	MONEY_NORM: 50000,
	MONEY: 15000000,
	USER_MONEY: 50000,
	PRICE_LAG: 70,
	INITIAL:{
				'MAKL' : { stock: 'MAKL', startPool: 100000, startPrice:  100, volatility: 10, desc: "Low-volatile stock, Max vol: 10 pts"},
				'FAKL' : { stock: 'FAKL', startPool: 100000, startPrice:  100, volatility: 20, desc: "Low-volatile stock, Max vol: 20 pts"},
				'BIKL' : { stock: 'BIKL', startPool: 100000, startPrice:  100, volatility: 30, desc: "Mid-volatile stock, Max vol: 30 pts"},
				'SEMT' : { stock: 'SEMT', startPool: 100000, startPrice:  100,  volatility: 40, desc: "Mid-volatile stock, Max vol: 40 pts"},
				'CUMT' : { stock: 'CUMT', startPool: 100000, startPrice:  100,  volatility: 60, desc: "High-volatile stock, Max vol: 60 pts"}
			}
}