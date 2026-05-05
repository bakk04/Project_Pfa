// Map Chart
if (document.getElementById('chart-container')) {
	const apiUsageData = [
		{ name: 'Canada', value: [-106.35, 56.13, 70] }, //
		{ name: 'Malaysia', value: [101.98, 4.21, 55] }, //
		{ name: 'Portugal', value: [-8.22, 39.4, 40] } //
	];

	function initializeChart() {
		const chartDom = document.getElementById('chart-container');
		const myChart = echarts.init(chartDom);

		const option = {
			tooltip: { trigger: 'item' },
			visualMap: {
				min: 0,
				max: 100,
				dimension: 2,
				show: false, // Set 'show' to false to hide the sidebar
				inRange: {
					symbolSize: [10]
				}
			},
			geo: {
				map: 'world', // This now works because world.js was loaded above
				roam: true,
				itemStyle: {
					areaColor: '#EDE6FF',
					borderColor: '#EDE6FF'
				}
			},
			series: [{
				type: 'scatter',
				coordinateSystem: 'geo',
				data: apiUsageData,
				itemStyle: {
					color: '#7A13F0', borderColor: '#F5F1FF',
					borderWidth: 6
				},
				symbolSize: 2
			}]
		};

		myChart.setOption(option);

		// This makes the chart responsive
		window.addEventListener('resize', function () {
			myChart.resize();
		});
	}

	initializeChart();
}

// Model Chart
if (document.getElementById('model-chart')) {
	document.addEventListener('DOMContentLoaded', function () {

		const el = document.getElementById('model-chart');
		const chart = echarts.init(el);

		/* ---------- CREATE SOFT DIAGONAL PATTERN ---------- */
		function createPattern(bgColor) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 10;
			const ctx = canvas.getContext('2d');

			ctx.fillStyle = bgColor;
			ctx.fillRect(0, 0, 10, 10);

			ctx.strokeStyle = 'rgba(255,255,255,0.35)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, 10);
			ctx.lineTo(10, 0);
			ctx.stroke();

			return {
				type: 'pattern',
				image: canvas,
				repeat: 'repeat'
			};
		}

		/* ---------- CHART OPTION ---------- */
		const option = {
			grid: {
				left: '-2%',
				right: '-2%',
				top: 10,
				bottom: 30,
				containLabel: false // no extra padding for labels
			},

			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				backgroundColor: '#fff',
				borderColor: '#E5E7EB',
				borderWidth: 1,
				textStyle: { color: '#111' }
			},

			xAxis: {
				type: 'category',
				data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { show: true },
				boundaryGap: true
			},

			yAxis: {
				show: false, // hide y-axis completely
			},

			series: [
				{
					name: 'GPT',
					type: 'bar',
					barCategoryGap: '10%',
					itemStyle: {
						borderRadius: 8,
						color: createPattern('#8B5CF6')
					},
					showBackground: true,
					backgroundStyle: {
						borderRadius: 8,
						color: new echarts.graphic.LinearGradient(
							0, 0, 0, 1,
							[
								{ offset: 0.0, color: 'rgba(122,19,240,0.1)' },
								{ offset: 0.6225, color: 'rgba(217,127,6,0)' },
								{ offset: 1.0, color: 'rgba(217,127,6,0)' }
							]
						)
					},
					data: [5000, 4000, 8000, 7000, 4000, 3000, 5000],
					label: {
						show: true,
						position: 'top',
						distance: -30,
						color: '#fff',
						fontWeight: 'bold',
						formatter: function (params) {
							return (params.value / 1000) + 'k';
						}
					}
				},
				{
					name: 'Llama 3',
					type: 'bar',
					barGap: '10%',
					itemStyle: {
						borderRadius: 8,
						color: createPattern('#10B981')
					},
					showBackground: true,
					backgroundStyle: {
						borderRadius: 8,
						color: new echarts.graphic.LinearGradient(
							0, 0, 0, 1,
							[
								{ offset: 0.0, color: 'rgba(0,13,102,0.1)' },
								{ offset: 0.6225, color: 'rgba(217,127,6,0)' },
								{ offset: 1.0, color: 'rgba(217,127,6,0)' }
							]
						)
					},
					data: [3100, 2500, 3100, 3100, 3100, 3100, 3100],
					label: {
						show: true,
						position: 'top',
						distance: -30,
						color: '#fff',
						fontWeight: 'bold',
						formatter: function (params) {
							return (params.value / 1000) + 'k';
						}
					}
				},
				{
					name: 'Mistral Large',
					type: 'bar',
					barGap: '10%',
					itemStyle: {
						borderRadius: 8,
						color: createPattern('#F59E0B')
					},
					showBackground: true,
					backgroundStyle: {
						borderRadius: 8,
						color: new echarts.graphic.LinearGradient(
							0, 0, 0, 1,
							[
								{ offset: 0.0, color: 'rgba(217,127,6,0.1)' },
								{ offset: 0.6225, color: 'rgba(217,127,6,0)' },
								{ offset: 1.0, color: 'rgba(217,127,6,0)' }
							]
						)
					},
					data: [3000, 3000, 3000, 4000, 3000, 7000, 8000],
					label: {
						show: true,
						position: 'top',
						distance: -30,
						color: '#fff',
						fontWeight: 'bold',
						formatter: function (params) {
							return (params.value / 1000) + 'k';
						}
					}
				}
			],

			/* ---------- RESPONSIVE: hide labels on small screens ---------- */
			media: [
				{
					query: { maxWidth: 600 },
					option: {
						series: [
							{ label: { show: false } },
							{ label: { show: false } },
							{ label: { show: false } }
						]
					}
				}
			]
		};

		/* ---------- RENDER ---------- */
		chart.setOption(option);

		/* ---------- RESPONSIVE RESIZE ---------- */
		window.addEventListener('resize', () => {
			if (el.offsetWidth && el.offsetHeight) chart.resize();
		});

	});
}