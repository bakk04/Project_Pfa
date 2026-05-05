'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function GlassCard({
  children,
  className,
  hover = true,
  padding = 'md',
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      className={cn(
        'bg-sh-card',
        'backdrop-blur-xl',
        'rounded-[32px]',
        'shadow-sh',
        'border border-sh-border',
        'transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1)',
        hover && 'hover:shadow-sh-hover hover:-translate-y-1',
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function GlassCardSkeleton({ 
  className,
  height = 'h-40'
}: { 
  className?: string
  height?: string 
}) {
  return (
    <div
      className={cn(
        'bg-card/60 dark:bg-card/40',
        'backdrop-blur-xl',
        'rounded-[28px]',
        'border border-border/40 dark:border-border/20',
        'animate-pulse',
        height,
        className
      )}
    />
  )
}
