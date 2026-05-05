import '@/styles/samsung-health.css'
import StyleSheetLoader from '@/components/StyleSheetLoader'

export const metadata = {
  title: 'Profile | Sehati Medical Intelligence Dashboard',
  description: 'AI-powered health monitoring and biometric analysis',
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profileStyles = [
    "/dashboard/css/vendors_css.css",
    "/dashboard/css/style.css",
    "/dashboard/css/skin_color.css",
    "/dashboard/css/custom.css"
  ];

  return (
    <>
      <StyleSheetLoader hrefs={profileStyles} />
      
      <div className="samsung-health-dashboard min-h-screen bg-background">
        {children}
      </div>
    </>
  )
}
