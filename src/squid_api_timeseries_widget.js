(function (root, factory) {
    root.squid_api.view.TimeSeriesView = factory(root.Backbone, root.squid_api, squid_api.template.squid_api_timeseries_widget);
}(this, function (Backbone, squid_api) {

    View = Backbone.View.extend({

        template : null,
        limit : 10000,
        format : null,
        d3Formatter : null,
        startDate: null,
        endDate: null,
        colorPalette: null,
        interpolationRange: null,
        yearSwitcherView: null,
        multiSeries: null,
        height: 400,
        staleMessage : "Click refresh to update",
        renderTo: ".squid-api-data-widgets-timeseries-widget #widget",
        renderLegend: ".squid-api-data-widgets-timeseries-widget #legend",
        reRunMessage: "Please manually refresh your analysis",
        legendState: {},

        initialize : function(options) {
            this.config = squid_api.model.config;

            if (options) {
                if (options.limit) {
                    this.limit = options.limit;
                }
                if (options.colorPalette) {
                    this.colorPalette = options.colorPalette;
                } else {
                    this.colorPalette = ["#067e87", "#00a0c2", "#0304b4", "#03a00b", "#0bf984", "#0ef0a2", "#068bf0", "#0c7be7", "#0540a9", "#02dafe", "#01c7b7", "#04bc68", "#061380", "#0de2b5", "#0c5e6b", "#027fa8", "#0df300", "#07f666", "#077839", "#0e7a70", "#0a947b", "#0011a3", "#00d2ab", "#03098a", "#017c8c", "#0855dd", "#0391f4", "#0c17b7", "#0d29a7", "#017a0f", "#0ec80e", "#04f4b7", "#08ec75", "#01f5e9", "#0afe29", "#09680c", "#08a459", "#03eb16", "#006116", "#01998d", "#013f2f", "#00966e", "#0d8d68", "#068b44", "#01784e", "#0de1ad", "#054010", "#0e65b6", "#04bb6d", "#02eec0", "#0875e5", "#0ac304", "#0bca4a", "#065293", "#08d7a1", "#0545eb", "#008a41", "#0572c3", "#0ceb28", "#0d9121", "#07b4a1", "#0563ac", "#046092", "#07d882", "#0d59f4", "#067bd9", "#0968b7", "#010e9f", "#0e3837", "#027d76", "#0d2478", "#00bc50", "#0b8bbc", "#028ba2", "#0a6245", "#0c5dae", "#00bbad", "#075bb4", "#03fd64", "#06fe18", "#0de939", "#0f104a", "#0c059f", "#0473ab", "#02896d", "#05fd0b", "#0d79ff", "#05a6f3", "#0c34ab", "#0486cf", "#022f39", "#09bb88", "#08a446", "#0e35d0", "#023c1b", "#0abe29", "#02b781", "#0c926f", "#02d742", "#005f34"];
                }
                if (options.interpolationRange) {
                    this.interpolationRange = options.interpolationRange;
                }
                if (options.yearSwitcherView) {
                    this.yearSwitcherView = options.yearSwitcherView;
                }
                if (options.yearAnalysis) {
                    this.yearAnalysis = options.yearAnalysis;
                }
                if (options.multiSeries) {
                    this.multiSeries = options.multiSeries;
                }
                if (options.staleMessage) {
                    this.staleMessage = options.staleMessage;
                }
                if (options.height) {
                    this.height = options.height;
                }
                if (options.template) {
                    this.template = options.template;
                } else {
                    this.template = squid_api.template.squid_api_timeseries_widget;
                }
                if (options.reRunMessage) {
                    this.reRunMessage = options.reRunMessage;
                }
            }
            if (options.configuration) {
                this.configuration = options.configuration;
            } else {
                this.configuration = {
                    interpolate: "basic",
                    right: 80,
                    height: this.height,
                    target: this.renderTo,
                    x_accessor: 'date',
                    area: false,
                    y_accessor: 'value',
                    animate_on_load: false,
                    legend_target: this.renderLegend,
                    colors: this.colorPalette,
                };
            }
            if (options.format) {
                this.format = options.format;
            } else {
                // default number formatter
                if (d3) {
                    this.format = d3.format(",.1f");
                } else {
                    this.format = function(f){
                        return f;
                    };
                }
            }
            if (this.model) {
                this.listenTo(this.model, 'change:status', this.render);
                this.listenTo(this.model, 'change:disabled', this.toggleDisplay);
                this.listenTo(this.model, 'change:error', this.render);
                this.listenTo(this.config, 'change:configDisplay', this.updateHeight);
            }

            // Resize
            $(window).on("resize", _.bind(this.resize(),this));
        },

        toggleDisplay: function() {
            if (this.model.get("disabled") || this.config.get("currentAnalysis") !== "timeAnalysis") {
                this.hide();
            } else {
                this.show();
            }
        },

        resize : function() {
            var resizing = true;
            return function() {
                if (this.resizing) {
                    window.clearTimeout(resizing);
                }
                this.resizing = window.setTimeout(_.bind(this.updateWidth,this), 100);
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

        sortDates : function(rows) {
            rows.sort(function(a,b){
                var d1 = new Date(a.v[0]).getTime();
                var d2 = new Date(b.v[0]).getTime();
                return d1 > d2 ? 1 : -1;
            });
            return rows;
        },

        getData: function() {
            var data, analysis;

            // Support Mutli / Single Analysis Jobs
            if (this.model.get("analyses")) {
                if (this.YearOverYear) {
                    analysis = this.model.get("analyses")[1];
                } else {
                    analysis = this.model.get("analyses")[0];
                }
            } else {
                analysis = this.model;
            }

            data = analysis.toJSON();
            data.done = this.model.isDone();

            return data;
        },

        updateHeight: function() {
            var configDisplay = this.config.get("configDisplay");
            if (configDisplay) {
                if (! configDisplay.visible) {
                    this.configuration.height+=configDisplay.originalHeight;
                } else {
                    this.configuration.height = this.height;
                }
                MG.data_graphic(this.configuration);
            }
        },

        updateWidth: function() {
            this.configuration.width = $(this.renderTo).width();
            MG.data_graphic(this.configuration);
        },

        renderGraphic: function(metrics) {
            this.$el.find(".sq-loading").hide();
            this.$el.find("#re-run").hide();

            // data for timeseries
            var legend = [];
            var dataset = [];
            var nVariate = false;

            // sort dates
            this.results.rows = this.sortDates(this.results.rows);

            // see if multiple dimensions exist
            for (let i=1; i<this.results.cols.length; i++) {
                if (this.results.cols[i].role == "DOMAIN") {
                    nVariate = true;
                    break;
                }
            }

            // get data
            for (i=1; i<this.results.cols.length; i++) {
                if (_.contains(metrics, this.results.cols[i].id) || ! metrics) {
                    var arr = [];
                    var metaData = [];
                    var dimCount = this.results.cols.length - 2;

                    /* Legend */

                    // if just using a metric and a date
                    if (! nVariate) {
                        legend.push(this.results.cols[i].name);
                    } else {
                    // obtain legend names from results
                        for (let dim=0; dim<dimCount; dim++) {
                            var arr = [];
                            for (ix1=0; ix1<this.results.rows.length; ix1++) {
                                if ($.inArray(this.results.rows[ix1].v[dim + 1], legend) < 0) {
                                    // store unique legend items
                                    legend.push(this.results.rows[ix1].v[dim + 1]);
                                    // store meta data for results
                                    metaData.push({
                                        name : this.results.rows[ix1].v[dim + 1],
                                        index: dim + 1
                                    });
                                }
                            }
                        }
                    }

                    /* Date Results */
                    var startDate = moment(moment(this.results.rows[0].v[0]).format('YYYY-MM-DD'));
                    var endDate = moment(moment(this.results.rows[this.results.rows.length - 1].v[0]).format('YYYY-MM-DD'));

                    // make sure a value is available for every day (standard timeseries)
                    if (! nVariate) {
                        for (var currentDay = startDate; currentDay.isBefore(endDate); startDate.add('days', 1)) {
                            var date = currentDay.format('YYYY-MM-DD');
                            var dataExists = false;

                            var obj = {
                                "date" : date
                            };
                            for (ix=0; ix<this.results.rows.length; ix++) {
                                if (this.results.rows[ix].v[0] === date) {
                                    dataExists = true;
                                    obj.value = this.results.rows[ix].v[i];
                                }
                            }
                            if (! dataExists) {
                                obj.value = 0;
                            }
                            arr.push(obj);
                        }

                        arr = MG.convert.date(arr, 'date');
                        dataset.push(arr);
                    } else {
                    // if more than one dimension use metaData gathered from the legend creation
                        for (var item=0; item<metaData.length; item++) {
                            var tmpArr = [];
                            startDate = moment(moment(this.results.rows[0].v[0]).format('YYYY-MM-DD'));
                            for (var currentDay = startDate; currentDay.isBefore(endDate); startDate.add('days', 1)) {
                                var date = currentDay.format('YYYY-MM-DD');
                                var dataExists = false;
                                var obj1 = {
                                    "date" : date
                                };
                                for (ix=0; ix<this.results.rows.length; ix++) {
                                    if (this.results.rows[ix].v[0] === date && (metaData[item].name == this.results.rows[ix].v[metaData[item].index])) {
                                        dataExists = true;
                                        obj1.value = this.results.rows[ix].v[dimCount + 1];
                                    }
                                }
                                if (! dataExists) {
                                    obj1.value = 0;
                                }
                                tmpArr.push(obj1);
                            }
                            arr = MG.convert.date(tmpArr, 'date');
                            dataset.push(arr);
                        }
                    }
                }
            }

            // set width
            this.configuration.width = $(this.renderTo).width();

            // set legend & data
            if (legend.length === 0) {
                this.configuration.chart_type = 'missing-data';
            } else {
                delete this.configuration.chart_type;
                this.configuration.legend = legend;
                this.configuration.data = dataset;
            }

            // empty timeseries div
            $(this.renderTo).empty();

            // reinitialize timeseries
            MG.data_graphic(this.configuration);
        },

        hide: function() {
            this.$el.hide();
        },

        show: function() {
            this.$el.show();
        },

        renderTemplate: function(done) {
            this.$el.html(this.template({
                reRunMessage: this.reRunMessage,
                done: done
            }));
        },

        render : function() {
            var status = this.model.get("status");
            var me = this;
            this.YearOverYear = this.config.get("YearOverYear");
            this.renderTemplate(false);

            if (status === "PENDING") {
                this.$el.html(this.template({"staleMessage" : this.staleMessage}));
                this.$el.find(".sq-loading").hide();
                this.$el.find("#stale").show();
            }
            if (status === "RUNNING") {
                this.$el.find(".sq-loading").show();
            }
            if (status === "DONE") {
                this.renderTemplate(true);
                // additional timeserie analysis views
                if (this.yearSwitcherView){
                    this.renderAdditionalView(this.yearSwitcherView, this.$el.find("#yearswitcher"));
                }

                this.$el.find("#stale").hide();
                this.$el.find(".sq-loading").hide();

                var data = this.getData();
                this.results = data.results;

                // render metric selector view
                var resultMetrics = [];
                if (this.results) {
                    for (i=0; i<this.results.cols.length; i++) {
                        resultMetrics.push(this.results.cols[i].id);
                    }
                }

                if (data.done && this.results && ! this.model.get("error")) {
                    this.renderGraphic();
                    this.renderAdditionalView(new squid_api.view.MetricSelectorView({
                        filterBy : resultMetrics,
                        buttonText : "<i class='fa fa-cog'></i>",
                        onChangeHandler: function() {
                            var metrics = this.$el.find("select").val();
                            if (! metrics) {
                                metrics = [];
                            }
                            me.renderGraphic(metrics);
                        }
                    }), this.$el.find("#metricselector"));
                } else {
                    if (this.model.get("error")) {
                        if (this.model.get("error").enableRerun) {
                            this.$el.find("#re-run").show();
                        } else {
                            this.$el.find("#error").html("<div id='error'>" + this.model.get("error").message + "</div>");
                        }
                    }
                }
            }
        },

        renderAdditionalView: function(view, element) {
            view.setElement(element);
            view.renderBase();
            view.render();
        }
    });

    return View;
}));
