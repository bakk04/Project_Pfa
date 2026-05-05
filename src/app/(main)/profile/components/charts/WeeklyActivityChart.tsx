'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface WeeklyActivityChartProps {
  data: any[]
}

export default function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="20%">
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}
          labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--primary)' }}
        />
        <Bar
          dataKey="steps"
          fill="var(--primary)"
          radius={[6, 6, 0, 0]}
          animationDuration={1500}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
