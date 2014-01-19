var global_cache = { currentStock: ""};

var pageChart =
{
    chart: null,
    stock: "",
    load: function() {
        var self = this;
        var cache = global_cache[this.stock] || {
            data: [],
            last_id: null,
            openPrice: null,
            stock: null
        };
        global_cache[this.stock] = cache;

        $.getJSON("/api/trades1/"
            + this.stock
            + ((cache.last_id) ? "/?last_id=" + cache.last_id : "")
            + ((cache.openPrice) ? "&openPrice=" + cache.openPrice
            : ""), function(_data) {
            cache.data = cache.data.concat(_data.points);
            cache.last_id = _data.last_id;
            cache.openPrice = _data.openPrice;
            cache.stock = self.stock;

            if (self.chart.series[0].data.length === 0) {
                self.chart.series[0].setData(cache.data.map(function(point) {
                    return [ point[0], point[1], point[2], point[3], point[4] ];
                }));
                self.chart.series[1].setData(cache.data.map(function(point) {
                    return [ point[0], point[5] ];
                }));
            } else {
                _data.points.forEach(function(point) {
                    self.chart.series[0].addPoint([ point[0], point[1], point[2],
                        point[3], point[4] ], false);
                    self.chart.series[1].addPoint([ point[0], point[5] ], false);
                });
            }
            self.chart.redraw();
        });
    },

    update: function(timestamp, price, volume) {
        this.chart.series[0].addPoint([ timestamp, price, price, price, price], true);
        this.chart.series[1].addPoint([timestamp, volume], true);
    }
}


var cache = {
		data: [],
		last_id: null,
		openPrice: null,
		stock: null
};

var chartOptions = {
    chart : {
        animation : false,
        panning : false,
        renderTo : "graph"
    },

    navigator: {

    },

    loading: {
      showDuration: 500
    },

    plotOptions : {
        candlestick : {
            animation : false,
            cropThreshold : 40
        },
        column : {
	        animation : false
        }
    },

    rangeSelector : {
	    buttons : [ {
	        type : 'minute',
	        count : 1,
	        text : '1m'
	    }, {
	        type : 'minute',
	        count : 10,
	        text : '10m'
	    }, {
	        type : 'hour',
	        count : 1,
	        text : '1h'
	    }, {
	    	type: 'hour',
	    	count: 12,
	    	text: '12h'
	    } ]
    },

    title : {
	    text : ''
    },

    yAxis : [ {
        title : {
	        text : ''
        },
        height : 250,
        lineWidth : 1
    }, {
        title : {
	        text : ''
        },
        height : 50,
        top : 250,
        offset : 0,
        lineWidth : 0
    } ],

    series : [
            {
                type : 'candlestick',
                name : '',
                data : [],
                dataGrouping : {
                    dateTimeLabelFormats : {
	                    minute : [ '%A, %b %e, %H:%M:%S',
	                            '%A, %b %e, %H:%M:%S', '-%H:%M:%S' ]
                    },
                    units : [ [ 'minute', [ 1, 5, 15, 30 ] ],
                            [ 'hour', [ 1, 4 ] ], [ 'day', [ 1 ] ]

                    ]
                },
                zIndex: 2
            },
            {
                type : 'column',
                name : 'Volume',
                color: '#ccddcc',
                data : [],
                yAxis : 1,
                dataGrouping : {
                    dateTimeLabelFormats : {
	                    minute : [ '%A, %b %e, %H:%M:%S',
	                            '%A, %b %e, %H:%M:%S', '-%H:%M:%S' ]
                    },
                    units : [ [ 'minute', [ 1, 5, 15, 30 ] ],
                            [ 'hour', [ 1, 4 ] ], [ 'day', [ 1 ] ] ]
                },
                zIndex: 1
            } ]
}

function setStock(options, stock) {
	var clonedOptions = {};
	$.extend(true, clonedOptions, options);
	clonedOptions.title.text = stock;
	clonedOptions.series[0].name = stock;
	return clonedOptions;
}


var getChart = function(stock) {
	if (global_cache.currentStock !== stock) {
        pageChart.chart = new Highcharts.StockChart(setStock(chartOptions, stock));;
        pageChart.stock = stock;
        global_cache.currentStock = stock;
        pageChart.load();
	}	
}
