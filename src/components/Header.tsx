"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useSession, signOut } from "next-auth/react";
import { UserMenu } from "./UserMenu";

export default function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isMobileNavActive, setIsMobileNavActive] = useState(false);

  // Handle active class
  const isActive = (path: string) => pathname === path ? "active" : "";

  // Set mounted state to true after component mounts on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setIsMobileNavActive(false);
  }, [pathname]);

  // Sync mobile-nav-active class with body
  useEffect(() => {
    if (isMobileNavActive) {
      document.body.classList.add('mobile-nav-active');
    } else {
      document.body.classList.remove('mobile-nav-active');
    }
  }, [isMobileNavActive]);

  const toggleMobileNav = () => {
    setIsMobileNavActive(!isMobileNavActive);
  };

  useEffect(() => {
    // Dropdowns still need manual logic because they are part of the template's structure
    const dropdowns = document.querySelectorAll('.navmenu .toggle-dropdown');
    dropdowns.forEach(navmenu => {
      const handleClick = function(e: Event) {
        e.preventDefault();
        (this as HTMLElement).parentNode?.classList.toggle('active');
        const nextEl = (this as HTMLElement).parentNode?.nextElementSibling;
        if (nextEl) nextEl.classList.toggle('dropdown-active');
        e.stopImmediatePropagation();
      };
      navmenu.addEventListener('click', handleClick);
    });
  }, [pathname]);

  return (
    <header id="header" className="header d-flex align-items-center fixed-top">
      <div className="header-container container-fluid container-xl position-relative d-flex align-items-center justify-content-between">
        <Link href="/" className="logo d-flex align-items-center me-auto me-xl-0">
          <svg className="my-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g id="bgCarrier" strokeWidth="0"></g>
            <g id="tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="iconCarrier">
              <path d="M22 22L2 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path d="M17 22V6C17 4.11438 17 3.17157 16.4142 2.58579C15.8284 2 14.8856 2 13 2H11C9.11438 2 8.17157 2 7.58579 2.58579C7 3.17157 7 4.11438 7 6V22" stroke="currentColor" strokeWidth="1.5"></path>
              <path opacity="0.5" d="M21 22V8.5C21 7.09554 21 6.39331 20.6629 5.88886C20.517 5.67048 20.3295 5.48298 20.1111 5.33706C19.6067 5 18.9045 5 17.5 5" stroke="currentColor" strokeWidth="1.5"></path>
              <path opacity="0.5" d="M3 22V8.5C3 7.09554 3 6.39331 3.33706 5.88886C3.48298 5.67048 3.67048 5.48298 3.88886 5.33706C4.39331 5 5.09554 5 6.5 5" stroke="currentColor" strokeWidth="1.5"></path>
              <path d="M12 22V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M10 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M5.5 11H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M5.5 14H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M17 11H18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M17 14H18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M5.5 8H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M17 8H18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path opacity="0.5" d="M10 15H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
              <path d="M12 9V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M14 7L10 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
            </g>
          </svg>
          <h1 className="sitename">Sehati</h1>
        </Link>

        <nav id="navmenu" className="navmenu">
          <ul>
            <li><Link href="/" className={isActive("/")}>Home</Link></li>
            <li><Link href="/about" className={isActive("/about")}>About</Link></li>
            <li><Link href="/services" className={isActive("/services")}>Services</Link></li>
            
            {/* Common Authenticated Link */}
            {status === "authenticated" && (
              <li><Link href="/monitor" className={isActive("/monitor")}>Monitor</Link></li>
            )}

            {/* Desktop Dashboard Link */}
            {status === "authenticated" && (
              <li className="d-none d-xl-block">
                <Link 
                  href={(session?.user as any)?.role === 'admin' ? "/dashboardAdmin" : "/profile"} 
                  className={isActive((session?.user as any)?.role === 'admin' ? "/dashboardAdmin" : "/profile")}
                >
                  Dashboard
                </Link>
              </li>
            )}

            {/* Mobile Auth Links */}
            {status === "authenticated" && (
              <>
                <li className="d-xl-none">
                  <Link 
                    href={(session?.user as any)?.role === 'admin' ? "/dashboardAdmin" : "/profile"} 
                    className={isActive((session?.user as any)?.role === 'admin' ? "/dashboardAdmin" : "/profile")}
                  >
                    My Dashboard
                  </Link>
                </li>
                <li className="d-xl-none"><a href="#" onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</a></li>
              </>
            )}
            
            {status === "unauthenticated" && (
              <li className="d-xl-none"><Link href="/login">Login</Link></li>
            )}

            <li className="dropdown"><a href="#"><span>Resources</span> <i className="bi bi-chevron-down toggle-dropdown"></i></a>
              <ul>
                <li><Link href="/faq" className={isActive("/faq")}>FAQ</Link></li>
                <li><Link href="/terms">Terms</Link></li>
                <li><Link href="/privacy">Privacy</Link></li>
              </ul>
            </li>
            <li><Link href="/contact" className={isActive("/contact")}>Contact</Link></li>
          </ul>
          <i 
            className={`mobile-nav-toggle d-xl-none bi ${isMobileNavActive ? 'bi-x' : 'bi-list'}`}
            onClick={toggleMobileNav}
          ></i>
        </nav>

        <div key={status} className="auth-section d-none d-xl-flex" style={{ display: 'flex', alignItems: 'center', minWidth: '80px', justifyContent: 'flex-end' }}>
            {status === "loading" ? (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f0f0f0', border: '2px solid #e0e0e0', animation: 'pulse 1.5s infinite' }}></div>
            ) : status === "authenticated" ? (
                <UserMenu />
            ) : (
                <Link className="btn-getstarted" href="/login">Login</Link>
            )}
        </div>
        <style jsx>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
    </header>
  );
}
