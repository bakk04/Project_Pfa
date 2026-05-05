'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useHealthStore } from '@/services/healthStore'
import { GlassCard } from '../shared/GlassCard'
import { HealthSummaryCards } from '../cards/health-summary-cards'
import { cn } from '@/lib/utils'
import { Heart, TrendingUp, Activity } from 'lucide-react'

const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false })

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  }
}

export function HealthDataTab() {
  const history = useHealthStore((state) => state.history)
  const isLoading = useHealthStore((state) => state.isLoading)
  const [period, setPeriod] = useState<'D' | 'W' | 'M'>('D')

  const chartData = useMemo(() => {
    return history.heartRate.map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: item.value,
      timestamp: item.timestamp
    }))
  }, [history.heartRate])

  const avgHeartRate = useMemo(() => {
    if (chartData.length === 0) return 0
    const sum = chartData.reduce((acc, curr) => acc + curr.value, 0)
    return Math.round(sum / chartData.length)
  }, [chartData])

  const minHeartRate = useMemo(() => {
    if (chartData.length === 0) return 0
    return Math.min(...chartData.map(d => d.value))
  }, [chartData])

  const maxHeartRate = useMemo(() => {
    if (chartData.length === 0) return 0
    return Math.max(...chartData.map(d => d.value))
  }, [chartData])

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Heart Rate History Chart */}
      <motion.div variants={itemVariants}>
        <GlassCard padding="lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Heart className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Heart Rate History</h3>
                <p className="text-sm text-muted-foreground">
                  Average: <span className="font-semibold text-foreground">{avgHeartRate} bpm</span>
                </p>
              </div>
            </div>
            
            {/* Period toggle */}
            <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
              {(['D', 'W', 'M'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                    period === p 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p === 'D' ? 'Day' : p === 'W' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-muted/30 rounded-2xl text-center">
              <p className="text-2xl font-bold text-foreground">{minHeartRate || '--'}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Min BPM</p>
            </div>
            <div className="p-4 bg-red-500/10 rounded-2xl text-center">
              <p className="text-2xl font-bold text-red-500">{avgHeartRate || '--'}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg BPM</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl text-center">
              <p className="text-2xl font-bold text-foreground">{maxHeartRate || '--'}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Max BPM</p>
            </div>
          </div>
          
          {chartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heartRateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF5350" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF5350" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    domain={['dataMin - 10', 'dataMax + 10']}
                    width={40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '16px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      padding: '12px 16px',
                    }}
                    labelStyle={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: '4px' }}
                    itemStyle={{ color: '#EF5350' }}
                    formatter={(value: number) => [`${value} bpm`, 'Heart Rate']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#EF5350" 
                    strokeWidth={3}
                    fill="url(#heartRateGradient)"
                    dot={{ r: 4, fill: '#EF5350', strokeWidth: 2, stroke: 'var(--card)' }}
                    activeDot={{ r: 6, fill: '#EF5350', stroke: 'var(--card)', strokeWidth: 3 }}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-center">No heart rate history available yet.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Start a vitals scan to record data.</p>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Health Summary Cards */}
      <motion.div variants={itemVariants}>
        <HealthSummaryCards isLoading={isLoading} />
      </motion.div>
    </motion.div>
  )
}
