var CONST = require('./consts');
var ex = require('./exchange');

var allData = CONST.INITIAL;

(function initExchanges() {
	for (var stock in allData) {
		var data = allData[stock];
		allData[stock] = new ex.Exchange(data);
	}
})();

//console.log(allData);
for (var a in allData)
	console.log(allData[a].stockData());