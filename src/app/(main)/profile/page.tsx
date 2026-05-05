'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useHealthData } from '@/hooks/useHealthData'
import { cn } from '@/lib/utils'

import { ModernSidebar, TabType } from './components/navigation/ModernSidebar'
import { ModernHeader } from './components/navigation/ModernHeader'
import { BottomNav } from './components/navigation/BottomNav'

import { OverviewTab } from './components/views/OverviewTab'
import { HealthDataTab } from './components/views/HealthDataTab'
import { PredictionTab } from './components/views/PredictionTab'
import { RppgTab } from './components/views/RppgTab'
import { SourcesTab } from './components/views/SourcesTab'
import { ChatTab } from './components/views/ChatTab'
import { VitalTestOnboarding } from './components/vitals/VitalTestOnboarding'
import { useVitalStore } from '@/store/vital-store'

export default function ProfilePage() {
  const { data: session } = useSession()
  const [userData, setUserData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const setOnboardingData = useVitalStore((state) => state.setOnboardingData)
  const { triggerSync } = useHealthData()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize userData with session data if available
  useEffect(() => {
    if (session?.user && !userData) {
      setUserData({
        _id: session.user.id,
        firstName: session.user.name?.split(' ')[0] || '',
        lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
        email: session.user.email,
        profileImage: session.user.image
      })
    }
  }, [session, userData])

  useEffect(() => {
    if (isSidebarCollapsed) {
      document.body.classList.add('sidebar-collapse')
    } else {
      document.body.classList.remove('sidebar-collapse')
    }
    if (isSidebarOpenMobile) {
      document.body.classList.add('sidebar-open')
    } else {
      document.body.classList.remove('sidebar-open')
    }
  }, [isSidebarCollapsed, isSidebarOpenMobile])

  useEffect(() => {
    const initializeHealth = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setUserData(data)
        }
        await triggerSync()
      } catch (error) {
        console.error('[ProfilePage] Failed to initialize health data:', error)
      }
    }
    initializeHealth()
  }, [triggerSync])

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsSidebarCollapsed(!isSidebarCollapsed)
    } else {
      setIsSidebarOpenMobile(!isSidebarOpenMobile)
    }
  }

  const router = useRouter()
  
  const handleStartTest = () => {
    setIsOnboardingOpen(true)
  }

  const handleOnboardingComplete = (data: any) => {
    setOnboardingData({
      ...data,
      patient_id: userData?._id,
      clinical_data: {
        weight: data.weight || userData?.healthData?.weight,
        height: data.height || userData?.healthData?.height,
        smoking: data.smoking ?? userData?.healthData?.smoking,
        diabetic: data.diabetic ?? userData?.healthData?.diabetic,
        familyHistory: data.familyHistory ?? userData?.healthData?.familyHistory,
        dateOfBirth: userData?.dateOfBirth,
        firstName: userData?.firstName,
        lastName: userData?.lastName,
        email: userData?.email
      }
    })
    setIsOnboardingOpen(false)
    router.push('/monitor')
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':   return <OverviewTab   key="overview"   onStartTest={handleStartTest} />
      case 'health':     return <HealthDataTab key="health" />
      case 'prediction': return <PredictionTab key="prediction" />
      case 'rppg':       return <RppgTab       key="rppg" />
      case 'sources':    return <SourcesTab    key="sources" />
      case 'chat':       return <ChatTab       key="chat" />
      default:           return <OverviewTab   key="overview"   onStartTest={handleStartTest} />
    }
  }

  return (
    <>
      <ModernHeader onToggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
      <ModernSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        isCollapsed={isSidebarCollapsed}
        isOpen={mounted ? (isSidebarOpenMobile || window.innerWidth >= 1024) : false}
        onClose={() => setIsSidebarOpenMobile(false)}
      />

      {/* Onboarding Overlay */}
      {isOnboardingOpen && (
        <VitalTestOnboarding 
          userData={userData}
          onComplete={handleOnboardingComplete} 
          onCancel={() => setIsOnboardingOpen(false)} 
        />
      )}

      {/* Content Wrapper */}
      <div
        className={cn(
          "content-wrapper !min-h-screen transition-all duration-400 cubic-bezier(0.32, 0.72, 0, 1)",
          "lg:!ml-[280px]",
          isSidebarCollapsed && "lg:!ml-[80px]",
          "!ml-0"
        )}
        style={{
          overflowX: 'hidden',
          backgroundColor: 'var(--sh-bg)',
        }}
      >
        <div className="container-full">
          <section className="content !p-0">
            <div className="p-4 sm:p-6 lg:p-8">
              {renderTabContent()}
            </div>
          </section>
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </>
  )
}
