'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image'

export function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session || !session.user) return null;

  const user = session.user;
  const imageUrl = user.image;
  // Get first initial
  const firstInitial = user.name ? user.name.split(' ')[0][0].toUpperCase() : 'U';

  return (
    <div className="user-menu-wrapper" ref={menuRef} style={{ position: 'relative', marginLeft: '20px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="avatar-trigger"
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: isHovered 
            ? 'linear-gradient(135deg, var(--accent-color) 0%, #038fa3 100%)' 
            : 'var(--accent-color)',
          color: 'white',
          border: '3px solid rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer',
          boxShadow: isHovered 
            ? '0 4px 15px rgba(4, 158, 187, 0.4)' 
            : '0 2px 8px rgba(0, 0, 0, 0.12)',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          padding: '0',
          overflow: 'hidden',
          transform: isHovered ? 'scale(1.1) translateY(-1px)' : 'scale(1)',
          outline: 'none'
        }}
      >
        {imageUrl ? (
          <Image src={imageUrl} alt={user.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ letterSpacing: '0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{firstInitial}</span>
        )}
      </button>

      {isOpen && (
        <div 
          className="user-dropdown-menu"
          style={{
            position: 'absolute',
            top: '130%',
            right: '0',
            backgroundColor: 'white',
            minWidth: '240px',
            boxShadow: '0 10px 40px rgba(24, 68, 76, 0.15)',
            borderRadius: '12px',
            padding: '8px',
            zIndex: 1000,
            border: '1px solid rgba(4, 158, 187, 0.08)',
            animation: 'dropdownFadeIn 0.3s cubic-bezier(0.23, 1, 0.32, 1)'
          }}
        >
          {/* Header Info */}
          <div style={{ 
            padding: '12px 16px', 
            background: 'linear-gradient(to bottom, #f8fdfd, #ffffff)',
            borderRadius: '8px',
            marginBottom: '8px',
            borderBottom: '1px solid #f0f7f8'
          }}>
            <div style={{ 
              fontWeight: '700', 
              color: 'var(--heading-color)', 
              fontSize: '14px', 
              marginBottom: '2px'
            }}>
                {user.name}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--nav-color)', 
              opacity: 0.8,
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis' 
            }}>
                {user.email}
            </div>
          </div>
          
          <div className="menu-items">
            <Link 
              href={(user as any).role === 'admin' ? "/dashboardAdmin" : "/profile"} 
              className="dropdown-link"
              onClick={() => setIsOpen(false)}
              style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px', 
                  color: '#444', 
                  textDecoration: 'none', 
                  fontSize: '14px', 
                  borderRadius: '6px',
                  transition: '0.2s ease'
              }}
            >
              <i className="bi bi-speedometer2 me-3" style={{ fontSize: '18px', color: 'var(--accent-color)' }}></i> 
              <span style={{ fontWeight: '500' }}>Dashboard</span>
            </Link>
            
            {(user as any).role !== 'admin' && (
              <Link 
                href="/profile" 
                className="dropdown-link"
                onClick={() => setIsOpen(false)}
                style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px', 
                    color: '#444', 
                    textDecoration: 'none', 
                    fontSize: '14px', 
                    borderRadius: '6px',
                    transition: '0.2s ease'
                }}
              >
                <i className="bi bi-heart-pulse me-3" style={{ fontSize: '18px', color: 'var(--accent-color)' }}></i> 
                <span style={{ fontWeight: '500' }}>Health Monitor</span>
              </Link>
            )}
          </div>

          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
            <button 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="dropdown-logout"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                width: '100%', 
                textAlign: 'left', 
                padding: '10px 16px', 
                color: '#e63946', 
                background: 'none', 
                border: 'none', 
                fontSize: '14px', 
                cursor: 'pointer',
                borderRadius: '6px',
                transition: '0.2s ease'
              }}
            >
              <i className="bi bi-box-arrow-right me-3" style={{ fontSize: '18px' }}></i> 
              <span style={{ fontWeight: '600' }}>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(15px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dropdown-link:hover {
          background-color: #f0f9fa !important;
          color: var(--accent-color) !important;
          transform: translateX(4px);
        }
        .dropdown-logout:hover {
          background-color: #fff1f2 !important;
          color: #be123c !important;
        }
      `}</style>
    </div>
  );
}
