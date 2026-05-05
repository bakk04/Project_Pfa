'use client'

import { VitalsCard } from './vitals-card'
import { ActivityCard } from './activity-card'
import { useHealthData } from '@/hooks/useHealthData'

interface HealthSummaryCardsProps {
  isLoading?: boolean
}

export function HealthSummaryCards({ isLoading = false }: HealthSummaryCardsProps) {
  const { vitals, activity } = useHealthData()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <VitalsCard vitals={vitals} isLoading={isLoading} />
      <ActivityCard activity={activity} isLoading={isLoading} />
    </div>
  )
}
