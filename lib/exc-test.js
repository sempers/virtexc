var Exchange = require('./exchange').Exchange;

var ex = new Exchange({ stock: 'MAKL', pool: 50000, startPrice:  100, volatility: 0.1});
ex.order();
ex.clear();

console.log(ex);
process.exit(0);