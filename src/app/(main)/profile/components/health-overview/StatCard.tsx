'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  icon: LucideIcon
  color: string
  trend?: {
    value: number
    isUp: boolean
  }
  data?: any[]
  footer?: string
  isLoading?: boolean
}

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  color,
  trend,
  data,
  footer,
  isLoading
}: StatCardProps) {
  if (isLoading) {
    return (
      <div className="box pull-up animate-pulse">
        <div className="box-body">
          <div className="d-flex align-items-center">
            <div className="me-15 bg-light h-50 w-50 rounded text-center"></div>
            <div className="d-flex flex-column fw-500">
              <div className="h-4 w-20 bg-light mb-5 rounded"></div>
              <div className="h-6 w-10 bg-light rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="box pull-up mb-20"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="box-body">
        <div className="d-flex align-items-center">
          <div 
            className="me-15 h-50 w-50 l-h-60 rounded text-center"
            style={{ backgroundColor: `${color}15`, color: color }}
          >
            <Icon size={24} strokeWidth={2.5} />
          </div>
          <div className="d-flex flex-column fw-500">
            <span className="text-fade fs-14">{label}</span>
            <div className="d-flex align-items-baseline">
              <span className="text-dark fs-20 fw-700">{value}</span>
              {unit && <span className="text-fade ms-5 fs-12">{unit}</span>}
            </div>
          </div>
          
          {trend && (
            <div className="ms-auto">
              <div 
                className={`badge badge-pill ${trend.isUp ? 'bg-success-light' : 'bg-secondary-light'}`}
                style={{ color: trend.isUp ? '#34C759' : '#8E8E93' }}
              >
                {trend.isUp ? <TrendingUp size={12} className="me-1" /> : <TrendingDown size={12} className="me-1" />}
                {trend.value}%
              </div>
            </div>
          )}
        </div>

        {data && data.length > 0 && (
          <div className="mt-15" style={{ height: '40px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={color}
                  fillOpacity={0.1}
                  isAnimationActive={true}
                />
                <YAxis hide domain={['dataMin', 'dataMax']} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {footer && (
          <div className="mt-10 pt-10 bt-1 border-light">
            <span className="text-fade fs-12">{footer}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
