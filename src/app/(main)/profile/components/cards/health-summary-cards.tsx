'use client'

import { VitalsCard } from './VitalsCard'
import { ActivityCard } from './ActivityCard'
import { useHealthData } from '@/hooks/useHealthData'

interface HealthSummaryCardsProps {
  isLoading?: boolean
}

export function HealthSummaryCards({ isLoading = false }: HealthSummaryCardsProps) {
  const { vitals, activity } = useHealthData()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <VitalsCard vitals={vitals} isLoading={isLoading} />
      <ActivityCard activity={activity} isLoading={isLoading} />
    </div>
  )
}
