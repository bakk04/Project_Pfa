'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface SystemMetricsProps {
  system: {
    cpu: number;
    memory: number;
    totalMemory: string;
    usedMemory: string;
    storage: number;
  };
  loading: boolean;
}

const SystemMetrics: React.FC<SystemMetricsProps> = ({ system, loading }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const getGaugeOptions = (color: string) => ({
    chart: { type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        hollow: { size: '60%' },
        track: {
          background: isDark ? '#1e293b' : '#f1f5f9',
          strokeWidth: '100%',
        },
        dataLabels: {
          name: { show: false },
          value: {
            offsetY: 5,
            fontSize: '12px',
            fontWeight: '800',
            color: isDark ? '#f8fafc' : '#0f172a'
          }
        }
      }
    },
    colors: [color],
    stroke: { lineCap: 'round' }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '2rem' }}>
        <div style={{ flex: 1 }}>
          <h4 className="sys-text-h2" style={{ marginBottom: '4px' }}>Infrastructure</h4>
          <p className="sys-text-muted">Real-time core health</p>
        </div>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '10px', 
          backgroundColor: 'var(--sys-bg-subtle)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--sys-color-primary)',
          border: '1px solid var(--sys-border)'
        }}>
          <i className="ph ph-shield-check" style={{ fontSize: '1.25rem' }}></i>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* CPU Usage */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(249, 115, 22, 0.1)', 
              color: '#f97316',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}>
              <i className="ph ph-cpu" style={{ fontSize: '1.125rem' }}></i>
            </div>
            <div>
              <p className="sys-text-body" style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px' }}>CPU Load</p>
              <p className="sys-text-muted" style={{ fontSize: '10px' }}>AI Core Logic</p>
            </div>
          </div>
          <div style={{ width: '48px', height: '48px' }}>
            <Chart 
              options={getGaugeOptions('#f97316')} 
              series={[system.cpu]} 
              type="radialBar" 
              height="100%" 
            />
          </div>
        </div>

        {/* Memory Usage */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(59, 130, 246, 0.1)', 
              color: '#3b82f6',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}>
              <i className="ph ph-database" style={{ fontSize: '1.125rem' }}></i>
            </div>
            <div>
              <p className="sys-text-body" style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px' }}>Memory</p>
              <p className="sys-text-muted" style={{ fontSize: '10px' }}>{system.usedMemory} / {system.totalMemory}</p>
            </div>
          </div>
          <div style={{ width: '48px', height: '48px' }}>
            <Chart 
              options={getGaugeOptions('#3b82f6')} 
              series={[system.memory]} 
              type="radialBar" 
              height="100%" 
            />
          </div>
        </div>

        {/* Storage Usage */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              color: '#10b981',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}>
              <i className="ph ph-hard-drive" style={{ fontSize: '1.125rem' }}></i>
            </div>
            <div>
              <p className="sys-text-body" style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px' }}>Storage</p>
              <p className="sys-text-muted" style={{ fontSize: '10px' }}>Analytics Data</p>
            </div>
          </div>
          <div style={{ width: '48px', height: '48px' }}>
            <Chart 
              options={getGaugeOptions('#10b981')} 
              series={[system.storage]} 
              type="radialBar" 
              height="100%" 
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--sys-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span className="sys-text-label">Network Status</span>
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            color: '#10b981', 
            fontSize: '10px', 
            fontWeight: 800,
            textTransform: 'uppercase'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse"></span>
            Operational
          </span>
        </div>
        <p className="sys-text-muted" style={{ fontSize: '10px' }}>Latency: 124ms</p>
      </div>
    </div>
  );
};

export default SystemMetrics;
