'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface HeartRateHistoryChartProps {
  data: any[]
}

export default function HeartRateHistoryChart({ data }: HeartRateHistoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          formatter={(value: any) => [`${value} bpm`, 'Heart Rate']}
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
  )
}
