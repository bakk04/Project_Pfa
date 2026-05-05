'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  className?: string
  suffix?: string
  prefix?: string
}

export function AnimatedNumber({
  value,
  duration = 1.5,
  decimals = 0,
  className,
  suffix = '',
  prefix = '',
}: AnimatedNumberProps) {
  const [mounted, setMounted] = useState(false)
  const prevValue = useRef(0)
  
  const spring = useSpring(prevValue.current, {
    duration: duration * 1000,
    bounce: 0,
  })
  
  const display = useTransform(spring, (latest) => {
    return `${prefix}${latest.toFixed(decimals)}${suffix}`
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      spring.set(value)
      prevValue.current = value
    }
  }, [spring, value, mounted])

  if (!mounted) {
    return (
      <span className={className}>
        {prefix}{value.toFixed(decimals)}{suffix}
      </span>
    )
  }

  return (
    <motion.span className={className}>
      {display}
    </motion.span>
  )
}

// Simple animated count without framer-motion transform (for simpler cases)
export function CountUp({
  value,
  duration = 1500,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const startValue = useRef(0)

  useEffect(() => {
    startValue.current = displayValue
    startTime.current = null

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = startValue.current + (value - startValue.current) * easeOut
      
      setDisplayValue(Math.round(current))
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <span className={className}>{displayValue.toLocaleString()}</span>
}
