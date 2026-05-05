'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface StatsCardProps {
  title: string;
  value: string | number;
  trend: number;
  icon: string;
  color: string;
  chartData: number[];
  delay?: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, trend, icon, color, chartData, delay = 0 }) => {
  const chartOptions: any = {
    chart: {
      type: 'area',
      sparkline: { enabled: true },
      animations: { enabled: true, easing: 'easeinout', speed: 400 },
    },
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0,
        stops: [0, 90, 100]
      }
    },
    markers: { size: 0 },
    tooltip: { enabled: false },
    colors: [color],
  };

  const isPositive = trend >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1, ease: [0.4, 0, 0.2, 1] }}
      className="sys-card sys-elevation-medium sys-card-hover"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '10px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          backgroundColor: color,
          boxShadow: `0 4px 12px -2px ${color}40`
        }}>
          <i className={`ph ${icon}`} style={{ fontSize: '1.25rem' }}></i>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          padding: '4px 8px', 
          borderRadius: '6px', 
          fontSize: '10px', 
          fontWeight: 800,
          backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: isPositive ? '#10b981' : '#ef4444'
        }}>
          <i className={`ph ${isPositive ? 'ph-trend-up' : 'ph-trend-down'}`}></i>
          {Math.abs(trend)}%
        </div>
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        <p className="sys-text-label" style={{ marginBottom: '4px' }}>{title}</p>
        <h3 className="sys-text-metric" style={{ lineHeight: 1 }}>{value}</h3>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '4px', height: '40px', width: '100%' }}>
        <Chart 
          options={chartOptions} 
          series={[{ data: chartData }]} 
          type="area" 
          height="100%" 
          width="100%" 
        />
      </div>
    </motion.div>
  );
};

export default StatsCard;
