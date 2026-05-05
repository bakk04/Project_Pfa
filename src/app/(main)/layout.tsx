"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { usePathname } from "next/navigation";
import Link from "next/link"

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isProfilePage = pathname?.startsWith('/profile');

  if (isProfilePage) {
    return <div className="profile-root-layout">{children}</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
      
      {/* Scroll Top */}
      <Link href="#" id="scroll-top" className="scroll-top d-flex align-items-center justify-content-center">
        <i className="bi bi-arrow-up-short"></i>
      </Link>
    </div>
  );
}
