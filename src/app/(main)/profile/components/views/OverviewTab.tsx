'use client'

import React, { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrediction } from '@/hooks/usePrediction'
import { useHealthData } from '@/hooks/useHealthData'
import { useSession } from 'next-auth/react'
import { useHealthStore } from '@/services/healthStore'
import { GlassCard } from '../shared/GlassCard'
import { ActivityRings, ActivityRingsSkeleton } from '../cards/ActivityRings'
import { CountUp } from '../shared/AnimatedNumber'
import { cn } from '@/lib/utils'
import { generateMedicalReport } from '@/utils/report'
import {
  Activity,
  Heart,
  Wind,
  Zap,
  Brain,
  TrendingUp,
  Play,
  AlertTriangle,
  Info,
  ChevronRight,
  CheckCircle2,
  Clock,
  FileDown,
  X
} from 'lucide-react'
import { useVitalStore } from '@/store/vital-store'
import Image from 'next/image'
import { toast } from 'sonner'

const WeeklyActivityChart = dynamic(() => import('../charts/WeeklyActivityChart'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted/10 animate-pulse rounded-2xl" />
})

interface OverviewTabProps {
  onStartTest?: () => void
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
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

export function OverviewTab({ onStartTest }: OverviewTabProps) {
  const { data: session } = useSession()
  const { currentPrediction, askAI } = usePrediction()
  const { vitals, activity, triggerSync } = useHealthData()
  const history = useHealthStore((state) => state.history)
  const { predictionResult, testHistory, reset: resetVitalStore, onboardingData, fetchTestHistory } = useVitalStore()

  const [mounted, setMounted] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [isAskingAI, setIsAskingAI] = useState(false)

  useEffect(() => { 
    setMounted(true)
    fetchTestHistory()
  }, [fetchTestHistory])

  const getOrFetchClinicalData = async () => {
    if (onboardingData?.clinical_data) {
      return onboardingData.clinical_data
    }
    
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const userData = await res.json()
        
        const ensureBool = (val: any) => {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'string') {
            const s = val.toLowerCase();
            return ['true', 'yes', 'current', 'parent', 'sibling', 'both', 'family'].includes(s);
          }
          return !!val;
        };

        return {
          weight: userData?.healthData?.weight || 75,
          height: userData?.healthData?.height || 175,
          glucose_fasting_mg_dl: 100,
          hba1c: 5.4,
          smoking: ensureBool(userData?.healthData?.smoking),
          familyHistory: ensureBool(userData?.healthData?.familyHistory),
          gender: userData?.healthData?.gender ?? 1,
          bloodpressure: 120,
          pregnancies: 0,
          skinthickness: 20,
          insulin: 80,
          diabetespedigreefunction: 0.47,
          dateOfBirth: userData?.dateOfBirth ? userData.dateOfBirth.split('T')[0] : "1990-01-01"
        }
      }
    } catch (fetchErr) {
      console.error('[OverviewTab] Fetch profile error:', fetchErr)
    }

    return {
      weight: 75,
      height: 175,
      glucose_fasting_mg_dl: 100,
      hba1c: 5.4,
      smoking: false,
      familyHistory: false,
      gender: 1,
      bloodpressure: 120,
      pregnancies: 0,
      skinthickness: 20,
      insulin: 80,
      diabetespedigreefunction: 0.47,
      dateOfBirth: "1990-01-01"
    }
  }

  const handleAskAI = async () => {
    if (!predictionResult) {
      toast.error('No prediction result found.')
      return
    }
    setIsAskingAI(true)
    try {
      const formattedPrediction = {
        ...predictionResult,
        final_probability: predictionResult.final_probability || predictionResult.probability || 0,
        risk_status: predictionResult.risk_status
      }
      const clinicalData = await getOrFetchClinicalData()
      const explanation = await askAI(formattedPrediction, clinicalData)
      setAiExplanation(explanation)
    } catch (error: any) {
      console.error('[OverviewTab] Ask AI error:', error)
      toast.error(error?.message || 'Failed to get AI explanation. Please try again.')
    } finally {
      setIsAskingAI(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!predictionResult) {
      toast.error('No prediction result found.')
      return
    }
    try {
      const patientInfo = {
        name: session?.user?.name || 'Valued Patient',
        id: session?.user?.id || 'ANON-123'
      }
      const formattedPrediction = {
        ...predictionResult,
        final_probability: predictionResult.final_probability || predictionResult.probability || 0,
        risk_status: predictionResult.risk_status
      }
      const clinicalData = await getOrFetchClinicalData()
      generateMedicalReport(formattedPrediction, clinicalData, patientInfo)
    } catch (error) {
      console.error('[OverviewTab] Download report error:', error)
      toast.error('Failed to generate medical report.')
    }
  }

  const hasPrediction = !!currentPrediction
  const riskLevel = hasPrediction ? (currentPrediction.risk_status?.toLowerCase() || 'low') : 'low'
  const healthScore = hasPrediction
    ? Math.round(100 - ((currentPrediction.final_probability || 0) * 100))
    : 0

  const progressItems = useMemo(() => [
    {
      name: 'Heart',
      val: vitals?.heartRate ? Math.min(100, vitals.heartRate) : 0,
      icon: Heart,
      color: '#EF5350'
    },
    {
      name: 'Energy',
      val: activity?.calories ? Math.min(100, Math.round((activity.calories / 2000) * 100)) : 0,
      icon: Zap,
      color: '#FF7043'
    },
    {
      name: 'Activity',
      val: activity?.steps ? Math.min(100, Math.round((activity.steps / 10000) * 100)) : 0,
      icon: Activity,
      color: '#66BB6A'
    }
  ], [vitals, activity])

  const activityData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weeklyData = days.map(d => ({ name: d, steps: 0 }))

    if (history.steps && history.steps.length > 0) {
      history.steps.forEach(item => {
        const dayIdx = new Date(item.timestamp).getDay()
        weeklyData[dayIdx].steps += item.value
      })
    } else if (activity?.steps) {
      const todayIdx = new Date().getDay()
      weeklyData[todayIdx].steps = activity.steps
    }

    return [...weeklyData.slice(1), weeklyData[0]]
  }, [history.steps, activity])

  const handleBiometricSync = async () => {
    setIsSyncing(true)
    try {
      await triggerSync()
      if (onStartTest) onStartTest()
    } catch (error) {
      console.error('[OverviewTab] Sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'low': return 'text-sh-green bg-sh-green/10 border-sh-green/20'
      case 'medium': return 'text-sh-orange bg-sh-orange/10 border-sh-orange/20'
      case 'high': return 'text-sh-red bg-sh-red/10 border-sh-red/20'
      default: return 'text-sh-sub bg-sh-bg border-sh-border'
    }
  }

  const getRiskIcon = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'low': return <CheckCircle2 className="w-6 h-6" />
      case 'medium': return <AlertTriangle className="w-6 h-6" />
      case 'high': return <AlertTriangle className="w-6 h-6" />
      default: return <Info className="w-6 h-6" />
    }
  }

  const profileImage = mounted && session?.user?.image ? session.user.image : null
  const getInitial = (name?: string | null) => name ? name.trim().charAt(0).toUpperCase() : '?'

  const riskColors = {
    low: { bg: 'bg-sh-green/10', text: 'text-sh-green', border: 'border-sh-green/20' },
    moderate: { bg: 'bg-sh-orange/10', text: 'text-sh-orange', border: 'border-sh-orange/20' },
    high: { bg: 'bg-sh-red/10', text: 'text-sh-red', border: 'border-sh-red/20' },
  }
  const riskStyle = riskColors[riskLevel as keyof typeof riskColors] || riskColors.low

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Vital Test Result Card */}
      {predictionResult && (
        <motion.div 
          variants={itemVariants}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-sh-green to-primary rounded-[32px] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
          <GlassCard className={cn("relative overflow-hidden", predictionResult.error ? "border-sh-red/20" : "border-sh-green/20")}>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl", predictionResult.error ? "bg-sh-red/10 text-sh-red" : "bg-sh-green/10 text-sh-green")}>
                      {predictionResult.error ? <AlertTriangle size={20} /> : <Zap size={20} fill="currentColor" />}
                    </div>
                    <h3 className="text-lg font-bold text-sh-text">
                      {predictionResult.error ? 'Analysis Failed' : 'AI Analysis Complete'}
                    </h3>
                  </div>
                  <button 
                    onClick={resetVitalStore}
                    className="text-xs font-bold text-sh-sub hover:text-sh-text transition-colors"
                  >
                    Clear Results
                  </button>
                </div>

                {predictionResult.error ? (
                  <div className="p-4 rounded-2xl bg-sh-red/5 border border-sh-red/10">
                    <div className="flex items-center gap-2 text-sh-red mb-2">
                      <AlertTriangle size={16} />
                      <span className="text-sm font-bold uppercase tracking-wider">Model Unavailable</span>
                    </div>
                    <p className="text-sm text-sh-text">{predictionResult.error}</p>
                    <p className="text-xs text-sh-sub mt-2">No biometric analysis could be performed. Session discarded.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className={cn("p-4 rounded-3xl border flex flex-col items-center justify-center text-center", getRiskColor(predictionResult.risk_status))}>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Risk Status</span>
                        {getRiskIcon(predictionResult.risk_status)}
                        <span className="text-xl font-black mt-1 capitalize">{predictionResult.risk_status}</span>
                      </div>

                      <div className="p-4 rounded-3xl bg-sh-bg border border-sh-border flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-sh-sub uppercase tracking-widest mb-2">Confidence</span>
                        <span className="text-2xl font-black text-sh-text">{((predictionResult.final_probability || predictionResult.probability || 0) * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-4 rounded-3xl bg-sh-bg border border-sh-border flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-sh-sub uppercase tracking-widest mb-2">Uncertainty</span>
                        <span className="text-2xl font-black text-sh-text">{(predictionResult.uncertainty * 100).toFixed(1)}%</span>
                      </div>

                      <div className="p-4 rounded-3xl bg-sh-bg border border-sh-border flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-sh-sub uppercase tracking-widest mb-2">Time</span>
                        <Clock className="w-6 h-6 text-sh-green mb-1" />
                        <span className="text-sm font-bold text-sh-text">Just Now</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        animate={isAskingAI ? { opacity: [0.7, 1, 0.7], transition: { repeat: Infinity, duration: 1.5 } } : {}}
                        onClick={handleAskAI}
                        disabled={isAskingAI}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all disabled:opacity-50 text-xs shadow-lg",
                          "bg-sh-green text-white shadow-sh-green/20"
                        )}
                      >
                        <Brain className={cn("w-4 h-4", isAskingAI && "animate-pulse")} />
                        {isAskingAI ? 'Consulting AI...' : 'Ask AI Insights'}
                      </motion.button>
                      <button
                        onClick={handleDownloadReport}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-sh-bg border border-sh-border text-sh-text rounded-xl font-bold hover:bg-sh-border/50 transition-all text-xs"
                      >
                        <FileDown className="w-4 h-4" />
                        Download Report
                      </button>
                    </div>

                    {predictionResult.flags && predictionResult.flags.length > 0 && (
                      <div className="p-4 rounded-2xl bg-sh-red/5 border border-sh-red/10">
                        <div className="flex items-center gap-2 text-sh-red mb-2">
                          <AlertTriangle size={16} />
                          <span className="text-xs font-bold uppercase tracking-wider">Warning Flags</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {predictionResult.flags.map((flag: string, i: number) => (
                            <span key={i} className="px-3 py-1 rounded-full bg-sh-red/10 text-sh-red text-[11px] font-bold">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="md:w-64 flex flex-col justify-between">
                <div className={cn("p-4 rounded-3xl text-white space-y-2 shadow-lg", predictionResult.error ? "bg-sh-red shadow-sh-red/20" : "bg-sh-green shadow-sh-green/20")}>
                  <h4 className="font-bold text-sm">Health Insight</h4>
                  <p className="text-xs text-white/90 leading-relaxed">
                    {predictionResult.error 
                      ? "System error prevents safe clinical analysis. Please try again later." 
                      : `Based on your rPPG signals and clinical data, your cardiac stability is ${predictionResult.risk_status === 'low' ? 'excellent' : 'monitored'}.`}
                  </p>
                </div>
                <button 
                  onClick={() => resetVitalStore()}
                  className="mt-4 w-full py-4 rounded-2xl bg-sh-bg border border-sh-border text-sh-text font-bold text-sm hover:bg-sh-border/50 transition-all flex items-center justify-center gap-2"
                >
                  Start New Test <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
      {/* Top row - 3 column grid on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Health Indicators */}
        <motion.div variants={itemVariants}>
          <GlassCard className="h-full">
            <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider mb-6">
              Health Indicators
            </h3>
            <div className="space-y-5">
              {progressItems.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.name} className="flex items-center gap-4 group cursor-pointer">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[15px] font-bold text-sh-text">{item.name}</span>
                        <span className="text-sm font-bold text-sh-sub">
                          {item.val}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-sh-bg rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.val}%` }}
                          transition={{ duration: 1.5, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </motion.div>

        {/* Column 2: Activity Rings + Risk Badge */}
        <motion.div variants={itemVariants} className="space-y-6">
          <GlassCard className="flex flex-col items-center justify-center overflow-hidden">
            <h3 className="text-[13px] font-bold text-sh-sub uppercase tracking-widest mb-8">
              Daily Activity
            </h3>
            {mounted ? (
              <ActivityRings
                steps={activity?.steps || 0}
                calories={activity?.calories || 0}
                exerciseMinutes={activity?.exerciseTime || 0}
              />
            ) : (
              <ActivityRingsSkeleton />
            )}
          </GlassCard>

          {/* Risk Assessment Badge */}
          <GlassCard padding="sm">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-[24px] flex items-center justify-center shadow-lg',
                riskStyle.bg,
                'border border-sh-border'
              )}>
                <Heart className={cn('w-8 h-8', riskStyle.text)} />
              </div>
              <div className="flex-1">
                <p className={cn('text-[15px] font-bold uppercase tracking-wider', riskStyle.text)}>
                  {riskLevel} Risk
                </p>
                <p className="text-xs font-bold text-sh-sub">AI Health Assessment</p>
              </div>
              <button className={cn(
                'px-6 py-2.5 rounded-[18px] text-[13px] font-bold',
                'bg-sh-green/10 text-sh-green',
                'hover:bg-sh-green hover:text-white transition-all duration-300 active:scale-95'
              )}>
                Detail
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Column 3: Profile + Activity Chart */}
        <motion.div variants={itemVariants} className="space-y-6 order-first lg:order-none">
          {/* Profile Card */}
          <GlassCard className="text-center">
            <div className="relative inline-block mb-4">
              <div className="w-28 h-28 rounded-full p-1.5 bg-gradient-to-br from-sh-green to-sh-green/60 shadow-lg shadow-sh-green/25 animate-sh-float">
                <div className="w-full h-full rounded-full bg-sh-card overflow-hidden p-1">
                  {profileImage ? (
                    <Image
                      src={profileImage}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-sh-green flex items-center justify-center">
                      <span className="text-4xl font-bold text-white">
                        {getInitial(session?.user?.name)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Health score badge */}
              <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-sh-green border-4 border-sh-card flex items-center justify-center shadow-lg">
                <span className="text-sm font-bold text-white">
                  {healthScore}
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-sh-text mb-1">
              {session?.user?.name || 'User'}
            </h2>
            <p className="text-sm font-bold text-sh-sub mb-8 uppercase tracking-widest">Premium Member</p>
            <button
              onClick={handleBiometricSync}
              disabled={isSyncing}
              className={cn(
                'w-full py-3 rounded-[20px]',
                'bg-sh-green shadow-lg shadow-sh-green/20',
                'text-white font-bold text-[14px]',
                'hover:shadow-xl hover:shadow-sh-green/30 hover:scale-[1.01]',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100',
                'transition-all duration-300 active:scale-95',
                'flex items-center justify-center gap-2.5'
              )}
            >
              {isSyncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                  </div>
                  Start Vitals Scan
                </>
              )}
            </button>
          </GlassCard>

          {/* Weekly Activity Chart */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider">
                Weekly Steps
              </h3>
              <div className="flex items-center gap-1 text-xs text-primary font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>This Week</span>
              </div>
            </div>
            <div className="h-32">
              <WeeklyActivityChart data={activityData} />
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Test History Section */}
      <motion.div variants={itemVariants} className="mt-6">
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-sh-text">Session History</h3>
            <div className="flex gap-4 text-sm">
              <div className="flex flex-col items-center">
                <span className="font-bold text-sh-text">{testHistory.length}</span>
                <span className="text-[11px] text-sh-sub uppercase tracking-wider">Total</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-sh-green">{testHistory.filter(t => t.status === 'success').length}</span>
                <span className="text-[11px] text-sh-sub uppercase tracking-wider">Success</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-sh-red">{testHistory.filter(t => t.status !== 'success').length}</span>
                <span className="text-[11px] text-sh-sub uppercase tracking-wider">Failed</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {testHistory.length === 0 ? (
              <div className="p-8 text-center text-sh-sub text-sm">
                No biometric scans recorded yet.
              </div>
            ) : (
              testHistory.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 rounded-2xl bg-sh-bg border border-sh-border hover:border-sh-green/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", session.status === 'success' ? "bg-sh-green/10 text-sh-green" : "bg-sh-red/10 text-sh-red")}>
                      {session.status === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-sh-text capitalize">
                        {session.status.replace('_', ' ')}
                      </p>
                      <p className="text-[11px] text-sh-sub">
                        {new Date(session.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {session.status === 'success' && session.metrics && (
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-sh-text">{session.metrics.hr?.toFixed(0) || '--'}</span>
                        <span className="text-[10px] text-sh-sub uppercase">BPM</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-sh-text">{((session.metrics.probability || 0) * 100).toFixed(0)}%</span>
                        <span className="text-[10px] text-sh-sub uppercase">Conf</span>
                      </div>
                      <div className={cn("px-3 py-1 rounded-full text-[11px] font-bold capitalize", getRiskColor(session.metrics.risk_status || 'low'))}>
                        {session.metrics.risk_status}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* AI Explanation Modal */}
      <AnimatePresence>
        {aiExplanation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-sh-card w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-[32px] border border-sh-border shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-sh-border flex justify-between items-center bg-sh-green/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sh-green/20 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-sh-green" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-sh-text">AI Clinical Insights</h3>
                    <p className="text-xs text-sh-sub">Powered by Gemini AI</p>
                  </div>
                </div>
                <button onClick={() => setAiExplanation(null)} className="p-2 hover:bg-sh-bg rounded-full transition-colors">
                  <X className="w-5 h-5 text-sh-text" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto text-sh-text leading-relaxed whitespace-pre-wrap text-sm">
                {aiExplanation}
              </div>

              <div className="p-6 bg-sh-bg border-t border-sh-border flex justify-end">
                <button 
                  onClick={() => setAiExplanation(null)}
                  className="px-8 py-2.5 bg-sh-green text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-sh-green/20"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
