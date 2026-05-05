'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface MainAnalyticsChartProps {
  data: { day: string; tests: number }[];
  title: string;
}

const MainAnalyticsChart: React.FC<MainAnalyticsChartProps> = ({ data, title }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartOptions: any = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      background: 'transparent',
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    colors: ['#059669'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: data.map(d => d.day),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', fontWeight: 500 }
      }
    },
    yaxis: {
      labels: {
        style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', fontWeight: 500 }
      }
    },
    grid: {
      borderColor: isDark ? '#1e293b' : '#f1f5f9',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
    },
    theme: {
      mode: isDark ? 'dark' : 'light',
    }
  };

  const series = [{
    name: 'Total Tests',
    data: data.map(d => d.tests)
  }];

  return (
    <div style={{ padding: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h4 className="sys-text-h2" style={{ marginBottom: '4px' }}>{title}</h4>
          <p className="sys-text-muted">High-precision monitoring of clinical data streams</p>
        </div>
        <div>
          <select className="sys-transition" style={{ 
            backgroundColor: 'var(--sys-bg-subtle)', 
            border: '1px solid var(--sys-border)', 
            color: 'var(--sys-text-h2)', 
            fontSize: '11px', 
            borderRadius: '8px', 
            padding: '6px 12px', 
            outline: 'none',
            fontWeight: 600
          }}>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
          </select>
        </div>
      </div>
      <div style={{ height: '340px' }}>
        <Chart 
          options={chartOptions} 
          series={series} 
          type="area" 
          height="100%" 
        />
      </div>
    </div>
  );
};

export default MainAnalyticsChart;
