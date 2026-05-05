import '@/styles/samsung-health.css'

export const metadata = {
  title: 'Profile | Sehati Medical Intelligence Dashboard',
  description: 'AI-powered health monitoring and biometric analysis',
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Bootstrap CSS Dependencies */}
      <link rel="stylesheet" href="/dashboard/css/vendors_css.css" />
      <link rel="stylesheet" href="/dashboard/css/style.css" />
      <link rel="stylesheet" href="/dashboard/css/skin_color.css" />
      <link rel="stylesheet" href="/dashboard/css/custom.css" />
      
      <div className="samsung-health-dashboard min-h-screen bg-background">
        {children}
      </div>
    </>
  )
}
