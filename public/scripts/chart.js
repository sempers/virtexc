var getChartId = null;

var data_cache = [];
	data_cache.last_id = null;
	data_cache.openPrice = null;


var getChart = function(stock){

	if (getChartId) {
		clearInterval(getChartId);
		data_cache = [];
		data_cache.last_id = null;
		data_cache.openPrice = null;
	}

	var innerFunc = function() {
		$.getJSON('/api/trades1/' + stock + ((data_cache.last_id)? "/?last_id=" + data_cache.last_id: "") + ((data_cache.openPrice)? "&openPrice=" + data_cache.openPrice : ""), function(_data) {
			var prices = [];
			var volumes = [];
			console.log("Request for id>",data_cache.last_id," openPrice = ",data_cache.openPrice," received: ", _data.points.length, " datapoints.");

			data_cache = data_cache.concat(_data.points);
			data_cache.last_id = _data.last_id;
			data_cache.openPrice = _data.openPrice;

			data_cache.forEach(function(point) {
				prices.push([
					point[0],
					point[1],
					point[2],
					point[3],
					point[4]
				]);

				volumes.push([
					point[0],
					point[5]
				]);
			});

			// create the chart
			$('#graph').highcharts('StockChart', {

			    chart: {
			        animation: false,
			        panning: false
			    },

			    plotOptions: {
			        candlestick: {
			            animation: false,
			            cropThreshold: 40
			        },
			        column: {
			            animation: false
			        }
			    },

				rangeSelector : {
					buttons:[{
					          type: 'minute',
					          count: 1,
					          text: '1m'
					        },
					        {
					          type: 'minute',
					          count: 5,
					          text: '5m'
					        },
					        {
					          type: 'minute',
					          count: 10,
					          text: '10m'
					        },
					        {
					          type: 'minute',
					          count: 30,
					          text: '30m'
					        },
					        {
					          type: 'minute',
					          count: 60,
					          text: '1h'
					        }]
				},

				title : {
					text : stock
				},

				yAxis: [{
					title: {
						text: ''
					},
					height: 250,
					lineWidth: 1
					}, {
					title: {
						text: ''
					},
					height: 50,
					top: 250,
					offset: 0,
					lineWidth: 0
				}],

				series : [{
						type : 'candlestick',
						name : stock,
						data : prices,
						dataGrouping : {
						    dateTimeLabelFormats: {
						        minute: ['%A, %b %e, %H:%M:%S', '%A, %b %e, %H:%M:%S', '-%H:%M:%S']
						    },
    						units : [
    						    ['second', [30]],
    							['minute', [1, 5, 10, 30 ]],
    							['hour', [1, 4]],
    							['day', [1]]

    						]
					    }
					    },
    					{
    						type: 'column',
    						name: 'Volume',
    						data: volumes,
    						yAxis: 1,
    						dataGrouping : {
    						    dateTimeLabelFormats: {
						        minute: ['%A, %b %e, %H:%M:%S', '%A, %b %e, %H:%M:%S', '-%H:%M:%S']
						        },
        						units : [
        						    ['second', [30]],
        							['minute', [1, 5, 10, 30]],
        							['hour', [1, 4]],
    							    ['day', [1]]
        						]
    					    }
    					}]
			});
		});
	};

	innerFunc();
	getChartId = setInterval(innerFunc, 10000);
}