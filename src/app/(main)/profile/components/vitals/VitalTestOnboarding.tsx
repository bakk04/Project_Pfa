'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  Activity, 
  Camera, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight,
  Info,
  ShieldCheck,
  Smartphone,
  HeartPulse,
  Info as InfoIcon,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Capacitor } from '@capacitor/core'
import { Health } from '@capgo/capacitor-health'

interface OnboardingProps {
  userData?: any
  onComplete: (data: any) => void
  onCancel: () => void
}

const steps = [
  {
    id: 'intro',
    title: 'Vital Sign Analysis',
    description: 'A 3-step clinical-grade health assessment using advanced rPPG technology.',
    icon: InfoIcon,
  },
  {
    id: 'personal',
    title: 'Personal Data',
    description: 'Verify your clinical profile for precise AI diagnostics.',
    icon: User,
  },
  {
    id: 'health',
    title: 'Health Connect',
    description: 'Sync your device health data for longitudinal context.',
    icon: Activity,
  },
  {
    id: 'rppg',
    title: 'Biometric Scan',
    description: 'Prepare for contactless vital sign measurement.',
    icon: Camera,
  }
]

export function VitalTestOnboarding({ userData, onComplete, onCancel }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  
  // REAL USER DATA from DB
  const [formData, setFormData] = useState({
    weight: 0,
    height: 0,
    gender: 0, // 1 for Male, 0 for Female
    smoking: false,
    diabetic: false,
    familyHistory: false,
    healthConnected: false
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    if (userData && userData.healthData) {
      setFormData(prev => ({
        ...prev,
        weight: userData.healthData.weight || 0,
        height: userData.healthData.height || 0,
        gender: userData.healthData.gender !== undefined ? userData.healthData.gender : 0,
        smoking: userData.healthData.smoking || false,
        diabetic: userData.healthData.diabetic || false,
        familyHistory: userData.healthData.familyHistory || false,
      }))
    }
  }, [userData])

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete(formData)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleHealthSync = async () => {
    setIsSyncing(true)
    setSyncError(null)

    if (!Capacitor.isNativePlatform()) {
      setSyncError('Native device required for true Health API integration.');
      setIsSyncing(false)
      return
    }

    try {
      // REAL CAPACITOR HEALTHKIT / GOOGLE FIT INTEGRATION
      await Health.requestAuthorization({
        read: ['heartRate', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'oxygenSaturation'] as any,
        write: []
      })

      setFormData(prev => ({ ...prev, healthConnected: true }))
    } catch (err: any) {      console.error('Health sync failed:', err)
      setSyncError('Failed to sync. Please ensure permissions are granted.')
    } finally {
      setIsSyncing(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-sh-bg border border-sh-border">
                <div className="w-12 h-12 rounded-xl bg-sh-green/10 flex items-center justify-center text-sh-green flex-shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sh-text text-[15px]">1. Clinical Baseline</h4>
                  <p className="text-[13px] text-sh-sub">Review your core physiological parameters.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-sh-bg border border-sh-border">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sh-text text-[15px]">2. Native Health Sync</h4>
                  <p className="text-[13px] text-sh-sub">Connect Apple HealthKit or Google Fit securely.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-sh-bg border border-sh-border">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sh-text text-[15px]">3. rPPG Optical Scan</h4>
                  <p className="text-[13px] text-sh-sub">10-second precise facial blood volume measurement.</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-sh-green/5 border border-sh-green/20 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-sh-green flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-sh-text/80 leading-relaxed">
                All data is processed strictly for this session and heavily encrypted following medical standards.
              </p>
            </div>
          </div>
        )
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-sh-sub uppercase tracking-wider pl-1">Weight (kg)</label>
                <input 
                  type="number" 
                  value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: parseFloat(e.target.value) || 0})}
                  className="w-full bg-sh-bg border-none rounded-2xl px-4 py-3 text-sh-text text-[15px] font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sh-green/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-sh-sub uppercase tracking-wider pl-1">Height (cm)</label>
                <input 
                  type="number" 
                  value={formData.height}
                  onChange={(e) => setFormData({...formData, height: parseFloat(e.target.value) || 0})}
                  className="w-full bg-sh-bg border-none rounded-2xl px-4 py-3 text-sh-text text-[15px] font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sh-green/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-sh-sub uppercase tracking-wider pl-1">Gender</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, gender: 1})}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold transition-all border-none outline-none",
                    formData.gender === 1 
                      ? "bg-sh-green text-white shadow-md shadow-sh-green/20" 
                      : "bg-sh-bg text-sh-text hover:bg-sh-bg/80"
                  )}
                >
                  <User className="w-4 h-4" />
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, gender: 0})}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold transition-all border-none outline-none",
                    formData.gender === 0 
                      ? "bg-sh-green text-white shadow-md shadow-sh-green/20" 
                      : "bg-sh-bg text-sh-text hover:bg-sh-bg/80"
                  )}
                >
                  <User className="w-4 h-4" />
                  Female
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-4 p-4 rounded-2xl bg-sh-bg shadow-sm cursor-pointer hover:bg-sh-bg/80 transition-all">
                <input 
                  type="checkbox" 
                  checked={formData.smoking}
                  onChange={(e) => setFormData({...formData, smoking: e.target.checked})}
                  className="w-5 h-5 rounded-md border-gray-300 text-sh-green focus:ring-sh-green accent-sh-green"
                />
                <span className="text-[15px] font-medium text-sh-text">Current Smoker</span>
              </label>
              
              <label className="flex items-center gap-4 p-4 rounded-2xl bg-sh-bg shadow-sm cursor-pointer hover:bg-sh-bg/80 transition-all">
                <input 
                  type="checkbox" 
                  checked={formData.diabetic}
                  onChange={(e) => setFormData({...formData, diabetic: e.target.checked})}
                  className="w-5 h-5 rounded-md border-gray-300 text-sh-green focus:ring-sh-green accent-sh-green"
                />
                <span className="text-[15px] font-medium text-sh-text">Diabetic</span>
              </label>

              <label className="flex items-center gap-4 p-4 rounded-2xl bg-sh-bg shadow-sm cursor-pointer hover:bg-sh-bg/80 transition-all">
                <input 
                  type="checkbox" 
                  checked={formData.familyHistory}
                  onChange={(e) => setFormData({...formData, familyHistory: e.target.checked})}
                  className="w-5 h-5 rounded-md border-gray-300 text-sh-green focus:ring-sh-green accent-sh-green"
                />
                <span className="text-[15px] font-medium text-sh-text">Family History of Heart Disease</span>
              </label>
            </div>

            <div className="p-4 rounded-2xl bg-sh-bg flex gap-3 text-sh-sub text-[12px] items-center">
              <InfoIcon className="w-4 h-4 flex-shrink-0" />
              <span>We pre-filled this data from your profile. Update it if needed.</span>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-6">
            <div 
              className={cn(
                "p-6 rounded-[28px] transition-all duration-300 cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left",
                formData.healthConnected 
                  ? "bg-sh-green text-white shadow-lg shadow-sh-green/20" 
                  : "bg-sh-bg shadow-sm hover:bg-sh-bg/80"
              )}
              onClick={!formData.healthConnected && !isSyncing ? handleHealthSync : undefined}
            >
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-[20px] flex items-center justify-center transition-colors",
                  formData.healthConnected ? "bg-white/20 text-white" : "bg-sh-green/10 text-sh-green"
                )}>
                  <HeartPulse className={cn("w-8 h-8", isSyncing && "animate-pulse")} />
                </div>
                <div>
                  <h4 className={cn("font-bold text-[17px]", formData.healthConnected ? "text-white" : "text-sh-text")}>
                    Apple Health / Google Fit
                  </h4>
                  <p className={cn("text-[13px]", formData.healthConnected ? "text-white/80" : "text-sh-sub")}>
                    Import resting heart rate & BP natively
                  </p>
                </div>
              </div>
              {formData.healthConnected ? (
                <CheckCircle2 className="w-8 h-8 text-white" />
              ) : isSyncing ? (
                <div className="w-8 h-8 rounded-full border-2 border-sh-green border-t-transparent animate-spin" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-sh-green/20"></div>
                </div>
              )}
            </div>

            {syncError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-[13px] text-red-500 font-bold">{syncError}</p>
              </div>
            )}

            <div className="space-y-4 pt-4">
              <div className="flex gap-4">
                <ShieldCheck className="w-5 h-5 text-sh-green flex-shrink-0" />
                <div>
                  <h5 className="text-[14px] font-bold text-sh-text">Secure Native Integration</h5>
                  <p className="text-[13px] text-sh-sub mt-1 leading-relaxed">Processed entirely on-device through secure OS channels. No data is stored externally.</p>
                </div>
              </div>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-6">
            <div className="aspect-video rounded-[28px] bg-gray-900 overflow-hidden relative group shadow-inner">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-sh-green/20 rounded-full animate-ping" />
                  <div className="w-20 h-20 rounded-full bg-sh-green/20 border border-sh-green/50 flex items-center justify-center backdrop-blur-sm z-10">
                    <Camera className="w-8 h-8 text-sh-green" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-black/60 backdrop-blur-md">
                <p className="text-[13px] text-white/90 text-center font-medium">
                  We will redirect you to the secure monitoring portal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Keep device steady',
                'Ensure bright lighting',
                'Remove glasses/hats',
                'Breathe naturally'
              ].map((tip, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-sh-bg shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-sh-green/10 flex items-center justify-center text-[11px] font-bold text-sh-green">
                    {i + 1}
                  </div>
                  <span className="text-[13px] text-sh-text font-semibold">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 lg:p-6 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-[540px] bg-[#f8f9fa] rounded-[36px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 bg-white z-10 sticky top-0 rounded-b-[32px] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[18px] bg-sh-green/10 flex items-center justify-center text-sh-green">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-gray-900 tracking-tight">Vital Test</h2>
                <p className="text-[13px] text-gray-500 font-medium">Step {currentStep + 1} of {steps.length}</p>
              </div>
            </div>
            <button 
              onClick={onCancel}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-all border-none outline-none focus:outline-none"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-500",
                  i <= currentStep ? "bg-sh-green" : "bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="mb-8 text-center sm:text-left">
                <h3 className="text-[26px] font-bold text-gray-900 mb-2 tracking-tight">{steps[currentStep].title}</h3>
                <p className="text-gray-500 text-[15px] leading-relaxed">{steps[currentStep].description}</p>
              </div>
              
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-white flex items-center justify-between sticky bottom-0 rounded-t-[32px] shadow-[0_-4px_20px_rgba(0,0,0,0.03)] border-t border-gray-100">
          <button
            onClick={prevStep}
            className={cn(
              "min-w-[140px] px-8 py-4 rounded-full text-[15px] font-bold transition-all duration-300 border-none outline-none focus:outline-none",
              currentStep === 0 ? "opacity-0 pointer-events-none" : "text-gray-500 bg-gray-100 hover:text-gray-700 hover:bg-gray-200"
            )}
          >
            Back
          </button>
          
          <button
            onClick={nextStep}
            className="min-w-[140px] flex items-center justify-center gap-2 px-8 py-4 bg-sh-green text-white rounded-full font-bold text-[15px] shadow-sm hover:bg-[#2db555] active:scale-[0.98] transition-all duration-300 border-none outline-none"
          >
            <span>{currentStep === steps.length - 1 ? 'Start Scan' : currentStep === 2 && !formData.healthConnected ? 'Skip / Next' : 'Next Step'}</span>
            {currentStep === steps.length - 1 ? <ChevronRight size={18} /> : <ArrowRight size={18} />}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
