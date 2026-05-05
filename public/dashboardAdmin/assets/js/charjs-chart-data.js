(function () {
	"use strict";

	function syncAllChartsTheme() {
    const style = getComputedStyle(document.documentElement);
    const borderColor = style.getPropertyValue('--color-border-color').trim();
    const labelColor = style.getPropertyValue('--color-default').trim();

    allCharts.forEach(chartObj => {
        if (chartObj.type === 'chartjs') {
            const chart = chartObj.instance;
            
            // Update Scales
            Object.values(chart.options.scales).forEach(scale => {
                if (scale.ticks) scale.ticks.color = labelColor;
                if (scale.grid) scale.grid.color = borderColor;
                if (scale.border) scale.border.color = borderColor;
            });
            
            chart.update(); // Re-draw
        } 
        
        else if (chartObj.type === 'apex') {
            const chart = chartObj.instance;
            
            chart.updateOptions({
                xaxis: { labels: { style: { colors: labelColor } } },
                yaxis: { labels: { style: { colors: [labelColor] } } },
                grid: { borderColor: borderColor }
            });
        }
    });
}


	// Content Chart
	if (document.getElementById('content-chart')) {
		const ctx6 = document.getElementById('content-chart');
		new Chart(ctx6, {
			type: 'bar',
			data: {
				labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
				datasets: [{
					data: [12, 5, 6, 8, 5, 10, 8],
					backgroundColor: '#8723FF',
					borderWidth: 1,
					fill: true,
					borderRadius: {
						topLeft: 12,
						topRight: 12,
						bottomLeft: 12,
						bottomRight: 12
					},
					spacing: 10,
					borderSkipped: false,
				}, {
					data: [8, 6, 10, 5, 5, 5, 5],
					backgroundColor: '#AA7DFF',
					borderWidth: 1,
					fill: true,
					borderRadius: {
						topLeft: 12,
						topRight: 12,
						bottomLeft: 12,
						bottomRight: 12
					},
					spacing: 10,
					borderSkipped: false,
				}, {
					data: [10, 10, 5, 5, 5, 5, 5],
					backgroundColor: '#C5ACFF',
					borderWidth: 1,
					fill: true,
					spacing: 10,
					borderRadius: {
						topLeft: 12,
						topRight: 12,
						bottomLeft: 12,
						bottomRight: 12
					},
					borderSkipped: false,
				}, {
					data: [10, 8, 10, 5, 5, 5, 5],
					backgroundColor: '#DED1FF',
					borderWidth: 1,
					fill: true,
					borderRadius: {
						topLeft: 12,
						topRight: 12,
						bottomLeft: 12,
						bottomRight: 12
					},
					spacing: 10,
					borderSkipped: false,
				}, {
					data: [5, 6, 10, 5, 5, 5, 5],
					backgroundColor: '#EDE6FF',
					borderWidth: 1,
					fill: true,
					borderRadius: 12,
					spacing: 10,
					borderSkipped: false,
				}]
			},
			options: {
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false }
				},
				scales: {
					y: {
						stacked: true,
						min: 0,        // Start at 0
						max: 50,    // End at 50,000 
						border: {
							display: false
						},
						ticks: {
							stepSize: 10, // Intervals of 10,000
							font: { size: 11 },
							callback: function (value) {
								// Convert 10000 to 10k, 20000 to 20k, etc.
								return value === 0 ? 0 : (value / 1) + 'k';
							}
						}
					},
					x: {
						barPercentage: 0.5,
						stacked: true,
						grid: {
							display: false
						},
						ticks: {
							font: { size: 11 }
						}
					}
				}
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						// This makes the tooltip show "10,000" instead of "10"
						label: function (context) {
							let label = context.dataset.label || '';
							if (label) label += ': ';
							label += (context.parsed.y * 1000).toLocaleString();
							return label;
						}
					}
				}
			},
		});
	}

	// Agent Chart
	if (document.getElementById('agent-chart')) {

		const ctx = document.getElementById('agent-chart').getContext('2d');
		const mySemiDonutChart = new Chart(ctx, {
			type: 'doughnut', // Chart type
			data: {
				labels: ['Active', 'Idle', 'Training', 'Failed'],
				datasets: [{
					data: [40, 30, 20, 10],
					backgroundColor: ['#7A13F0', '#C5ACFF', '#DED1FF', '#EDE6FF'],
					borderWidth: 4,
					borderRadius: 15,
					borderColor: '#fff', // Border between segments
					hoverBorderWidth: 0,   // Border radius for curved edges
					cutout: '70%',
				}]
			},
			options: {
				rotation: -90,
				circumference: 360,
				layout: {
					padding: {
						top: -90,    // Set to 0 to remove top padding
						bottom: -20, // Set to 0 to remove bottom padding
					}
				},
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false // Hide the legend
					}
				},
			},
		});
	}

	// Cost Chart
	if (document.getElementById('cost-chart')) {
		const chartElement = document.getElementById('cost-chart');
		const ctx = chartElement.getContext('2d');

		new Chart(ctx, {
			type: 'bar',
			data: {
				labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
				datasets: [
					{
						type: 'line',
						label: 'API Usage',
						data: [300, 200, 210, 100, 200, 180, 250, 310, 150, 100, 200, 210],
						fill: false,
						borderColor: '#D97F06',
						borderWidth: 2,
						tension: 0.4,
						pointBackgroundColor: '#fff',
						pointBorderColor: '#fff',
						pointRadius: 6
					},
					{
						type: 'bar',
						label: 'Cost',
						data: [490, 290, 300, 200, 300, 270, 300, 500, 400, 200, 300, 260],
						borderRadius: 6,
						borderSkipped: false,
						backgroundColor: (context) => {
							const chart = context.chart;
							const { ctx, chartArea } = chart;

							if (!chartArea) return null;

							const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
							gradient.addColorStop(0, '#7A13F0');
							gradient.addColorStop(1, 'rgba(255,255,255,0)');
							return gradient;
						}
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,

				animation: {
					duration: 1000,
					easing: 'easeOutQuart',
					delay: (context) => {
						if (context.type === 'data') {
							return context.dataIndex * 60;
						}
						return 0;
					}
				},

				animations: {
					y: {
						from: 0
					},
					tension: {
						duration: 1200,
						easing: 'easeOutQuart',
						from: 0.6,
						to: 0.4
					}
				},

				plugins: {
					legend: {
						display: false
					}
				},

				scales: {
					y: {
						min: 0,
						max: 500,
						beginAtZero: true,
						ticks: {
							stepSize: 100,
							font: { size: 11 }
						},
						border: { display: false },
						grid: { color: '#f0f0f0' }
					},
					x: {
						grid: { display: false }
					}
				}
			}
		});
	}

	// Storage Chart
	if (document.getElementById('storage-chart')) {
		const chartElement = document.getElementById('storage-chart');
		const ctx = chartElement.getContext('2d');

		// 5. Initialize the chart
		new Chart(ctx, {
			// Changed type from 'bar' to 'line'
			type: 'line',
			data: {
				labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
				datasets: [
					{
						// Removed 'type: line' override from dataset since main type is now 'line'
						label: 'Storage',
						data: [30, 34, 50, 60, 56, 49, 60, 50, 40, 50, 40, 60],
						fill: true, // This enables the area fill
						backgroundColor: '#DED1FF', // Semi-transparent color for the fill
						borderColor: '#7A13F0',
						tension: 0,
						borderWidth: 2,
						pointRadius: 0,
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 0 // Removes any extra container padding
				},
				plugins: {
					legend: { display: false } // Hides the legend
				},
				scales: {
					y: {
						min: 0,
						max: 80,
						beginAtZero: true,
						border: { display: false },
						grid: { display: false }, // Hides horizontal lines
						ticks: {
							display: false // Hides Y-axis numerical data (0, 100)
						},
						display: false,
						offset: false
					},
					x: {
						grid: { display: false }, // Hides vertical lines
						ticks: {
							display: false // Hides X-axis labels (Jan, Feb, etc.)
						},
						display: false,
						offset: false
					}
				}
			},
		});
	}

	// 1. GLOBAL ARRAY (Outside functions so both can see it)
	window.activeCharts = [];

	// 2. Attach the refresh function to the window
  window.refreshChartThemes = function() {
    const style = getComputedStyle(document.documentElement);
    const newBorder = style.getPropertyValue('--color-border-color').trim();
    const newLabel = style.getPropertyValue('--color-default').trim();

    window.activeCharts.forEach(chart => {
      if (chart.options && chart.options.scales) {
        // Update all scales (X, Y, etc.)
        Object.values(chart.options.scales).forEach(scale => {
          if (scale.grid) scale.grid.color = newBorder;
          if (scale.ticks) scale.ticks.color = newLabel;
          if (scale.border) scale.border.color = newBorder;
        });
        chart.update('none'); // Update immediately
      }
    });
  };

	// 2. INITIALIZE FUNCTION (Run once on page load)
	function initCharts() {
		const style = getComputedStyle(document.documentElement);
		const myBorderColor = style.getPropertyValue('--color-border-color').trim();
		const labelColor = style.getPropertyValue('--color-default').trim();

		if (document.getElementById('chartBar1')) {
			const ctx1 = document.getElementById('chartBar1').getContext('2d');
			const chart1 = new Chart(ctx1, {
				type: 'bar',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
					datasets: [{
						label: 'Sales',
						data: [40, 50, 70, 50, 40, 60],
						backgroundColor: '#8723FF',					
						borderRadius: 10,
					}]
				},
				options: { // Root options started here
					maintainAspectRatio: false,
					responsive: true,
					plugins: {
						legend: {
							display: false
						}
					},
					scales: {
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
							},
							ticks: {
								color: labelColor,
								font: { size: 11 }
							}
						},
						y: {
							grid: {
								color: myBorderColor, 
							},
							beginAtZero: true,
							max: 80,
							ticks: {
								color: labelColor,
								font: { size: 10 }
							}
						}
					}
				} // End of options
			}); // Correctly closing the Chart constructor

			 window.activeCharts.push(chart1); 
		}		

		if (document.getElementById('chartBar2')) {
			const ctx2 = document.getElementById('chartBar2').getContext('2d');
			const chart2 = new Chart(ctx2, {
				type: 'bar',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
					datasets: [{
						label: 'Sales',
						data: [14, 12, 34, 25, 24, 20],
						backgroundColor: '#DED1FF',				
						borderRadius: 10,
					}]
				},
				options: {
					maintainAspectRatio: false,
					responsive: true,
					legend: {
						display: false,
						labels: {
							display: false
						}
					},
					scales: {
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
							},
							ticks: {
								color: labelColor,
								beginAtZero: true,
								font: { size: 11 } // ✅ Correct way to set font size in v4
							},
							barPercentage: 0.6 // ✅ Moved outside `ticks`
						},
						y: {
							grid: {
								color: myBorderColor, 
							},
							ticks: {
								color: labelColor,
								beginAtZero: true,
								font: { size: 10 }, // ✅ Correct font size format
								max: 80 // ✅ Sets max value for the Y-axis
							}
						}
					}
				}
			});
			window.activeCharts.push(chart2); 
		}		

		if (document.getElementById('chartBar3')) {
			const ctx3 = document.getElementById('chartBar3').getContext('2d');
			const gradient = ctx3.createLinearGradient(0, 0, 0, 250);
			gradient.addColorStop(0, '#7A13F0');
			gradient.addColorStop(1, '#DED1FF');

			const chart3 = new Chart(ctx3, {
				type: 'bar',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
					datasets: [{
						label: 'Sales',
						data: [14, 12, 34, 25, 24, 20],
						backgroundColor: gradient
					}]
				},
				options: { // Root options
					maintainAspectRatio: false,
					responsive: true,
					plugins: { // Legend goes here in v3+
						legend: {
							display: false
						}
					},
					scales: {
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
							},
							ticks: {
								color: labelColor,
								font: { size: 11 }
							},
							grid: { display: false }, // Common Preline UI style
							border: { display: false }
						},
						y: {
							grid: {
								color: myBorderColor, 
							},
							border: {
								color: myBorderColor, // Sets solid axis line
							},
							beginAtZero: true,
							max: 80,
							ticks: {
								color: labelColor,
								font: { size: 10 }
							}
						}
					}
				}
			}); // Fixed missing closure
			window.activeCharts.push(chart3); 
		}

		if (document.getElementById('chartBar4')) {

			const ctx4 = document.getElementById('chartBar4').getContext('2d');
			const chart4 = new Chart(ctx4, {
				type: 'bar',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
					datasets: [{
						label: 'Sales',
						data: [14, 12, 34, 25, 24, 20],					
						borderColor: '#AA7DFF',
						borderWidth: 2, 	
						backgroundColor: ['#EDE6FF']
					}]
				},
				options: {
					indexAxis: 'y',
					maintainAspectRatio: false,
					legend: {
						display: false,
						labels: {
							display: false
						}
					},
					scales: {
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								beginAtZero: true,
								color: labelColor,
								font: { size: 11 }
							}
						},
						y: {
							grid: {
								color: myBorderColor, 
							},
							ticks: {
								beginAtZero: true,
								color: labelColor,
								font: { size: 10 },
								max: 80
							}
						}
					}
				}
			});
			window.activeCharts.push(chart4); 
		}

		if (document.getElementById('chartBar5')) {
			const ctx5 = document.getElementById('chartBar5').getContext('2d');
			const chart5 = new Chart(ctx5, {
				type: 'bar',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
					datasets: [{
						label: 'Income',
						data: [14, 12, 34, 25, 24, 20],
						backgroundColor: [ '#99A1AF']
					}, {
						label: 'Expense',
						data: [22, 30, 25, 30, 20, 40],
						backgroundColor: '#8723FF'
					}]
				},
				options: {
					indexAxis: 'y',
					maintainAspectRatio: false,
					legend: {
						display: false,
						labels: {
							display: false
						}
					},
					scales: {
						y: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								beginAtZero: true,
								color: labelColor,
								font: { size: 11 }
							}
						},
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								beginAtZero: true,
								color: labelColor,
								font: { size: 11 },
								max: 80
							}
						}
					}
				}
			});
			window.activeCharts.push(chart5); 
		}

		if (document.getElementById('chartStacked1')) {
			const ctx6 = document.getElementById('chartStacked1');
			const chart6 = new Chart(ctx6, {
				type: 'bar',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
					datasets: [{
						label: 'Income',
						data: [14, 12, 34, 25, 24, 20],
						backgroundColor: '#8723FF',
						borderWidth: 1,
						fill: true
					}, {
						label: 'Expense',
						data: [14, 12, 34, 25, 24, 20],
						backgroundColor: '#D97F06',
						borderWidth: 1,
						fill: true
					}]
				},
				options: {
					maintainAspectRatio: false,
					scales: {
						y: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							stacked: true,
							beginAtZero: true,
							ticks: {
								color: labelColor,
								font: { size: 11 }
							}
						},
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							stacked: true,
							barPercentage: 0.5,
							ticks: {
								color: labelColor,
								font: { size: 11 }
							}
						}
					}
				}
			}); // Fixed missing closing bracket and parenthesis
			window.activeCharts.push(chart6); 
		}

		if (document.getElementById('chartStacked2')) {
			const ctx7 = document.getElementById('chartStacked2');
			const chart7 = new Chart(ctx7, {
				type: 'bar',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
					datasets: [{
						label: 'Sales',
						data: [14, 12, 34, 25, 24, 20],
						backgroundColor: '#2FD896',
						borderWidth: 1,
						fill: true
					}, {
						label: 'Revenue',
						data: [14, 12, 34, 25, 24, 20],
						backgroundColor:  '#51A2FF',
						borderWidth: 1,
						fill: true
					}]
				},
				options: {
					indexAxis: 'y',
					maintainAspectRatio: false,
					legend: {
						display: false,
						labels: {
							display: false
						}
					},
					scales: {
						y: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							stacked: true,
							ticks: {
								color: labelColor,
								beginAtZero: true,
								font: { size: 10 },
								max: 80
							}
						},
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							stacked: true,
							ticks: {
								color: labelColor,
								beginAtZero: true,
								font: { size: 11 }
							}
						}
					}
				}
			});
			window.activeCharts.push(chart7); 
		}

		if (document.getElementById('chartLine1')) {
			const ctx8 = document.getElementById('chartLine1');
			const chart8 = new Chart(ctx8, {
				type: 'line',
				data: {
					labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
					datasets: [{
						label: 'Sales',
						data: [14, 12, 34, 25, 44, 36, 35, 25, 30, 32, 20, 25 ],
						borderColor: '#7008E7',
						borderWidth: 1,
						fill: false
					}, {
						label: 'Revenue',
						data: [35, 30, 45, 35, 55, 40, 10, 20, 25, 55, 50, 45],
						borderColor: '#D97F06',
						borderWidth: 1,
						fill: false
					}]
				},
				options: {
					maintainAspectRatio: false,
					legend: {
						display: false,
						labels: {
							display: false
						}
					},
					scales: {
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								color: labelColor,
							},
						},
						y: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								color: labelColor,
								beginAtZero: true,
								font: { size: 12 },
								max: 80
							}
						},
					}
				}
			});
			window.activeCharts.push(chart8); 
		}

		if (document.getElementById('chartRadar')) {
			const scatterData = {
				datasets: [{
				label: 'Appointment',   // ✅ FIXED (no undefined)
				data: [
					{ x: 10, y: 0 },
					{ x: 0, y: 5 },
					{ x: 15, y: 10 },
					{ x: 4, y: 5 }
				],
				backgroundColor: '#7A13F0'
				}, 
			{
				label: 'Completed',   // ✅ FIXED (no undefined)
				data: [
					{ x: 10, y: 10 },
					{ x: 0, y: 10 },
					{ x: 15, y: 15 },
					{ x: 4, y: 10 }
				],
				backgroundColor: '#009966'
				}]
			};

			const chart9 = new Chart(document.getElementById('chartRadar'), {
				type: 'scatter',
				data: scatterData,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: true
						}
					},
					scales: {
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								color: labelColor,
							},
							type: 'linear',
							position: 'bottom',
						},					
						y: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								color: labelColor,
							},
						},
					}
				}
			});
			window.activeCharts.push(chart9); 
		}

		if (document.getElementById('chartLine')) {
			const style = getComputedStyle(document.documentElement);
			const myBorderColor = style.getPropertyValue('--color-border-color').trim();
			const labelColor = getComputedStyle(document.documentElement).getPropertyValue('--color-default').trim();
			const lineData = {
				labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
				datasets: [
				{
					label: 'Income',   // ✅ FIXED
					data: [14,12,34,25,44,36,35,25,30,32,20,25],
					borderColor: '#8723FF',
					backgroundColor: 'rgba(135, 35, 255, 0.3)',
					tension: 0.4,
					fill: true
				},
				{
					label: 'Expense',  // ✅ FIXED
					data: [35,30,45,35,55,40,10,20,25,65,50,45],
					borderColor: '#D97F06',
					backgroundColor: 'rgba(217, 127, 6, 0.3)',
					tension: 0.4,
					fill: true
				}
				]
			};
			const chart10 = new Chart(document.getElementById('chartLine'), {
				type: 'line',
				data: lineData,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: true,
							position: 'top'
						}
					},
					scales: {
						x: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								color: labelColor,
							},
						},
						y: {
							grid: {
								color: myBorderColor, // NO BRACKETS []
							},
							border: {
								color: myBorderColor, // Sets solid axis line
								width: 1
							},
							ticks: {
								color: labelColor,
							},
							beginAtZero: true
						}
					}
				}
			});
			window.activeCharts.push(chart10); 
		}

	}

	document.addEventListener('DOMContentLoaded', function () {
		initCharts();
	});


	if (document.getElementById('chartPie')) {

		const datapie = {
			labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
			datasets: [{
			data: [35, 20, 8, 15, 24],
			backgroundColor: ['#9148FF', '#0ABF7F', '#F5A70D', '#F6339A', '#00BBA7' ],
			borderWidth: 2
			}]
		};

		const optionpie = {
			responsive: true,
			maintainAspectRatio: false,
			cutout: '60%',   // 👈 doughnut thickness (THIS makes it like image)

			plugins: {
				legend: {
					display: true,
					position: 'top',
					labels: {
						boxWidth: 30,
						padding: 15
					}
				}
			},

			animation: {
				animateScale: true,
				animateRotate: true
			}
		};

		const ctx6 = document.getElementById('chartPie');
		new Chart(ctx6, {
			type: 'doughnut',
			data: datapie,
			options: optionpie
		});
	}

	if (document.getElementById('chartDonut')) {

		const datapie = {
			labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
			datasets: [{
			data: [35, 20, 8, 15, 24],
			backgroundColor: ['#9148FF', '#0ABF7F', '#F5A70D', '#F6339A', '#00BBA7' ],
			borderWidth: 2
			}]
		};

		const optionpie = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: true,
					position: 'bottom'
				}
			},
			animation: {
				animateScale: true,
				animateRotate: true
			}
		};

		new Chart(document.getElementById('chartDonut'), {
			type: 'pie',
			data: datapie,
			options: optionpie
		});
	}

	// Recruitment chart
	window.addEventListener('DOMContentLoaded', (event) => {
		const canvas = document.querySelector('canvas#recruitment');

		if (canvas && typeof canvas.getContext === 'function') {
			const ctx = canvas.getContext('2d');

			const totalSegments = 25;
			const filledSegments = 10;
			const data = Array(totalSegments).fill(1);

			const colors = data.map((_, i) =>
				i < filledSegments ? '#5711F6' : '#F3F4F6'
			);

			new Chart(ctx, {
				type: 'doughnut',
				data: {
					datasets: [{
						data: data,
						backgroundColor: colors,
						borderWidth: 0,
						borderRadius: 12,
						spacing: 60,
						cutout: '60%'
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: true, // Changed to true to respect the aspect ratio
					aspectRatio: 2,           // Since it's a half-circle, a 2:1 ratio prevents extra height
					rotation: -110,
					circumference: 220,
					layout: {
						padding: {
							bottom: 0        // Removes extra padding at the bottom
						}
					},
					plugins: {
						legend: { display: false },
						tooltip: { enabled: false }
					}
				}
			});
		}
	});

	// Performance Chart
	if (document.getElementById('performance-chart')) {
		const chartElement = document.getElementById('performance-chart');
		const ctx = chartElement.getContext('2d');

		new Chart(ctx, {
			type: 'line',
			data: {
				labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
				datasets: [
					{
						// Removed 'type: line' override from dataset since main type is now 'line'
						label: 'Inference',
						data: [18, 20, 22, 20, 20, 22, 25, 28, 25, 28, 25, 28],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#AB62FF'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					},
					{
						label: 'Accuracy',
						data: [28, 30, 32, 30, 30, 32, 35, 38, 35, 38, 35, 38],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#009966'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 0 // Removes any extra container padding
				},
				interaction: {
					mode: 'index', // or 'nearest'
					intersect: false // Allows the tooltip to show without intersecting the exact point
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true // Ensure it's explicitly enabled
					}
				},
				scales: {
					y: {
						min: 0,
						max: 80,
						beginAtZero: true,
						border: { display: false },
						grid: { display: false }, // Hides horizontal lines
						ticks: {
							stepSize: 20, // Intervals of 10,000
							font: { size: 11 },
							callback: function (value) {
								// Convert 10000 to 10k, 20000 to 20k, etc.
								return value === 0 ? 0 : (value / 10) + 'k';
							}
						},
						offset: false
					},
					x: {
						grid: { display: true }, // Hides vertical lines
						offset: false
					}
				}
			},
		});
	}

	// Performance Chart
	if (document.getElementById('performance-week-chart')) {
		const chartElement = document.getElementById('performance-week-chart');
		const ctx = chartElement.getContext('2d');

		new Chart(ctx, {
			type: 'line',
			data: {
				labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
				datasets: [
					{
						// Removed 'type: line' override from dataset since main type is now 'line'
						label: 'Inference',
						data: [18, 20, 20, 22, 25, 28, 28],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#AB62FF'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					},
					{
						label: 'Accuracy',
						data: [28, 30, 32, 35, 38, 35, 38],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#009966'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 0 // Removes any extra container padding
				},
				interaction: {
					mode: 'index', // or 'nearest'
					intersect: false // Allows the tooltip to show without intersecting the exact point
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true // Ensure it's explicitly enabled
					}
				},
				scales: {
					y: {
						min: 0,
						max: 80,
						beginAtZero: true,
						border: { display: false },
						grid: { display: false }, // Hides horizontal lines
						ticks: {
							stepSize: 20, // Intervals of 10,000
							font: { size: 11 },
							callback: function (value) {
								// Convert 10000 to 10k, 20000 to 20k, etc.
								return value === 0 ? 0 : (value / 10) + 'k';
							}
						},
						offset: false
					},
					x: {
						grid: { display: true }, // Hides vertical lines
						offset: false
					}
				}
			},
		});
	}

	// Performance Chart
	if (document.getElementById('performance-month-chart')) {
		const chartElement = document.getElementById('performance-month-chart');
		const ctx = chartElement.getContext('2d');

		new Chart(ctx, {
			type: 'line',
			data: {
				labels: ['Week1', 'Week2', 'Week3', 'Week4', 'Week5'],
				datasets: [
					{
						// Removed 'type: line' override from dataset since main type is now 'line'
						label: 'Inference',
						data: [28, 25, 28, 25, 28],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#AB62FF'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					},
					{
						label: 'Accuracy',
						data: [38, 35, 38, 35, 38],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#009966'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 0 // Removes any extra container padding
				},
				interaction: {
					mode: 'index', // or 'nearest'
					intersect: false // Allows the tooltip to show without intersecting the exact point
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true // Ensure it's explicitly enabled
					}
				},
				scales: {
					y: {
						min: 0,
						max: 80,
						beginAtZero: true,
						border: { display: false },
						grid: { display: false }, // Hides horizontal lines
						ticks: {
							stepSize: 20, // Intervals of 10,000
							font: { size: 11 },
							callback: function (value) {
								// Convert 10000 to 10k, 20000 to 20k, etc.
								return value === 0 ? 0 : (value / 10) + 'k';
							}
						},
						offset: false
					},
					x: {
						grid: { display: true }, // Hides vertical lines
						offset: false
					}
				}
			},
		});
	}

	// Performance Chart
	if (document.getElementById('performance-day-chart')) {
		const chartElement = document.getElementById('performance-day-chart');
		const ctx = chartElement.getContext('2d');

		new Chart(ctx, {
			type: 'line',
			data: {
				labels: ['2:00', '6:00', '10:00', '14:00', '18:00', '20:00', '24:00'],
				datasets: [
					{
						// Removed 'type: line' override from dataset since main type is now 'line'
						label: 'Inference',
						data: [20, 20, 22, 25, 28, 25, 28],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#AB62FF'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					},
					{
						label: 'Accuracy',
						data: [30, 30, 32, 35, 38, 35, 38],
						fill: true, // This enables the area fill
						backgroundColor: (context) => {
							const { ctx, chartArea } = context.chart;
							if (!chartArea) return null;

							// Horizontal gradient: left to right (90deg)
							const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
							gradient.addColorStop(0, '#009966'); // 0% Start
							gradient.addColorStop(1, '#FFFFFF'); // 100% End
							return gradient;
						},
						tension: 0,
						borderWidth: 0,
						pointRadius: 0,
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 0 // Removes any extra container padding
				},
				interaction: {
					mode: 'index', // or 'nearest'
					intersect: false // Allows the tooltip to show without intersecting the exact point
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true // Ensure it's explicitly enabled
					}
				},
				scales: {
					y: {
						min: 0,
						max: 80,
						beginAtZero: true,
						border: { display: false },
						grid: { display: false }, // Hides horizontal lines
						ticks: {
							stepSize: 20, // Intervals of 10,000
							font: { size: 11 },
							callback: function (value) {
								// Convert 10000 to 10k, 20000 to 20k, etc.
								return value === 0 ? 0 : (value / 10) + 'k';
							}
						},
						offset: false
					},
					x: {
						grid: { display: true }, // Hides vertical lines
						offset: false
					}
				}
			},
		});
	}

	// Health Chart
	if (document.getElementById('health-chart')) {
		const chartElement = document.getElementById('health-chart');
		const ctx = chartElement.getContext('2d');

		// 5. Initialize the chart
		new Chart(ctx, {
			// Changed type from 'bar' to 'line'
			type: 'line',
			data: {
				labels: ['01', '05', '08', '10', '12', '15', '18', '20', '22', '25', '28', '30'],
				datasets: [
					{
						// Removed 'type: line' override from dataset since main type is now 'line'
						label: 'Storage',
						data: [28, 32, 30, 35, 34, 40, 50, 50, 40, 30, 40, 55],
						fill: true, // This enables the area fill
						backgroundColor: '#A4F6CE', // Semi-transparent color for the fill
						borderColor: '#009966',
						tension: 0,
						borderWidth: 2,
						pointRadius: 0,
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 0 // Removes any extra container padding
				},
				plugins: {
					legend: { display: false } // Hides the legend
				},
				scales: {
					y: {
						min: 0,
						max: 60,
						beginAtZero: true,
						border: { display: false },
						grid: { display: false }, // Hides horizontal lines
						ticks: {
							display: false // Hides Y-axis numerical data (0, 100)
						},
						display: false,
						offset: false
					},
					x: {
						grid: { display: false }, // Hides vertical lines
						ticks: {
							display: false // Hides X-axis labels (Jan, Feb, etc.)
						},
						display: false,
						offset: false
					}
				}
			},
		});
	}

	// Video Progress
	if (document.getElementById('progressChart')) {
		const chartElement = document.getElementById('progressChart');

		// Function to generate data points and their colors
		function generateChartData(totalDots, percentageCompleted) {
			const dataPoints = [];
			const colors = [];
			const completedColor = '#7A13F0'; // The purple from the image
			const incompleteColor = '#E5E7EB'; // The grey from the image
			// Calculate completed dots: (Percentage / 100) * Total Dots, rounded to the nearest integer
			const completedDots = Math.round((percentageCompleted / 100) * totalDots);

			for (let i = 0; i < totalDots; i++) {
				// We use an arbitrary y-value (e.g., 1) to place all dots on the same horizontal line
				dataPoints.push({ x: i + 1, y: 1 });
				colors.push(i < completedDots ? completedColor : incompleteColor);
			}
			return { points: dataPoints, colors: colors };
		}

		// Initial data: 15 total dots, 95% completed
		let progressData = generateChartData(15, 95);

		const ctx = document.getElementById('progressChart').getContext('2d');
		const progressChart = new Chart(ctx, {
			type: 'scatter', // Use scatter type
			data: {
				datasets: [{
					data: progressData.points,
					backgroundColor: progressData.colors,
					pointRadius: 6, // Adjust size of dots
					pointHoverRadius: 6,
					showLine: false, // Explicitly hide lines connecting points
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false // Hide legend
					},
					tooltip: {
						enabled: false // Hide tooltips on hover
					}
				},
				scales: {
					x: {
						display: false, // Hide x-axis
						min: 0.7,
						max: 15.3
					},
					y: {
						display: false, // Hide y-axis
						min: 0.95,
						max: 1.05
					}
				},
				layout: {
					padding: 0, // Ensure all padding is zero
					autoPadding: false
				}
			}
		});

		// Function to update the chart's progress
		function updateProgress(newCompletedCount) {
			const totalDots = 15; // Keep this consistent
			const newData = generateChartData(totalDots, newCompletedCount);

			progressChart.data.datasets[0].data = newData.points;
			progressChart.data.datasets[0].backgroundColor = newData.colors;
			progressChart.update(); // Re-render the chart with new colors
		}
	}

	// Audio Progress
	if (document.getElementById('audio-progress')) {
		const chartElement = document.getElementById('audio-progress');

		// Function to generate data points and their colors
		function generateChartData(totalDots, percentageCompleted) {
			const dataPoints = [];
			const colors = [];
			const completedColor = '#7A13F0'; // The purple from the image
			const incompleteColor = '#E5E7EB'; // The grey from the image
			// Calculate completed dots: (Percentage / 100) * Total Dots, rounded to the nearest integer
			const completedDots = Math.round((percentageCompleted / 100) * totalDots);

			for (let i = 0; i < totalDots; i++) {
				// We use an arbitrary y-value (e.g., 1) to place all dots on the same horizontal line
				dataPoints.push({ x: i + 1, y: 1 });
				colors.push(i < completedDots ? completedColor : incompleteColor);
			}
			return { points: dataPoints, colors: colors };
		}

		// Initial data: 15 total dots, 95% completed
		let progressData = generateChartData(15, 80);

		const ctx = document.getElementById('audio-progress').getContext('2d');
		const progressChart = new Chart(ctx, {
			type: 'scatter', // Use scatter type
			data: {
				datasets: [{
					data: progressData.points,
					backgroundColor: progressData.colors,
					pointRadius: 6, // Adjust size of dots
					pointHoverRadius: 6,
					showLine: false, // Explicitly hide lines connecting points
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false // Hide legend
					},
					tooltip: {
						enabled: false // Hide tooltips on hover
					}
				},
				scales: {
					x: {
						display: false, // Hide x-axis
						min: 0.7,
						max: 15.3
					},
					y: {
						display: false, // Hide y-axis
						min: 0.95,
						max: 1.05
					}
				},
				layout: {
					padding: 0, // Ensure all padding is zero
					autoPadding: false
				}
			}
		});

		// Function to update the chart's progress
		function updateProgress(newCompletedCount) {
			const totalDots = 15; // Keep this consistent
			const newData = generateChartData(totalDots, newCompletedCount);

			progressChart.data.datasets[0].data = newData.points;
			progressChart.data.datasets[0].backgroundColor = newData.colors;
			progressChart.update(); // Re-render the chart with new colors
		}
	}

	// Text Progress
	if (document.getElementById('text-progress')) {
		const chartElement = document.getElementById('text-progress');

		// Function to generate data points and their colors
		function generateChartData(totalDots, percentageCompleted) {
			const dataPoints = [];
			const colors = [];
			const completedColor = '#7A13F0'; // The purple from the image
			const incompleteColor = '#E5E7EB'; // The grey from the image
			// Calculate completed dots: (Percentage / 100) * Total Dots, rounded to the nearest integer
			const completedDots = Math.round((percentageCompleted / 100) * totalDots);

			for (let i = 0; i < totalDots; i++) {
				// We use an arbitrary y-value (e.g., 1) to place all dots on the same horizontal line
				dataPoints.push({ x: i + 1, y: 1 });
				colors.push(i < completedDots ? completedColor : incompleteColor);
			}
			return { points: dataPoints, colors: colors };
		}

		// Initial data: 15 total dots, 95% completed
		let progressData = generateChartData(15, 60);

		const ctx = document.getElementById('text-progress').getContext('2d');
		const progressChart = new Chart(ctx, {
			type: 'scatter', // Use scatter type
			data: {
				datasets: [{
					data: progressData.points,
					backgroundColor: progressData.colors,
					pointRadius: 6, // Adjust size of dots
					pointHoverRadius: 6,
					showLine: false, // Explicitly hide lines connecting points
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false // Hide legend
					},
					tooltip: {
						enabled: false // Hide tooltips on hover
					}
				},
				scales: {
					x: {
						display: false, // Hide x-axis
						min: 0.7,
						max: 15.3
					},
					y: {
						display: false, // Hide y-axis
						min: 0.95,
						max: 1.05
					}
				},
				layout: {
					padding: 0, // Ensure all padding is zero
					autoPadding: false
				}
			}
		});

		// Function to update the chart's progress
		function updateProgress(newCompletedCount) {
			const totalDots = 15; // Keep this consistent
			const newData = generateChartData(totalDots, newCompletedCount);

			progressChart.data.datasets[0].data = newData.points;
			progressChart.data.datasets[0].backgroundColor = newData.colors;
			progressChart.update(); // Re-render the chart with new colors
		}
	}

	// Voice Progress
	if (document.getElementById('voice-progress')) {
		const chartElement = document.getElementById('voice-progress');

		// Function to generate data points and their colors
		function generateChartData(totalDots, percentageCompleted) {
			const dataPoints = [];
			const colors = [];
			const completedColor = '#7A13F0'; // The purple from the image
			const incompleteColor = '#E5E7EB'; // The grey from the image
			// Calculate completed dots: (Percentage / 100) * Total Dots, rounded to the nearest integer
			const completedDots = Math.round((percentageCompleted / 100) * totalDots);

			for (let i = 0; i < totalDots; i++) {
				// We use an arbitrary y-value (e.g., 1) to place all dots on the same horizontal line
				dataPoints.push({ x: i + 1, y: 1 });
				colors.push(i < completedDots ? completedColor : incompleteColor);
			}
			return { points: dataPoints, colors: colors };
		}

		// Initial data: 15 total dots, 95% completed
		let progressData = generateChartData(15, 25);

		const ctx = document.getElementById('voice-progress').getContext('2d');
		const progressChart = new Chart(ctx, {
			type: 'scatter', // Use scatter type
			data: {
				datasets: [{
					data: progressData.points,
					backgroundColor: progressData.colors,
					pointRadius: 6, // Adjust size of dots
					pointHoverRadius: 6,
					showLine: false, // Explicitly hide lines connecting points
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false // Hide legend
					},
					tooltip: {
						enabled: false // Hide tooltips on hover
					}
				},
				scales: {
					x: {
						display: false, // Hide x-axis
						min: 0.7,
						max: 15.3
					},
					y: {
						display: false, // Hide y-axis
						min: 0.95,
						max: 1.05
					}
				},
				layout: {
					padding: 0, // Ensure all padding is zero
					autoPadding: false
				}
			}
		});

		// Function to update the chart's progress
		function updateProgress(newCompletedCount) {
			const totalDots = 15; // Keep this consistent
			const newData = generateChartData(totalDots, newCompletedCount);

			progressChart.data.datasets[0].data = newData.points;
			progressChart.data.datasets[0].backgroundColor = newData.colors;
			progressChart.update(); // Re-render the chart with new colors
		}
	}

	// Image Progress
	if (document.getElementById('image-progress')) {
		const chartElement = document.getElementById('image-progress');

		// Function to generate data points and their colors
		function generateChartData(totalDots, percentageCompleted) {
			const dataPoints = [];
			const colors = [];
			const completedColor = '#7A13F0'; // The purple from the image
			const incompleteColor = '#E5E7EB'; // The grey from the image
			// Calculate completed dots: (Percentage / 100) * Total Dots, rounded to the nearest integer
			const completedDots = Math.round((percentageCompleted / 100) * totalDots);

			for (let i = 0; i < totalDots; i++) {
				// We use an arbitrary y-value (e.g., 1) to place all dots on the same horizontal line
				dataPoints.push({ x: i + 1, y: 1 });
				colors.push(i < completedDots ? completedColor : incompleteColor);
			}
			return { points: dataPoints, colors: colors };
		}

		// Initial data: 15 total dots, 95% completed
		let progressData = generateChartData(15, 95);

		const ctx = document.getElementById('image-progress').getContext('2d');
		const progressChart = new Chart(ctx, {
			type: 'scatter', // Use scatter type
			data: {
				datasets: [{
					data: progressData.points,
					backgroundColor: progressData.colors,
					pointRadius: 6, // Adjust size of dots
					pointHoverRadius: 6,
					showLine: false, // Explicitly hide lines connecting points
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false // Hide legend
					},
					tooltip: {
						enabled: false // Hide tooltips on hover
					}
				},
				scales: {
					x: {
						display: false, // Hide x-axis
						min: 0.7,
						max: 15.3
					},
					y: {
						display: false, // Hide y-axis
						min: 0.95,
						max: 1.05
					}
				},
				layout: {
					padding: 0, // Ensure all padding is zero
					autoPadding: false
				}
			}
		});

		// Function to update the chart's progress
		function updateProgress(newCompletedCount) {
			const totalDots = 15; // Keep this consistent
			const newData = generateChartData(totalDots, newCompletedCount);

			progressChart.data.datasets[0].data = newData.points;
			progressChart.data.datasets[0].backgroundColor = newData.colors;
			progressChart.update(); // Re-render the chart with new colors
		}
	}

	// Resource Chart
	if (document.getElementById('resource-chart')) {
		const chartElement = document.getElementById('resource-chart');
		const ctx = chartElement.getContext('2d');

		new Chart(ctx, {
			type: 'line',
			data: {
				labels: ['0:00', '2:00', '4:00', '6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
				datasets: [
					{
						// Removed 'type: line' override from dataset since main type is now 'line'
						label: 'GPU',
						data: [10, 15, 10, 13, 18, 8, 10, 20, 15, 28, 25, 18],
						fill: true, // This enables the area fill
						backgroundColor: '#FFEDD4', // Semi-transparent color for the fill
						borderColor: '#F54900',
						tension: 0.4,
						borderWidth: 1,
						pointRadius: 0,
					},
					{
						label: 'Memory',
						data: [15, 20, 22, 30, 28, 40, 50, 45, 60, 32, 50, 40],
						fill: true, // This enables the area fill
						backgroundColor: '#D0FBE4', // Semi-transparent color for the fill
						borderColor: '#009966',
						tension: 0.4,
						borderWidth: 1,
						pointRadius: 0,
					},
					{
						label: 'CPU',
						data: [23, 30, 26, 35, 38, 50, 65, 75, 70, 60, 75, 80],
						fill: true, // This enables the area fill
						backgroundColor: '#EDE6FF', // Semi-transparent color for the fill
						borderColor: '#7A13F0',
						tension: 0.4,
						borderWidth: 1,
						pointRadius: 0,
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 0 // Removes any extra container padding
				},
				interaction: {
					mode: 'index', // or 'nearest'
					intersect: false // Allows the tooltip to show without intersecting the exact point
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true // Ensure it's explicitly enabled
					}
				},
				scales: {
					y: {
						min: 0,
						max: 100,
						beginAtZero: true,
						border: { display: false },
						grid: { display: false }, // Hides horizontal lines
						ticks: {
							stepSize: 20, // Intervals of 10,000
							font: { size: 11 },
						},
						offset: false
					},
					x: {
						grid: { display: true }, // Hides vertical lines
						offset: false
					}
				}
			},
		});
	}

	if (document.getElementById('traffic-chart')) {
		const ctx = document.getElementById('traffic-chart').getContext('2d');

		new Chart(ctx, {
			type: 'bar',
			data: {
				labels: ['Progress Overview'],
				datasets: [{
					label: 'Upload Percentage',
					data: [50],
					backgroundColor: '#7A13F0', // The deep purple color
					stack: 'Stack 0', // All datasets in the same stack form one bar
					borderRadius: {
						topLeft: 8,
						bottomLeft: 8,
						topRight: 0,
						bottomRight: 0
					},
					borderSkipped: false,
				}, {
					label: 'Download Percentage',
					data: [35],
					backgroundColor: '#C5ACFF', // The lighter purple color
					stack: 'Stack 0',
				}, {
					label: 'Ideal Time',
					data: [15],
					backgroundColor: '#DED1FF', // The lightest purple color
					stack: 'Stack 0',
				}]
			},
			options: {
				indexAxis: 'y', // Set the chart to horizontal
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						stacked: true, // Enable stacking on the X-axis
						max: 100, // Ensure the bar goes up to 100%
						display: false, // Hide the X-axis labels
					},
					y: {
						stacked: true, // Enable stacking on the Y-axis
						display: false, // Hide the Y-axis labels
					}
				},
				plugins: {
					legend: {
						display: false, // Hide the legend as per the image
					},
					tooltip: {
						// Optional: Customize tooltips to show percentage values
						callbacks: {
							label: function (context) {
								let label = context.dataset.label || '';
								if (label) {
									label += ': ';
								}
								if (context.parsed.x !== null) {
									label += context.parsed.x + '%';
								}
								return label;
							}
						}
					},
				},
				elements: {
					bar: {
						// Optional: Add border radius and thickness as seen in the image
						borderRadius: 8,
						borderWidth: 0,
					}
				}
			}
		});

	}

	// Storage Chart
	window.addEventListener('DOMContentLoaded', (event) => {
		const canvas = document.querySelector('canvas#storage-request');
		// Custom Plugin to draw the gauge pointer (arrow)
		const gaugePointer = {
			id: 'gaugePointer',
			afterDatasetsDraw(chart, args, options) {
				const { ctx, chartArea: { width, height }, data, options: chartOptions } = chart;
				ctx.save();

				// Configuration from your chart options/data
				const totalSegments = 25;
				const percentage = 50; // The desired percentage value
				// Calculate the number of filled segments and round to the nearest whole number
				const filledSegments = Math.round((percentage / 100) * totalSegments);

				const rotation = chartOptions.rotation;
				const circumference = chartOptions.circumference;

				// Access cutout directly from the first dataset definition
				const cutout = parseFloat(chart.data.datasets.cutout) / 100;

				// Calculate the angle for the pointer
				const startAngle = (rotation * Math.PI) / 180;
				const sweepAngle = (circumference * Math.PI) / 180;

				// The pointer should be at the end of the filled segments
				const endAngleForPointer = startAngle + (sweepAngle / totalSegments) * filledSegments;

				// Calculate the center of the chart
				const centerX = width / 2;
				const centerY = height / 2;

				// Calculate the radius for the pointer positioning
				const outerRadius = chart.getDatasetMeta(0).data[0].outerRadius; // Use the outer radius
				// Position it just outside the outer ring (e.g., +5px buffer)
				const pointerRadius = outerRadius + 5;

				// Calculate pointer tip coordinates
				const tipX = centerX + Math.cos(endAngleForPointer) * pointerRadius;
				const tipY = centerY + Math.sin(endAngleForPointer) * pointerRadius;

				// Draw the triangle
				ctx.beginPath();
				ctx.translate(tipX, tipY);
				// Rotate the triangle so it points outwards from the center of the arc
				ctx.rotate(endAngleForPointer + Math.PI / 2);

				const pointerSize = 10;
				// Adjust points to draw the triangle facing the correct direction relative to the arc
				ctx.moveTo(0, 0); // Tip of the arrow
				ctx.lineTo(-pointerSize / 2, -pointerSize); // Bottom left point
				ctx.lineTo(pointerSize / 2, -pointerSize); // Bottom right point
				ctx.closePath();
				ctx.fillStyle = '#5711F6';
				ctx.fill();

				ctx.restore();
			}
		};
		//Chart.register(gaugePointer);

		if (canvas && typeof canvas.getContext === 'function') {
			const ctx = canvas.getContext('2d');

			const totalSegments = 25;
			const percentage = 50; // The desired percentage value
			// Calculate the number of filled segments and round to the nearest whole number
			const filledSegments = Math.round((percentage / 100) * totalSegments);
			const data = Array(totalSegments).fill(1);

			const colors = data.map((_, i) =>
				i < filledSegments ? '#7A13F0' : '#F3F4F6'
			);

			new Chart(ctx, {
				type: 'doughnut',
				data: {
					datasets: [{
						data: data,
						backgroundColor: colors,
						borderWidth: 0,
						borderRadius: 12,
						spacing: 60,
						cutout: '60%'
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					aspectRatio: 2,
					rotation: -140,
					circumference: 280,
					layout: {
						padding: {
							bottom: 0
						}
					},
					plugins: {
						legend: { display: false },
						tooltip: { enabled: false },
						gaugePointer: { // Enable the new plugin
							display: false
						}
					}
				}
			});
		}
	});

})();