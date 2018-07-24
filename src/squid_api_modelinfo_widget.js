(function (root, factory) {
    root.squid_api.view.ModelInfoView = factory(root.Backbone, root.squid_api, squid_api.template.squid_api_modelinfo_widget);

}(this, function (Backbone, squid_api, template) {

    var View = Backbone.View.extend({

        template: template,
        descriptionAvailable: false,
        popoverOptions: {
            placement: function (context, source) {
                var position = $(source).offset();

                if (position.left > 515) {
                    return "left";
                }

                if (position.left < 515) {
                    return "right";
                }

                if (position.top < 110){
                    return "bottom";
                }

                return "top";
            },
            html: true,
            container: 'body'
        },
        internalTemplate: null,

        initialize: function() {
            var me = this;
            this.config = squid_api.model.config;
            this.filters = squid_api.model.filters;
            this.status = squid_api.model.status;

            this.internalTemplate = squid_api.template.squid_api_modelinfo_internal_widget;

            this.config.on("change:bookmark", function() {
                me.descriptionAvailable = false;
            });
            this.config.on("change:domain", this.fetchMetrics, this);
            this.filters.on("change:selection", this.render, this);
            this.status.on("change:status", this.statusUpdate, this);
            this.status.on("change:configReady", this.statusUpdate, this);

            /* close popover when clicked outside */
            $('body').on('click', function (e) {
                me.$el.find("[data-toggle='popover']").each(function() {
                    //the 'is' for buttons that trigger popups
                    //the 'has' for icons within a button that triggers a popup
                    if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
                        $(this).popover('hide');
                    }
                });
            });
        },

        statusUpdate: function() {
            if (this.status.get("status") === "RUNNING" || this.status.get("configReady") === false) {
                this.$el.find("button").attr("disabled", true);
            } else {
                this.$el.find("button").attr("disabled", false);
            }
        },

        getMetrics: function() {
            var me = this;
            return squid_api.getCustomer().then(function(customer) {
                return customer.get("projects").load(me.config.get("project")).then(function(project) {
                    return project.get("domains").load(me.config.get("domain")).then(function(domain) {
                        return domain.get("metrics").load();
                    });
                });
            });
        },

        fetchMetrics: function() {
            var me = this;

            var domain = this.config.get("domain");

            var chosenMetrics = this.config.get("chosenMetrics") || [];
            var availableMetrics = this.config.get("availableMetrics") || [];

            if (domain) {
                // get domain dimensions & metrics
                $.when(this.getMetrics()).done(function ( metrics ) {
                    me.metrics = [];

                    // store metrics
                    for (var m=0; m<metrics.length; m++) {
                        var mId = metrics.at(m).get("oid");
                        if (chosenMetrics.indexOf(mId) > -1 || availableMetrics.indexOf(mId) > -1) {
                            me.metrics.push({
                                "name": metrics.at(m).get("name"),
                                "description": metrics.at(m).get("description")
                            });
                            if (metrics.at(m).get("description")) {
                                me.descriptionAvailable = true;
                            }
                        }
                    }
                    me.render();
                });
            }
        },

        getDimensions: function() {
            var me = this;
            return squid_api.getCustomer().then(function(customer) {
                return customer.get("projects").load(me.config.get("project")).then(function(project) {
                    return project.get("domains").load(me.config.get("domain")).then(function(domain) {
                        return domain.get("dimensions").load();
                    });
                });
            });
        },

        render: function() {
            var me = this;
            var domain = this.config.get("domain");
            var selection = this.filters.get("selection");

            var availableDimensions = this.config.get("availableDimensions") || [];
            var chosenDimensions = this.config.get("chosenDimensions") || [];

            if (domain) {
                if (selection) {
                    var facets = selection.facets;
                    if (facets) {
                        this.dimensions = [];
                        for (var f=0; f<facets.length; f++) {
                            var fId = facets[f].id;
                            if (chosenDimensions.indexOf(fId) > -1 || availableDimensions.indexOf(fId) > -1) {
                                this.dimensions.push({
                                    "name": facets[f].name,
                                    "description": facets[f].dimension.description
                                });
                                if (facets[f].dimension.description) {
                                    this.descriptionAvailable = true;
                                }
                            }
                        }

                        // sort dimensions
                        if (this.dimensions) {
                            this.dimensions.sort(function(a, b){
                                if(a.name.toLowerCase() < b.name.toLowerCase()) {
                                    return -1;
                                }
                                if(a.name.toLowerCase() > b.name.toLowerCase()) {
                                    return 1;
                                }
                                return 0;
                            });
                        }

                        // sort metrics
                        if (this.metrics) {
                            this.metrics.sort(function(a, b){
                                if(a.name.toLowerCase() < b.name.toLowerCase()) {
                                    return -1;
                                }
                                if(a.name.toLowerCase() > b.name.toLowerCase()) {
                                    return 1;
                                }
                                return 0;
                            });
                        }
                        
                        var jsonData = {
                            dimensions: this.dimensions,
                            metrics: this.metrics
                        };

                        if (me.descriptionAvailable) {
                            // print base template
                            this.$el.html(this.template());

                            // set popup html content
                            me.popoverOptions.content = me.internalTemplate(jsonData);

                            // initialize popover
                            me.$el.find("[data-toggle='popover']").popover(me.popoverOptions);

                            // remove max-width
                            me.$el.find("[data-toggle='popover']").on("show.bs.popover", function(){
                                me.$el.find("[data-toggle='popover']").data("bs.popover").tip().css({"max-width": "inherit"});
                            });
                            me.$el.find("[data-toggle='popover']").on("hidden.bs.popover", function(e){
                                // prevent clicking twice to open bootstrap popover
                            	var inStateClick = $(e.target).data("bs.popover");
                                if (inStateClick && inStateClick.inState && inStateClick.inState.click) {
                                	inStateClick.inState.click = false;
                                }
                            });
                        } else {
                            this.$el.empty();
                        }
                    }
                }
            }

            return this;
        }
    });

    return View;
}));
