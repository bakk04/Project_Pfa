import type { Metadata } from "next";
import "./globals.css";
import InitScripts from "@/components/InitScripts";
import { Providers } from "@/components/Providers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Script from "next/script";
import { Roboto, Lato, Raleway } from 'next/font/google';
import BodyClassManager from "@/components/BodyClassManager";

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

const lato = Lato({
  subsets: ['latin'],
  weight: ['100', '300', '400', '700', '900'],
  variable: '--font-lato',
  display: 'swap',
});

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-raleway',
  display: 'swap',
});

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

  return (
    <html lang="en" suppressHydrationWarning className={`${roboto.variable} ${lato.variable} ${raleway.variable}`}>
      <head>
        {/* Favicons */}
        <link href="/assets/img/favicon.png" rel="icon" />
        <link href="/assets/logo/icon_512.png" rel="apple-touch-icon" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#007bff" />

        {/* Vendor CSS Files */}
        <link href="/assets/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" />
        <link href="/assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet" />
        <link href="/assets/vendor/aos/aos.css" rel="stylesheet" />
        <link href="/assets/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" />
        <link href="/assets/vendor/swiper/swiper-bundle.min.css" rel="stylesheet" />
        <link href="/assets/vendor/glightbox/css/glightbox.min.css" rel="stylesheet" />
        
        {/* Main CSS File */}
        <link href="/assets/css/main.css" rel="stylesheet" />
      </head>
      <body>
        <BodyClassManager />
        <Providers session={session}>
          {children}
        </Providers>

        {/* Vendor Scripts */}
        <Script src="/assets/vendor/bootstrap/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
        <Script src="/assets/vendor/aos/aos.js" strategy="afterInteractive" />
        <Script src="/assets/vendor/purecounter/purecounter_vanilla.js" strategy="afterInteractive" />
        <Script src="/assets/vendor/swiper/swiper-bundle.min.js" strategy="afterInteractive" />
        <Script src="/assets/vendor/imagesloaded/imagesloaded.pkgd.min.js" strategy="afterInteractive" />
        <Script src="/assets/vendor/isotope-layout/isotope.pkgd.min.js" strategy="afterInteractive" />
        <Script src="/assets/vendor/glightbox/js/glightbox.min.js" strategy="afterInteractive" />

        {/* Main JS File */}
        <Script src="/assets/js/main.js" strategy="afterInteractive" />
        
        {/* AI Chatbot Integration */}
        <Script src="https://cdn.botpress.cloud/webchat/v3.6/inject.js" strategy="afterInteractive" />
        <Script src="https://files.bpcontent.cloud/2025/05/04/18/20250504180130-B20D7SC3.js" strategy="afterInteractive" defer />

        {/* React Re-initializer for Route Changes */}
        <InitScripts />
      </body>
    </html>
  );
}
