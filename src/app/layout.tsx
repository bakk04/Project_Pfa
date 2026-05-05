import type { Metadata } from "next";
import "./globals.css";
import InitScripts from "@/components/InitScripts";
import { Providers } from "@/components/Providers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Sehati - Smart AI-Powered Diabetes Detection",
  description: "Sehati is an advanced, smart AI-powered diabetes detection platform providing state-of-the-art medical care.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || "";
  const isProfile = pathname.startsWith('/profile');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicons */}
        <link href="/assets/img/favicon.png" rel="icon" />
        <link href="/assets/img/apple-touch-icon.png" rel="apple-touch-icon" />

        {/* Fonts */}
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link href="https://fonts.gstatic.com" rel="preconnect" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Raleway:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />

        {/* Vendor CSS Files - Standard tags in head for immediate rendering */}
        <link href="/assets/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" />
        <link href="/assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet" />
        <link href="/assets/vendor/aos/aos.css" rel="stylesheet" />
        <link href="/assets/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" />
        <link href="/assets/vendor/swiper/swiper-bundle.min.css" rel="stylesheet" />
        <link href="/assets/vendor/glightbox/css/glightbox.min.css" rel="stylesheet" />
        
        {/* Main CSS File */}
        <link href="/assets/css/main.css" rel="stylesheet" />
      </head>
      <body className={isProfile ? "hold-transition light-skin sidebar-mini theme-primary profile-dashboard-active" : "index-page"}>
        <Providers session={session}>
          {children}
        </Providers>

        {/* Vendor Scripts */}
        <script src="/assets/vendor/bootstrap/js/bootstrap.bundle.min.js" defer></script>
        <script src="/assets/vendor/aos/aos.js" defer></script>
        <script src="/assets/vendor/purecounter/purecounter_vanilla.js" defer></script>
        <script src="/assets/vendor/swiper/swiper-bundle.min.js" defer></script>
        <script src="/assets/vendor/imagesloaded/imagesloaded.pkgd.min.js" defer></script>
        <script src="/assets/vendor/isotope-layout/isotope.pkgd.min.js" defer></script>
        <script src="/assets/vendor/glightbox/js/glightbox.min.js" defer></script>

        {/* Main JS File */}
        <script src="/assets/js/main.js" defer></script>
        
        {/* React Re-initializer for Route Changes */}
        <InitScripts />
      </body>
    </html>
  );
}
