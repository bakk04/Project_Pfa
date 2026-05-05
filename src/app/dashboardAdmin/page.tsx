'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import StatsCard from './components/StatsCard';
import MainAnalyticsChart from './components/MainAnalyticsChart';
import RecentActivityTable from './components/RecentActivityTable';
import SystemMetrics from './components/SystemMetrics';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, analyticsRes, usersRes] = await Promise.all([
          fetch('/api/dashboardAdmin/stats'),
          fetch('/api/dashboardAdmin/analytics'),
          fetch('/api/dashboardAdmin/users'),
        ]);

        const statsData = await statsRes.json();
        const analyticsData = await analyticsRes.json();
        const usersData = await usersRes.json();

        setStats(statsData);
        setAnalytics(analyticsData);
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const trends = [
    [31, 40, 28, 51, 42, 109, 100],
    [10, 15, 8, 12, 18, 14, 20],
    [90, 92, 88, 95, 94, 98, 99],
    [120, 130, 115, 140, 124, 110, 124],
  ];

  const adminFirstName = session?.user?.name?.split(' ')[0] || 'Administrator';

  // Enterprise Motion Variants (250-400ms, ease-in-out)
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="sys-dashboard-grid"
    >
      {/* Header Section */}
      <div style={{ gridColumn: 'span 12', marginBottom: 'var(--sys-spacing-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
          <div>
            <nav style={{ marginBottom: '0.5rem' }}>
              <ol style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}>
                <li className="sys-text-label">Control Center</li>
                <li className="sys-text-label" style={{ color: 'var(--sys-color-primary)' }}>/ Intelligence Hub</li>
              </ol>
            </nav>
            <h1 className="sys-text-h2" style={{ fontSize: '1.5rem' }}>Clinical Intelligence Hub</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="sys-card sys-elevation-low" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--sys-color-primary)' }}></div>
              <span className="sys-text-label" style={{ textTransform: 'none', letterSpacing: 'normal' }}>System Active: May 4, 2026</span>
            </div>
            <button className="medical-btn-primary">
              <i className="ph ph-export"></i> Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section - FIXED BUG: Added background, fixed text visibility, applied elevation */}
      <motion.div 
        variants={itemVariants}
        className="sys-card clinical-hero sys-elevation-medium"
      >
        <div style={{ maxWidth: '800px' }}>
          <div className="sys-text-label" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ade80' }}></span>
            Mission Critical Streams Active
          </div>
          
          <h2 className="sys-text-h1" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
            Welcome back, <span style={{ opacity: 0.9 }}>{adminFirstName}</span>
          </h2>
          
          <p className="sys-text-body" style={{ fontSize: '0.9375rem', opacity: 0.8, marginBottom: '1.25rem', maxWidth: '450px' }}>
            Medical AI is monitoring all clinical data points in real-time. System efficiency is currently trending <span style={{ fontWeight: 800 }}>+12.5%</span> above baseline.
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="medical-btn-secondary">
              <i className="ph ph-sparkle"></i> Launch AI Studio
            </button>
            <button className="medical-btn-secondary" style={{ backgroundColor: 'transparent' }}>
              <i className="ph ph-plus-circle"></i> New Clinical Analysis
            </button>
          </div>
        </div>

        {/* Decorative element - subtle, non-distracting */}
        <div style={{ position: 'absolute', right: '3rem', bottom: '-1rem', opacity: 0.02, pointerEvents: 'none' }}>
          <i className="ph ph-brain" style={{ fontSize: '10rem' }}></i>
        </div>
      </motion.div>

      {/* Stats Cards Section */}
      <div style={{ gridColumn: 'span 12' }}>
        <div className="sys-dashboard-grid">
          <div style={{ gridColumn: 'span 3' }}>
            <StatsCard 
              title="Active Patients" 
              value={loading ? '...' : stats?.totalUsers || 0} 
              trend={+12.5} 
              icon="ph-users" 
              color="var(--sys-color-primary)" 
              chartData={trends[0]}
            />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <StatsCard 
              title="Clinical Tests" 
              value={loading ? '...' : stats?.totalTests || 0} 
              trend={+8.4} 
              icon="ph-activity" 
              color="#0ea5e9" 
              chartData={trends[1]}
            />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <StatsCard 
              title="Accuracy Rate" 
              value={loading ? '...' : stats?.successRate || '99.9%'} 
              trend={+0.1} 
              icon="ph-check-circle" 
              color="#10b981" 
              chartData={trends[2]}
            />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <StatsCard 
              title="AI Latency" 
              value={loading ? '...' : stats?.processingTime || '124ms'} 
              trend={-5.2} 
              icon="ph-timer" 
              color="#6366f1" 
              chartData={trends[3]}
            />
          </div>
        </div>
      </div>

      {/* Main Analytics Chart */}
      <motion.div 
        variants={itemVariants}
        style={{ gridColumn: 'span 8' }}
      >
        <div className="sys-card sys-elevation-medium sys-card-hover" style={{ height: '100%', minHeight: '450px' }}>
          {analytics ? (
            <MainAnalyticsChart 
              data={analytics.testAnalytics} 
              title="Biometric Stream Intelligence" 
            />
          ) : (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
               <span className="sys-text-label">Compiling Analytics...</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* System Metrics Sidebar within Grid */}
      <motion.div 
        variants={itemVariants}
        style={{ gridColumn: 'span 4' }}
      >
        <div className="sys-card sys-elevation-medium sys-card-hover" style={{ height: '100%' }}>
          <SystemMetrics 
            system={stats?.system || { cpu: 0, memory: 0, totalMemory: '0GB', usedMemory: '0GB', storage: 0 }} 
            loading={loading} 
          />
        </div>
      </motion.div>

      {/* Recent Activity Section */}
      <motion.div 
        variants={itemVariants}
        style={{ gridColumn: 'span 12' }}
      >
        <div className="sys-card sys-elevation-medium">
          <RecentActivityTable 
            users={users} 
            loading={loading} 
          />
        </div>
      </motion.div>

    </motion.div>
  );
}
