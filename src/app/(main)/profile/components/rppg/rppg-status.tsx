'use client'

import { useEffect, useState } from 'react'

interface RPPGResult {
  heartRate: number
  signalQuality: number // 0-100
  timestamp: Date
}

export function RppgStatus() {
  const [result, setResult] = useState<RPPGResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Fetch latest rPPG result from shared API/storage
    const fetchRPPGResult = async () => {
      setIsLoading(true)
      try {
        const stored = localStorage.getItem('latest_rppg_result')
        if (stored) {
          const data = JSON.parse(stored)
          setResult({
            ...data,
            timestamp: new Date(data.timestamp),
          })
        }
      } catch (error) {
        console.error('[v0] Failed to fetch rPPG result:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRPPGResult()

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchRPPGResult, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-light mb-10 rounded"></div>
        <div className="space-y-3">
          <div className="h-10 bg-light rounded10"></div>
          <div className="h-4 bg-light rounded"></div>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-fade mb-15">No measurements yet. Start a measurement in the Heart Rate app to see results here.</p>
        <button className="btn btn-sm btn-primary-light">
          Go to Measurements
        </button>
      </div>
    )
  }

  const getQualityColorClass = (quality: number) => {
    if (quality > 75) return 'bg-success'
    if (quality > 50) return 'bg-primary'
    return 'bg-secondary'
  }

  const getQualityLabel = (quality: number) => {
    if (quality > 75) return 'Excellent'
    if (quality > 50) return 'Good'
    return 'Fair'
  }

  return (
    <div className="rppg-status-content">
      <div className="d-flex align-items-center justify-content-between mb-30 p-20 bg-primary-light rounded10">
        <div>
          <span className="text-fade fs-14 d-block mb-5">Last Heart Rate</span>
          <h2 className="text-primary fw-700 mb-0">{result.heartRate} <small className="fs-12">bpm</small></h2>
        </div>
        <div className="text-end">
          <span className="text-fade fs-14 d-block mb-5">Quality</span>
          <span className={`badge ${result.signalQuality > 75 ? 'badge-success-light' : 'badge-primary-light'}`}>
            {getQualityLabel(result.signalQuality)}
          </span>
        </div>
      </div>

      <div className="mb-20">
        <div className="d-flex align-items-center justify-content-between mb-10">
          <span className="text-fade fs-14">Signal Reliability</span>
          <span className="fw-600">{result.signalQuality}%</span>
        </div>
        <div className="progress progress-sm mb-0">
          <div 
            className={`progress-bar ${getQualityColorClass(result.signalQuality)}`} 
            role="progressbar" 
            style={{ width: `${result.signalQuality}%` }} 
            aria-valuenow={result.signalQuality} 
            aria-valuemin={0} 
            aria-valuemax={100}
          ></div>
        </div>
      </div>

      <p className="text-center text-fade fs-12 mb-0 mt-30">
        Measured at {result.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
