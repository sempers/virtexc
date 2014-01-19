var socket = io.connect();

$.get('/templates/trade-table.ejs', function(storedTemplate) {
	var loaded = false;

	socket.emit('requestData', {});

	var StockModel = Backbone.Model.extend({
		updatePrices: function(_data) {
			this.set({data: _data});
		}
	});

	var StockCollection = Backbone.Collection.extend({
		model: StockModel
	});

	var StockView = Backbone.View.extend({
		initialize: function() {
			var self = this;
			self.render();
		},

		render: function() {
			for (var i=0; i<window.stockCollection.models.length; i++) {
				var data = window.stockCollection.models[i];
				var rowView = new StockRowView({model: data});
				$('.stock-data').append(rowView.render().el);
			}
		}
	});

	var StockRowView = Backbone.View.extend({
		tagName: 'tr',

		initialize: function(){
			_.bindAll(this, 'setPrices');
			this.model.bind('change', this.setPrices);
		},

		render: function() {
			var template = _.template(storedTemplate);
			var htmlString = template(this.model.toJSON());
			$(this.el).html(htmlString).addClass('va');
			return this;
		},

		setPrices: function() {
			var newData = this.model.toJSON().data;
			for (var attr in newData) {
				var value = newData[attr];
				$('#' + newData.st + attr).html(value);
			}
            if (typeof pageChart !== "undefined" && pageChart.stock === newData.st){
                pageChart.update(newData.timestamp, newData.tp, newData.tv);
            }
		}
	});

	var connected = true;

	socket.on("connect", function() {
	    connected = true;
        $("#restartLink").removeClass();
    });

	socket.on('exchangeData', function (data) {
		if (loaded) {
			var model = window.stockCollection.get(data.st);
			model.updatePrices(data);
			var el = document.getElementById("connection_status");
            if (el.className !== "online") {
                el.className = "online";
                el.innerHTML = "Online";
            }
    		}
	});

	socket.on('initExchangeData', function (data, status) {
	    console.log(data, status);
		window.stockCollection = new StockCollection();
		for (var stock in data) {
			var stockModel = new StockModel(data[stock]);
			stockModel.set({id: stock});
			window.stockCollection.push(stockModel);
		}
		$("#excRestarts").hide();
		$("#restartLink").show();
		loaded = true;
		$("#connection_status").removeClass().addClass("established").html("Established");
		$("#db_status").html("DB " + (status.dbStatus)? "online": "offline");
		$('.stock-data *').remove();
		console.log("timeFactor = ", status.timeFactor);
		$("#timeFactor").val(status.timeFactor);
		new StockView();
	});

	socket.on('dbLog', function(msg){
        function parseMessage(m){
            return m.replace("(BUYS)",  "<font color=blue>BUY</font>")
            .replace("(SELLS)", "<font color=red>SELL</font>")
            .replace(" VOLUME = 0", " <font color=green>COMPLETE</font>");
        }

        if ($("#log div").length > 35)
            $("#log div:first").remove();
            $("#log").append("<div>"+parseMessage(msg)+"</div>");

        var el = document.getElementById("connection_status");
        if (el.className !== "online") {
            el.className = "online";
            el.innerHTML = "Online";
        }
	});

	socket.on('db_error', function(msg){
	    $("#connection_status").removeClass().addClass("offline").html(msg);
	});

	var retryConnectOnFailure = function(pause) {
        setTimeout(function() {
                      if (!connected) {
                        $.get('/ping', function(data) {
                            connected = true;
                            window.location.href = unescape(window.location.pathname);
                        });
                        retryConnectOnFailure(pause);
                      }
                    }, pause);
    };

	var RETRY_INTERVAL = 5000;

	socket.on('disconnect', function(){
	    connected = false;
        $("#connection_status").removeClass().addClass("offline").html("Offline");
        $("#restartLink").addClass("disabled");
        retryConnectOnFailure(RETRY_INTERVAL);
	});
});

//Функции, доступные из разметки
var hideLog = function() {
    $("#log").toggleClass("invisible");
    var l = document.getElementById("hideLink");
    if (l.title === "Hide log") {
        l.title = "Unhide log";
        l.innerHTML = "Unhide log";
    } else {
        l.title = "Hide log";
        l.innerHTML = "Hide log";
    }
};

var restartExchange = function() {
    var timeFactor = parseFloat($("#timeFactor").val()) || 1.0;
    socket.emit("restartExchange", timeFactor);
    $("#restartLink").hide();
    $("#excRestarts").show();
    $("#log div").remove();
};