'use strict';

document.addEventListener('DOMContentLoaded', function () {

	// Credit Payment
	if (document.getElementById('credit-chart')) {
		const options = {
			// Data values are now populated to avoid Syntax Errors
			series: [
				{ name: 'Credit', data: [90] },
				{ name: 'Remaining', data: [10] },
			],
			chart: {
				type: 'bar',
				height: 20,
				stacked: true,
				stackType: '100%',
				toolbar: { show: false },
				sparkline: { enabled: true }
			},
			plotOptions: {
				bar: {
					horizontal: true,
					barHeight: '100%',
				}
			},
			colors: ['#9614EB', '#E5E7EB'],
			fill: {
				type: 'pattern',
				opacity: 1,
				pattern: {
					style: 'verticalLines',
					width: 6,
					strokeWidth: 4
				}
			},
			tooltip: { enabled: true },
			xaxis: { categories: ['Usage'] }
		};

		const chart = new ApexCharts(document.querySelector("#credit-chart"), options);
		chart.render();
	}

	// Simple Line
	if (document.getElementById('s-line')) {
		const sline = {
			chart: {
				height: 350,
				type: 'line',
				zoom: {
					enabled: false
				},
				toolbar: {
					show: false,
				},
				borderWidth: 1,
				borderColor: '#000',
			},
			colors: ['var(--color-primary)'],
			dataLabels: {
				enabled: false
			},
			stroke: {
				curve: 'straight',
				width: 2,
			},
			series: [{
				name: "Desktops",
				data: [10, 41, 35, 51, 49, 62, 69, 91, 148]
			}],
			title: {
				text: 'Product Trends by Month',
				align: 'left',
				style: {
					color: 'var(--color-default)',
				},
			},
			grid: {
				borderColor: 'var(--color-border-color)',
				row: {

					opacity: 0.5
				},
				padding: {
					left: -5,
					right: 0,
				},
			},
			xaxis: {
				labels: {
					style: {
						colors: 'var(--color-default)',
					},
				},
				axisBorder: {
					color: ['var(--color-border-color)'],
				},
				axisTicks: {
					color: ['var(--color-border-color)'],
				},
				categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
			},
			yaxis: {
				labels: {
					offsetX: -15,
					style: {
						colors: 'var(--color-default)',
					},
				},
			},
		}

		const chart = new ApexCharts(
			document.querySelector("#s-line"),
			sline
		);

		chart.render();
	}

	// Simple Line Area
	if (document.getElementById('s-line-area')) {
		const sLineArea = {
			chart: {
				height: 350,
				type: 'area',
				toolbar: {
					show: false,
				}
			},
			colors: ['var(--color-primary)', 'var(--color-warning)'],
			dataLabels: {
				enabled: false
			},
			stroke: {
				curve: 'straight',
				width: 1,
			},
			grid: {
				borderColor: 'var(--color-border-color)',
				padding: {
					left: -5,
					right: -15,
				},
			},
			series: [{
				name: 'Income',
				data: [40, 56, 28, 50, 42, 50, 60]
			}, {
				name: 'Expense',
				data: [20, 36, 20, 40, 25, 40, 30]
			}],

			xaxis: {
				labels: {
					style: {
						colors: 'var(--color-default)',
					},
				},
				axisBorder: {
					color: ['var(--color-border-color)'],
				},
				axisTicks: {
					color: ['var(--color-border-color)'],
				},
				type: 'datetime',
				categories: ["2018-09-19T00:00:00", "2018-09-19T01:30:00", "2018-09-19T02:30:00", "2018-09-19T03:30:00", "2018-09-19T04:30:00", "2018-09-19T05:30:00", "2018-09-19T05:35:00"],
			},
			tooltip: {
				x: {
					format: 'dd/MM/yy HH:mm'
				},
			},
			yaxis: {
				min: 0,
				max: 60,
				labels: {
					offsetX: -15,
					style: {
						colors: 'var(--color-default)',
					},
				},
			},
			legend: {
				labels: {
					colors: 'var(--color-default)',
				}
			},
		}

		const chart = new ApexCharts(
			document.querySelector("#s-line-area"),
			sLineArea
		);

		chart.render();
	}

	if (document.getElementById('s-col')) {
		const sCol = {
			chart: {
				height: 290,
				type: 'bar',
				toolbar: {
					show: false,
				}
			},
			plotOptions: {
				bar: {
					horizontal: false,
					columnWidth: '50%',
					borderRadius: 5,
					endingShape: 'rounded', // This rounds the top edges of the bars
				},
			},
			colors: ['var(--color-primary-500)', 'var(--color-success-500)', 'var(--color-warning-500)'],
			dataLabels: {
				enabled: false
			},
			stroke: {
				show: true,
				width: 2,
				colors: ['transparent']
			},

			series: [{
				name: 'Inprogress',
				data: [19, 65, 19, 19, 19, 19, 19]
			}, {
				name: 'Active',
				data: [89, 45, 89, 46, 61, 25, 79]
			},
			{
				name: 'Completed',
				data: [39, 39, 39, 80, 48, 48, 48]
			}],
			xaxis: {
				categories: ['15 Jan', '16 Jan', '17 Jan', '18 Jan', '19 Jan', '20 Jan', '21 Jan'],
				labels: {
					style: {
						colors: 'var(--color-default)',
						fontSize: '12px',
					}
				},
				axisBorder: {
					color: ['var(--color-border-color)'],
				},
				axisTicks: {
					color: ['var(--color-border-color)'],
				},
			},
			yaxis: {
				labels: {
					offsetX: -15,
					style: {
						colors: 'var(--color-default)',
						fontSize: '14px',
					}
				}
			},
			grid: {
				borderColor: 'var(--color-border-color)',
				strokeDashArray: 5,
				padding: {
					left: -8,
					right: -15,
				},
			},
			fill: {
				opacity: 1
			},
			tooltip: {
				y: {
					formatter: function (val) {
						return "" + val + "%"
					}
				}
			},
			legend: {
				labels: {
					colors: 'var(--color-default)',
				}
			},
		}

		const chart = new ApexCharts(
			document.querySelector("#s-col"),
			sCol
		);

		chart.render();
	}

	// Simple Column Stacked
	if (document.getElementById('s-col-stacked')) {
		const sColStacked = {
			chart: {
				height: 290,
				type: 'bar',
				stacked: true,
				toolbar: {
					show: false,
				}
			},
			responsive: [{
				breakpoint: 480,
				options: {
					legend: {
						position: 'bottom',
						offsetX: -10,
						offsetY: 0
					}
				}
			}],
			plotOptions: {
				bar: {
					horizontal: false,
				},
			},
			grid: {
				borderColor: 'var(--color-border-color)',
				padding: {
					left: -5,
					right: -15,
				},
			},
			colors: ['var(--color-primary-500)', 'var(--color-success-500)', 'var(--color-warning-500)', 'var(--color-pink-500)'],
			series: [{
				name: 'Laptops',
				data: [44, 55, 41, 67, 22, 43]
			}, {
				name: 'Cosmetics',
				data: [13, 23, 20, 8, 13, 27]
			}, {
				name: 'Medical Devices',
				data: [11, 17, 15, 15, 21, 14]
			}, {
				name: 'Software',
				data: [21, 7, 25, 13, 22, 8]
			}],
			yaxis: {
				labels: {
					offsetX: -15,
					style: {
						colors: 'var(--color-default)',
					},
				},
			},
			xaxis: {
				labels: {
					style: {
						colors: 'var(--color-default)',
					},
				},
				axisBorder: {
					color: ['var(--color-border-color)'],
				},
				axisTicks: {
					color: ['var(--color-border-color)'],
				},
				type: 'datetime',
				categories: ['01/01/2011 GMT', '01/02/2011 GMT', '01/03/2011 GMT', '01/04/2011 GMT', '01/05/2011 GMT', '01/06/2011 GMT'],
			},
			legend: {
				labels: {
					colors: 'var(--color-default)',
				},
			},
			fill: {
				opacity: 1
			},
		}

		const chart = new ApexCharts(
			document.querySelector("#s-col-stacked"),
			sColStacked
		);

		chart.render();
	}

	// Simple Bar
	if (document.getElementById('s-bar')) {
		const sBar = {
			chart: {
				height: 350,
				type: 'bar',
				toolbar: {
					show: false,
				}
			},
			colors: ['var(--color-primary-600)'],
			grid: {
				borderColor: 'var(--color-border-color)',
				padding: {
					left: 0,
					right: -15,
				},
			},
			plotOptions: {
				bar: {
					horizontal: true,
				}
			},
			dataLabels: {
				enabled: false
			},
			series: [{
				data: [400, 430, 448, 470, 540, 580, 690, 1100, 1200, 1380]
			}],
			xaxis: {
				labels: {
					style: {
						colors: 'var(--color-default)',
					},
				},
				axisBorder: {
					color: ['var(--color-border-color)'],
				},
				axisTicks: {
					color: ['var(--color-border-color)'],
				},
				categories: ['South Korea', 'Canada', 'United Kingdom', 'Netherlands', 'Italy', 'France', 'Japan', 'United States', 'China', 'Germany'],
			},
			yaxis: {
				labels: {
					offsetX: -10,
					style: {
						colors: 'var(--color-default)',
					},
				},
			},
		}

		const chart = new ApexCharts(
			document.querySelector("#s-bar"),
			sBar
		);

		chart.render();
	}

	// Mixed Chart
	if (document.getElementById('mixed-chart')) {
		const options = {
			chart: {
				height: 350,
				type: 'line',
				toolbar: {
					show: false,
				}
			},
			colors: ['var(--color-primary-600)', 'var(--color-success-600)'],
			series: [{
				name: 'Website Blog',
				type: 'column',
				data: [440, 505, 414, 671, 227, 413, 201, 352, 752, 320, 257, 160]
			}, {
				name: 'Social Media',
				type: 'line',
				data: [23, 42, 35, 27, 43, 22, 17, 31, 22, 22, 12, 16]
			}],
			stroke: {
				width: [0, 4]
			},
			grid: {
				borderColor: 'var(--color-border-color)',
				padding: {
					left: -5,
					right: -15,
				},
			},
			title: {
				text: 'Traffic Sources',
				style: {
					color: 'var(--color-default)',
				},
			},
			legend: {
				labels: {
					colors: 'var(--color-default)',
				}
			},
			labels: ['01 Jan 2001', '02 Jan 2001', '03 Jan 2001', '04 Jan 2001', '05 Jan 2001', '06 Jan 2001', '07 Jan 2001', '08 Jan 2001', '09 Jan 2001', '10 Jan 2001', '11 Jan 2001', '12 Jan 2001'],
			xaxis: {
				type: 'datetime',
				labels: {
					style: {
						colors: 'var(--color-default)',
					},
				},
				axisBorder: {
					color: ['var(--color-border-color)'],
				},
				axisTicks: {
					color: ['var(--color-border-color)'],
				}
			},
			yaxis: [{
				title: {
					text: 'Website Blog',
				},
				labels: {
					offsetX: -15,
					style: {
						colors: 'var(--color-default)',
					},
				},

			}, {
				opposite: true,
				title: {
					text: 'Social Media'
				},
				labels: {
					offsetX: -15,
					style: {
						colors: 'var(--color-default)',
					},
				},
			}]

		}

		const chart = new ApexCharts(
			document.querySelector("#mixed-chart"),
			options
		);

		chart.render();
	}

	// Donut Chart
	if (document.getElementById('donut-chart')) {
		const donutChart = {
			chart: {
				height: 330,
				type: 'donut',
				toolbar: {
					show: false,
				}
			},
			legend: {
				position: 'bottom',
				labels: {
					colors: 'var(--color-default)',
				}
			},
			colors: ['var(--color-primary-600)', 'var(--color-success-600)', 'var(--color-warning-600)', 'var(--color-pink-600)'],
			labels: ['Laptops', 'Cosmetics', 'Medical Devices', 'Software'],
			series: [44, 55, 41, 17],
			responsive: [{
				breakpoint: 480,
				options: {
					chart: {
						width: 200
					},
					legend: {
						position: 'bottom'
					}
				}
			}]
		}

		const donut = new ApexCharts(
			document.querySelector("#donut-chart"),
			donutChart
		);

		donut.render();
	}

	// Radial Chart
	if (document.getElementById('radial-chart')) {
		const radialChart = {
			chart: {
				height: 350,
				type: 'radialBar',
				toolbar: {
					show: false,
				}
			},
			colors: ['var(--color-primary-600)', 'var(--color-success-600)', 'var(--color-warning-600)', 'var(--color-pink-600)'],
			plotOptions: {
				radialBar: {
					dataLabels: {
						name: {
							fontSize: '22px',
							color: 'var(--color-title)',
						},
						value: {
							fontSize: '16px',
							color: 'var(--color-default)',
						},
						total: {
							show: true,
							label: 'Total',
							color: 'var(--color-default)',
							formatter: function (w) {
								return 249
							}
						}
					}
				}
			},
			series: [44, 55, 67, 83],
			labels: ['Apples', 'Oranges', 'Bananas', 'Berries'],
		}

		const chart = new ApexCharts(
			document.querySelector("#radial-chart"),
			radialChart
		);

		chart.render();
	}

	// Performance Chart
	if (document.getElementById('analytics-chart')) {
		const options = {
			series: [{
				name: "Interaction",
				data: [8000, 28000, 18000, 39000, 32000, 38000, 18000, 27000, 20000, 34000]
			}, {
				name: "Resolved",
				data: [5000, 22000, 15000, 29000, 22000, 28000, 12000, 17000, 14000, 28000]
			}],
			chart: {
				height: 320, // Default height for smaller screens
				type: 'area',
				toolbar: { show: false },
				zoom: { enabled: false }
			},
			// --- RESPONSIVE SECTION START ---
			responsive: [{
				breakpoint: 3000, // Apply this to anything up to 3000px
				options: {
					chart: {
						height: 320 // Target height
					}
				}
			}, {
				breakpoint: 1400, // When screen is 1400px or less, go back to 320
				options: {
					chart: {
						height: 320
					}
				}
			}],
			// --- RESPONSIVE SECTION END ---
			colors: ['#10B981', '#A855F7'],
			dataLabels: { enabled: false },
			stroke: {
				curve: 'smooth',
				width: 2
			},
			fill: {
				type: 'gradient',
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.2,
					opacityTo: 0.0,
					stops: [0, 90, 100]
				}
			},
			grid: {
				show: true,
				borderColor: '#E5E7EB',
				strokeDashArray: 4,
				position: 'back',
				xaxis: { lines: { show: false } },
				yaxis: { lines: { show: true } },
				padding: { left: 0, right: 0, bottom: -10 }
			},
			xaxis: {
				categories: ['Mon', '', 'Tue', '', 'Wed', '', 'Thu', '', 'Fri', '', 'Sat', '', 'Sun'],
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: {
					style: { colors: '#64748b', fontSize: '12px' },
					offsetX: -3
				}
			},
			yaxis: {
				min: 0,
				max: 40000,
				tickAmount: 4,
				labels: {
					style: { colors: '#64748b', fontSize: '12px' },
					formatter: (val) => val === 0 ? '0' : (val / 1000) + 'k',
					offsetX: -12
				}
			},
			tooltip: {
				shared: true,
				intersect: false,
				theme: 'dark',
				custom: function ({ series, seriesIndex, dataPointIndex, w }) {
					return '<div class="custom-tooltip" style="padding:10px;">' +
						'<div><span>Interaction: </span><strong>' + series[0][dataPointIndex] + '</strong></div>' +
						'<div><span>Resolved: </span><strong>' + series[1][dataPointIndex] + '</strong></div>' +
						'</div>';
				}
			},
			legend: { show: false }
		};

		const chart = new ApexCharts(document.querySelector("#analytics-chart"), options);
		chart.render();
	}

	// Employee
	if (document.getElementById('employee-distribution')) {
		const options = {
			series: [
				{
					name: 'GPT',
					data: [4000, 4000, 4000, 4000]
				},
				{
					name: 'Llama 3',
					data: [3100, 3100, 3100, 3100]
				},
				{
					name: 'Llama 3',
					data: [2400, 2400, 2400, 2400]
				}
			],

			chart: {
				type: 'bar',
				height: 260,
				toolbar: { show: false }
			},

			plotOptions: {
				bar: {
					horizontal: false,
					columnWidth: '42%',        // ⭐ controls spacing
					borderRadius: 8,           // ⭐ rounded bars
					borderRadiusApplication: 'end',
					borderRadiusWhenStacked: 'last',
				}
			},

			dataLabels: {
				enabled: true,
				formatter: val => `${val / 1000}k`,
				style: {
					fontSize: '12px',
					colors: ['#fff']
				},
				offsetY: -6
			},

			fill: {
				type: 'pattern',
				pattern: {
					style: 'slantedLines',
					width: 6,
					height: 6,
					strokeWidth: 2
				}
			},

			colors: ['#8B5CF6', '#10B981', '#F59E0B'],

			xaxis: {
				categories: ['Mon', 'Tue', 'Wed', 'Thu'],
				labels: {
					style: {
						fontSize: '13px'
					}
				}
			},

			yaxis: {
				labels: {
					formatter: val => `${val / 1000}k`
				}
			},

			grid: {
				show: false
			},

			legend: {
				show: false
			},

			tooltip: {
				custom: function ({ series, dataPointIndex }) {
					return `
            <div style="padding:10px">
              <strong>Thu</strong><br/>
              GPT : ${series[0][dataPointIndex] / 1000}K<br/>
              Llama 3 : ${series[1][dataPointIndex] / 1000}K<br/>
              Llama 3 : ${series[2][dataPointIndex] / 1000}K
            </div>
          `
				}
			}
		};

		const chart = new ApexCharts(
			document.querySelector("#employee-distribution"),
			options
		);

		chart.render();
	}

	// Credit Payment
	if (document.getElementById('request-chart')) {
		const options = {
			// Data values are now populated to avoid Syntax Errors
			series: [
				{ name: 'Request', data: [50] },
				{ name: 'Remaining', data: [50] },
			],
			chart: {
				type: 'bar',
				width: 106,
				height: 30,
				stacked: true,
				stackType: '100%',
				toolbar: { show: false },
				sparkline: { enabled: true }
			},
			plotOptions: {
				bar: {
					horizontal: true,
					barHeight: '100%',
				}
			},
			colors: ['#7A13F0', '#E5E7EB'],
			fill: {
				type: 'pattern',
				opacity: 1,
				pattern: {
					style: 'verticalLines',
					width: 6,
					strokeWidth: 4
				}
			},
			tooltip: { enabled: true },
			xaxis: { categories: ['Last Month'] }
		};

		const chart = new ApexCharts(document.querySelector("#request-chart"), options);
		chart.render();
	}

	// Image Chart
	if (document.getElementById('image-chart')) {
		const totalBlocks = 17;
		const completionPercentage = 95; // Input your percentage here (e.g., 95%)

		// Calculate how many blocks need to be filled
		const filledBlocks = Math.round((completionPercentage / 100) * totalBlocks);

		const options = {
			series: [{
				data: Array(totalBlocks).fill(1)
			}],

			chart: {
				type: 'bar',
				height: 12, // FIXED HEIGHT: 16px
				width: '100%',
				toolbar: { show: false },
				sparkline: { enabled: true }
			},

			plotOptions: {
				bar: {
					distributed: true,
					// Adjusted to create a wider 12px gap between the 16px circles
					columnWidth: '50%',
					borderRadius: 6,     // 50% border-radius for perfect circles
					borderRadiusApplication: 'around',
				}
			},

			colors: [
				({ dataPointIndex }) =>
					dataPointIndex < filledBlocks
						? '#F26522' // Active Orange
						: '#E5E7EB' // Inactive Gray
			],

			dataLabels: { enabled: false },
			grid: { show: false },
			xaxis: {
				labels: { show: false },
				axisBorder: { show: false },
				axisTicks: { show: false }
			},
			yaxis: { show: false, max: 1 },
			tooltip: { enabled: false },

			states: {
				hover: { filter: { type: 'none' } },
				active: { filter: { type: 'none' } }
			}
		};

		new ApexCharts(document.querySelector("#image-chart"), options).render();
		document.querySelectorAll('#image-chart .apexcharts-series path').forEach(path => {
			// Example: add rounded caps using stroke-linecap
			path.setAttribute('stroke-linecap', 'round');
		});
	}

	// Accuracy Chart
	if (document.getElementById('accuracy-chart')) {
		const sCol = {
			chart: {
				width: 110,
				height: 54,
				type: 'bar',
				toolbar: { show: false },
				sparkline: { enabled: true }
			},
			dataLabels: { enabled: false },
			series: [{
				name: 'Accuracy',
				data: [20, 40, 30, 70, 60, 60, 60] // You can adjust these
			}],
			colors: ['#155DFC'],
			plotOptions: {
				bar: {
					borderRadius: 4,
					borderRadiusWhenStacked: 'all',
					borderRadiusApplication: 'around', // Ensures top-only rounding for vertical bars
					endingShape: 'around',
					colors: {
						backgroundBarOpacity: 0.5,
						backgroundBarRadius: 4,
						hover: {
							enabled: true,
							borderColor: '#F26522', // Color when hovering over the bar
						}
					}
				},
			},
			xaxis: {
				labels: { show: false },
				axisTicks: { show: false },
				axisBorder: { show: false }
			},
			yaxis: { show: false },
			grid: { show: false },
			tooltip: { enabled: true }
		};

		const chart = new ApexCharts(document.querySelector("#accuracy-chart"), sCol);
		chart.render();
	}

});