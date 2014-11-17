(function (root, factory) {
    root.squid_api.view.TimeSeriesView = factory(root.Backbone, root.squid_api, squid_api.template.squid_api_timeseries_widget);
}(this, function (Backbone, squid_api) {

    View = Backbone.View.extend({

        template : null,
        dataToDisplay : 10000,
        format : null,

        initialize : function(options) {
            
            if (this.model) {
                this.listenTo(this.model, 'change:status', this.update);
                this.listenTo(this.model, 'change:error', this.render);
            }

            if (options.dataToDisplay) {
                this.dataToDisplay = options.dataToDisplay;
            }

            // setup options
            if (options.template) {
                this.template = options.template;
            } else {
                this.template = squid_api.template.squid_api_timeseries_widget;
            }

            if (options.format) {
                this.format = options.format;
            }

            // Resize
            $(window).on("resize", _.bind(this.resize(),this));
        },

        resize : function() {
            var resizing = true;
            return function() {
                if (this.resizing) {
                    window.clearTimeout(resizing);
                }
                this.resizing = window.setTimeout(_.bind(this.render,this), 100);
            };
        },

        setModel : function(model) {
            this.model = model;
            this.initialize();
        },
        
        /**
         * see : http://stackoverflow.com/questions/10966440/recreating-a-removed-view-in-backbone-js
         */
        remove: function() {
            this.undelegateEvents();
            this.$el.empty();
            this.stopListening();
            $(window).off("resize");
            return this;
        },

        update : function() {

            if (!this.model.isDone()) {
                // running
                if (this.model.get("status") == "RUNNING") {
                    $(".sq-loading").show();
                }
            } else if (this.model.get("error")) {
                // error
                $(".sq-loading").hide();
            }

            this.render();
        },

        seriesColorAssignment : function(serie) {
            // Default
            var color = "#666666";

            // Specify a colour return value for each metric
            switch (serie) {
                case "count" :
                    color = "#fe6e70";
                    break;
            }

            return color;
        },

        seriesDataValues : function(serie, dateIndex, metricIndex, modelData) {
            var seriesData = [];
            var value, date;
            for (var i=0; (i<modelData.length && i<this.dataToDisplay); i++) {
                value = modelData[i].v;
                date = moment(value[dateIndex]);
                if (date.isValid()) {
                    var object = {};
                    // Convert date value into unix
                    object.x = date.unix();
                    object.y = parseFloat(value[metricIndex]);
                    seriesData.push(object);
                } else {
                    console.debug("Invalid date : "+value[dateIndex]);
                }
            }
            return seriesData;
        },

        getData: function() {
            var data, analysis;

            analysis = this.model;
            // Use the first analyses array
            if (analysis.get("analyses")) {
                analysis = analysis.get("analyses")[0];
            }

            data = analysis.toJSON();
            data.done = this.model.isDone();

            return data;
        },

        sortDateValues : function(dates) {
            dates.sort(function(a,b){
                return (a.x - b.x);
            });
            return dates;
        },

        render : function() {

            var me = this;

            var data = this.getData();

            if (data.done) {
                
                // Print Template
                this.$el.html(this.template());

                // Metric Data Manipulation
                var metrics = this.model.get("metrics");

                // Time Series [Series Data]
                var series = [];
                
                for (i=0; i<metrics.length; i++) {
                    var object = {};
                    var metricName;
                    var metric = metrics[i].metricId;

                    // Check metric ID with column data to get a human readable name
                    for (a=0; a<data.results.cols.length; a++) {
                        if (data.results.cols[a].id === metric) {
                            metricName = data.results.cols[a].name;
                        }
                    }

                    object.color = me.seriesColorAssignment(metric);
                    object.name = metricName;
                    object.data = me.sortDateValues(me.seriesDataValues(metric, 0, i+1, data.results.rows));

                    series.push(object);
                }

                if (series.length>0 && (series[0].data.length>0)) {
                    var tempWidth = $(window).width() - 50;

                    // Time Series Chart
                    var graph = new Rickshaw.Graph({
                        element: document.getElementById("chart"),
                        width: tempWidth,
                        height: 400,
                        renderer: 'line',
                        series: series
                    });

                    graph.render();

                    var hoverDetail = new Rickshaw.Graph.HoverDetail( {
                        graph: graph,
                        xFormatter: function(x) { return "Date: " + moment.utc(x, 'X').format('YYYY-MM-DD');},
                        yFormatter: function(y) { return Math.floor(y); }
                    });

                    var legend = new Rickshaw.Graph.Legend( {
                        graph: graph,
                        element: document.getElementById('legend')
                    });

                    var xAxis = new Rickshaw.Graph.Axis.Time( {
                        graph: graph
                    });

                    var yAxis = new Rickshaw.Graph.Axis.Y( {
                        graph: graph
                    });

                    var slider = new Rickshaw.Graph.RangeSlider({
                        graph: graph,
                        element: document.querySelector('#slider')
                    });

                    var offsetForm = document.getElementById('offset_form');

                    // Change chart type on button change
                    offsetForm.addEventListener('change', function(e) {
                        var offsetMode = e.target.value;

                        if (offsetMode == 'lines') {
                            graph.setRenderer('line');
                            graph.offset = 'zero';
                        } else if (offsetMode == 'stack') {
                            graph.setRenderer('stack');
                            graph.offset = offsetMode;
                        } else if (offsetMode == 'bar') {
                            graph.setRenderer('bar');
                            graph.offset = offsetMode;
                        }

                        graph.render();

                    }, false);

                    yAxis.render();
                    xAxis.render();


                } else {
                    this.$el.html("<div class='bad-data'>Time Series incompatible, please choose another</span>");
                }
                $(".sq-loading").hide();
                return this;
            }
        }
    });

    return View;
}));
