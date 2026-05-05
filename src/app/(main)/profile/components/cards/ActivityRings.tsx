'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CountUp } from '../shared/AnimatedNumber'

interface RingData {
  label: string
  value: number
  goal: number
  color: string
  icon: React.ReactNode
}

interface ActivityRingsProps {
  steps?: number
  calories?: number
  exerciseMinutes?: number
  stepsGoal?: number
  caloriesGoal?: number
  exerciseGoal?: number
  size?: number
  strokeWidth?: number
  className?: string
}

const StepsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16L20 16" />
    <path d="M4 12L12 12" />
    <path d="M4 8L16 8" />
  </svg>
)

const CaloriesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c-4.97 0-9-4.03-9-9 0-3.53 2.04-6.58 5-8.05C8 7.77 10 10 12 10c2.5 0 4-1.5 4-4 0-.5-.05-1-.15-1.45C18.52 6.11 21 9.79 21 14c0 4.42-4.03 8-9 8Z" />
  </svg>
)

const ExerciseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

function Ring({ 
  radius, 
  progress, 
  color, 
  strokeWidth,
  delay = 0 
}: { 
  radius: number
  progress: number
  color: string
  strokeWidth: number
  delay?: number
}) {
  const circumference = 2 * Math.PI * radius
  const clampedProgress = Math.min(Math.max(progress, 0), 100)
  
  return (
    <>
      {/* Background ring */}
      <circle
        cx="50%"
        cy="50%"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-sh-border"
        opacity="0.5"
      />
      {/* Progress ring */}
      <motion.circle
        cx="50%"
        cy="50%"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - clampedProgress / 100) }}
        transition={{ 
          duration: 1.5, 
          delay,
          ease: [0.32, 0.72, 0, 1] 
        }}
        style={{ 
          filter: `drop-shadow(0 0 4px ${color}40)`,
        }}
      />
    </>
  )
}

export function ActivityRings({
  steps = 0,
  calories = 0,
  exerciseMinutes = 0,
  stepsGoal = 10000,
  caloriesGoal = 600,
  exerciseGoal = 30,
  size = 200,
  strokeWidth = 12,
  className,
}: ActivityRingsProps) {
  const [activeRing, setActiveRing] = useState(0)
  
  const rings: RingData[] = useMemo(() => [
    {
      label: 'Steps',
      value: steps,
      goal: stepsGoal,
      color: '#34C759', // sh-green
      icon: <StepsIcon />,
    },
    {
      label: 'Calories',
      value: calories,
      goal: caloriesGoal,
      color: '#FF9500', // sh-orange
      icon: <CaloriesIcon />,
    },
    {
      label: 'Exercise',
      value: exerciseMinutes,
      goal: exerciseGoal,
      color: '#007AFF', // sh-blue
      icon: <ExerciseIcon />,
    },
  ], [steps, calories, exerciseMinutes, stepsGoal, caloriesGoal, exerciseGoal])

  const gap = strokeWidth + 4
  const outerRadius = (size / 2) - strokeWidth / 2 - 2
  const middleRadius = outerRadius - gap
  const innerRadius = middleRadius - gap

  const radii = [outerRadius, middleRadius, innerRadius]
  
  const handleCycleRing = () => {
    setActiveRing((prev) => (prev + 1) % 3)
  }

  const activeData = rings[activeRing]

  return (
    <div className={cn("flex flex-col items-center w-full", className)}>
      <div 
        className="relative cursor-pointer mb-6 transition-transform duration-300 active:scale-95"
        style={{ width: size, height: size }}
        onClick={handleCycleRing}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleCycleRing()}
        aria-label="Cycle through activity rings"
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {rings.map((ring, index) => (
            <Ring
              key={ring.label}
              radius={radii[index]}
              progress={(ring.value / ring.goal) * 100}
              color={ring.color}
              strokeWidth={strokeWidth}
              delay={0.1 * index}
            />
          ))}
        </svg>
        
        {/* Center content */}
        <motion.div 
          key={activeRing}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
            style={{ 
              backgroundColor: `${activeData.color}15`,
              color: activeData.color,
            }}
          >
            {activeData.icon}
          </div>
          <div className="text-[24px] font-black text-sh-text tracking-tight leading-none">
            <CountUp value={activeData.value} duration={1000} />
          </div>
          <div className="text-[10px] font-bold text-sh-sub uppercase tracking-widest mt-0.5">
            {activeData.label}
          </div>
        </motion.div>
      </div>
      
      {/* Ring legend - Metric Cards */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {rings.map((ring, index) => {
          const ringProgress = ring.goal > 0 ? Math.min(100, Math.round((ring.value / ring.goal) * 100)) : 0
          const isActive = activeRing === index
          return (
            <button
              key={ring.label}
              onClick={() => setActiveRing(index)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-[20px] transition-all duration-300",
                isActive ? "bg-sh-card shadow-sh border border-sh-border scale-105" : "bg-sh-bg/30 hover:bg-sh-bg/50 border border-transparent"
              )}
            >
              <div 
                className="w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${ring.color}15`, color: ring.color }}
              >
                {ring.icon}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8.5px] font-bold text-sh-sub uppercase tracking-wider">
                  {ring.label}
                </span>
                <span className="text-[12px] font-black text-sh-text leading-none mt-0.5">
                  {ringProgress}%
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Skeleton version for loading state
export function ActivityRingsSkeleton({ size = 200 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center w-full">
      <div 
        className="rounded-full bg-sh-bg animate-pulse mb-6"
        style={{ width: size, height: size }}
      />
      <div className="grid grid-cols-3 gap-2 w-full">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-[20px] bg-sh-bg/50 animate-pulse">
            <div className="w-9 h-9 rounded-[12px] bg-sh-border" />
            <div className="h-2 bg-sh-border rounded w-8" />
            <div className="h-3 bg-sh-border rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
