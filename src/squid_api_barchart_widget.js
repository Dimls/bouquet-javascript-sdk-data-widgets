(function (root, factory) {
	root.squid_api.view.BarChartView = factory(root.Backbone, root.squid_api, squid_api.template.squid_api_barchart_widget);

}(this, function (Backbone, squid_api, template) {

	var View = Backbone.View.extend({
		template : null,

		format : null,

		d3Formatter : null,

		initialize: function(options) {
			var me = this;
			this.config = squid_api.model.config;

			if (this.model) {
				this.listenTo(this.model, 'change:status', this.render);
				this.listenTo(this.model, 'change:error', this.render);
				this.listenTo(this.model, 'change:disabled', this.toggleDisplay);
			}

			// setup options
			if (options.template) {
				this.template = options.template;
			} else {
				this.template = template;
			}

			if (d3) {
				this.d3Formatter = d3.format(",.0f");
			}
			if (options.format) {
				this.format = options.format;
			} else {
				// default number formatter
				if (this.d3Formatter) {
					this.format = function(f){
						if (isNaN(f)) {
							return f;
						} else {
							return me.d3Formatter(f);
						}
					};
				} else {
					this.format = function(f){
						return f;
					};
				}
			}
			$(window).on("resize", _.bind(this.resize(),this));
		},

		toggleDisplay: function() {
			if (this.model.get("disabled") || this.config.get("currentAnalysis") !== "barAnalysis") {
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
				this.resizing = window.setTimeout(_.bind(this.render,this), 100);
			};
		},

		setModel: function(model) {
			this.model = model;
			this.initialize();

		},

		barDataValues: function(cols, rows) {
			// Set up base object + arrays
			var barData = {
					series: [],
					values: [],
					labels: [],
					title: ""
			};


			barData.series.push("Current");
			// check to see if we only display totals
			var onlyMetrics = true;
			var hasCompare = false;
			for (i=0; i<cols.length; i++) {
				if (cols[i].role !== "DATA") {
					onlyMetrics = false;
					domainIndex = i;
				} else if (cols[i].extendedType.scale>0) {
					this.d3Formatter = d3.format(",.2f");
				}
				if (cols[i].originType === "COMPARETO") {
					hasCompare = true;
					barData.series.push("Compare");
					break;
				}
			}

			if (onlyMetrics) {
				barData.title = "KPIs";
			} else {
				barData.title = cols[1].name;
			}
			// store bar data
			for (i=0; i<rows.length; i++) {
				var row = rows[i].v;
				var yAxis1 = "";
				var xAxis1;
				for (ix=0; ix<row.length; ix++) {
					var item1 = row[ix];
					if (cols[ix].role === "DOMAIN" && item1) {
						if (yAxis1.length === 0) {
							yAxis1 += item1;
						} else {
							yAxis1 += " / " + item1;
						}
					} else if (cols[ix].role === "DATA" || item1 === null) {
						xAxis1 = item1;
						barData.values.push(item1);
						if (hasCompare) {
							barData.values.push(row[ix+1]);
						}
						if (onlyMetrics) {
							yAxis1 = cols[ix].name;
						}
						barData.labels.push(yAxis1);
						ix++;
					}

				}
			}
			return barData;
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

		remove: function() {
			this.undelegateEvents();
			this.$el.empty();
			this.stopListening();
			return this;
		},

		hide: function() {
			this.$el.hide();
		},

		show: function() {
			this.$el.show();
		},

		renderBase: function(done) {
			var isInCache = this.model.get("status") === "PENDING";
			this.$el.html(this.template({
				done: done,
				isInCache: isInCache
			}));
		},

		wrap: function(text, width) {

			text.each(function() {
				var text = d3.select(this),
				words = text.text().split(/\s+/).reverse(),
				word,
				line = [],
				lineNumber = 0,
				lineHeight = 1.1, // ems
				y = text.attr("y"),
				dy = parseFloat(text.attr("dy")),
				tspan = text.text(null).append("tspan").attr("x", text.x).attr("y", y).attr("dy", dy + "em");
				while (word = words.pop()) {
					if (lineNumber<2) {
						line.push(word);
						tspan.text(line.join(" "));
						if (tspan.node().getComputedTextLength() > width - 9) {
							line.pop();
							if (lineNumber === 1) {
								lineNumber++;
								line.push("...");
								tspan.text(line.join(" "));
							} else {
								tspan.text(line.join(" "));
								line = [word];
								tspan = text.append("tspan").attr("x", 0).attr("text-anchor", "left").attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
							}
						}
					}
				}
				if (lineNumber >= 1) {
					text.selectAll("tspan")
					.attr('dy', function(d, i) {
						return (-dy + (i * lineHeight)) + "em";
					});
				} 
			});
		},

		render: function() {
			var me = this;
			var data = this.getData();
			var status = this.model.get("status");
			var error = this.model.get("error");

			if (data.results && data.done && ! error) {

				//ToolTip Declaration
				var tooltip = d3.select('body').append('div')
				.classed("bar-chart-tooltip" ,true);
				// Print Template
				this.renderBase(true);

				// Obtain Bar Chart Data
				var data = this.barDataValues(data.results.cols, data.results.rows);

				// Pre definitions for the bar chart
				var chartWidth       = this.$el.find("#bar_chart").width(),
				barHeight        = 20,
				groupHeight      = barHeight * data.series.length,
				gapBetweenGroups = 10,
				spaceForLabels   = 250,
				spaceForAxis	 = 20
				spaceForTitle	 = 20;

				chartWidth = chartWidth - spaceForLabels;

				// Color scale
				var color = d3.scale.category20();
				var chartHeight = barHeight * data.values.length + gapBetweenGroups * data.labels.length;

				var x = d3.scale.linear()
				.domain([0, d3.max(data.values)])
				.range([0, chartWidth]);

				var y = d3.scale.ordinal()
				.domain(data.labels)
				.rangePoints([0, chartHeight]);

				var xAxis = d3.svg.axis()
				.scale(x)
				.tickFormat(d3.format("s"))
				.orient('bottom');

				var yAxis = d3.svg.axis()
				.scale(y)
				.ticks(10)
				.orient("left");

				// Specify the chart area and dimensions
				var chart = d3.select("#bar_chart")
				.append("svg")
				.attr("width", chartWidth)
				.attr("height", chartHeight + spaceForAxis + spaceForTitle)
				.attr("style", "overflow: visible;")
				.append("g")
				.attr("class", "chart")
				.attr("transform","translate(0,"+spaceForTitle+")");

				d3.select("svg")
				.append("text")
		        .attr("x", (spaceForLabels + chartWidth / 2))             
		        .attr("y", (14))
		        .attr("text-anchor", "middle")  
		        .style("font-size", "16px") 
		        .text(data.title)

				// Create bars
				var bar = chart.selectAll("g")
				.data(data.values)
				.enter().append("g")
				.attr("transform", function(d, i) {
					return "translate("+spaceForLabels+", " + (i * barHeight + gapBetweenGroups * (0.5 + Math.floor(i/data.series.length))) + ")";
				});

				// Create rectangles of the correct width
				bar.append("rect")
				.attr("fill", function(d,i) { return color(i % data.series.length); })
				.attr("class", "bar")
				.attr("width", x)
				.attr("height", barHeight - 1)
				.on('mouseover', function(d, i) {
					var tooltipText = "";
					var currentIdx = i -  i % data.series.length;
					for (t=0; t< data.series.length; t++) {
						tooltipText += "<div>" + data.series[t] + " : " + me.d3Formatter(data.values[currentIdx + t]) + "</div>";
					}
					tooltip.transition()
					.style('opacity', 1);
					tooltip.html(tooltipText)
					.style('left', (d3.event.pageX - 35) + 'px')
					.style('top',  (d3.event.pageY - (30 * data.series.length)) + 'px');
					tempColor = this.style.fill;
					d3.select(this)
					.style('opacity', 1)
					.style('fill', '#1aadcf');
				})
				.on('mouseout', function() {
					tooltip.html("");
					d3.select(this)
					.style('opacity', 1)
					.style('fill', tempColor);
				})
				.transition()
				// available callback options (to check)
				.attr('width', function(d) {
					return x(d);
				})
				.delay(function(d, i) {
					return i * 20;
				})
				.duration(1000)
				.ease('bounce')
				;

				// xAxis (Starting 200px from left)
				xAxis = d3.select("#bar_chart svg")
				.append("g")
				.attr('class', 'axis')
				.attr('width', chartWidth)
				.attr('x', 400)
				.attr('transform', 'translate('+spaceForLabels+', ' + (chartHeight - 1 + spaceForTitle) + ')')
				.call(xAxis);

				// yAxis (Starting 150px from right)
				var yAxisAppend = d3.select("#bar_chart svg")
				.append("g")
				.attr('class', 'axis')
				.attr('height', chartHeight)
				.attr('transform', 'translate('+spaceForLabels+','+spaceForTitle+')')
				.call(yAxis)
				;

				// Y aXis label spacing
				yAxisAppend.selectAll(".tick")
				.attr("transform", function(d, i) {
					var translation = (-1 + gapBetweenGroups/2 + barHeight/2*data.series.length + (i * (barHeight*data.series.length + gapBetweenGroups)));
					return "translate(0," + translation + ")";
				})
				.selectAll("text")
				.call(this.wrap, spaceForLabels)

				;
			} else {
				// Print Template
				this.renderBase(false);
			}
			if (status === "RUNNING") {
				this.$el.find("#sq-loading").show();
				this.$el.find("#re-run").hide();
			} else {
				this.$el.find("#sq-loading").hide();
			}

			return this;
		}

	});

	return View;
}));
