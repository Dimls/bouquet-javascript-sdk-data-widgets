(function (root, factory) {
    root.squid_api.view.BasicDisplayTypeSelectorView = factory(root.Backbone, root.squid_api, squid_api.template.squid_api_basic_displaytype_selector_widget);

}(this, function (Backbone, squid_api, template) {

    var View = Backbone.View.extend({

        template : null,
        config : null,
        tableView : null,
        barView : null,
        timeView : null,
        displayOnly : null,

        initialize: function(options) {

            if (options) {
                // setup options
                if (options.config) {
                    this.config = options.config;
                }

                // Store template
                if (options.template) {
                    this.template = options.template;
                } else {
                    this.template = template;
                }
                if (options.displayOnly) {
                    this.displayOnly = options.displayOnly;
                }

                this.tableView = options.tableView;
                this.barView = options.barView;
                this.timeView = options.timeView;
            }


            if (this.model) {
                this.listenTo(this.model,"change", this.render);
            }

            if (!this.config) {
                this.config = squid_api.model.config;
            }
            this.listenTo(this.config, "change:selection", this.render);
        },

        setModel: function(model) {
            this.model = model;
            this.initialize();
        },

        events: {
            "click li": "changeWidget",
            "click button":"openPopOver"
        },

        changeWidget: function(item){
            var viewName = item.currentTarget.dataset.content;
            var analysis;
            var currentAnalysis;

            // create the new view
            if (viewName === "tableView") {
                analysis = this.tableView.model;
                currentAnalysis = "tableAnalysis";
            } else if (viewName === "timeView") {
                analysis = this.timeView.model;
                currentAnalysis = "timeAnalysis";
            } else if (viewName === "barAnalysis") {
                analysis = this.barView.model;
                currentAnalysis = "barAnalysis";
            }

            this.config.set("currentAnalysis", currentAnalysis);
            this.model.set("currentAnalysis", analysis);
        },

        addCompatibleView : function(list, name) {
            // check it is available
            if (this[name]) {
                list.push(name);
            }
        },

        render: function() {
            var me = this;

            // compute the view types compatible with the model
            var selectedDimension = this.model.get("selectedDimension");
            var compatibleViews = [];

            this.addCompatibleView(compatibleViews, "tableView");
            this.addCompatibleView(compatibleViews, "timeView");
            this.addCompatibleView(compatibleViews, "barView");

            // compute the current selected view
            var analysis = this.model.get("currentAnalysis");
            var currentViewName;

            if (this.tableView) {
                if (analysis === this.tableView.model) {
                    currentViewName = "tableView";
                }
            }
            if (this.barView) {
                if (analysis === this.barView.model) {
                    currentViewName = "barView";
                }
            }
            if (this.timeView) {
                if (analysis === this.timeView.model) {
                    currentViewName = "timeView";
                }
            }

            // display the view selector
            var data = {"options" : []};
            for (idx2 = 0; idx2<compatibleViews.length; idx2++) {
                var view2 = compatibleViews[idx2];
                var icon;
                if (view2 === "tableView") {
                    icon = "fa-table";
                } else if (view2 === "timeView") {
                    icon = "fa-line-chart";
                } else if (view2 === "barView") {
                    icon = "fa-bar-chart";
                }
                var isActive = false;
                if (view2 === currentViewName) {
                    isActive = true;
                }
                data.options.push({"view" : view2, "icon" : icon, "isActive" : isActive});
            }

            this.$el.find("button").popover({
                content: this.template(data),
                html: true
            });

            return this;
        }
    });

    return View;

}));
