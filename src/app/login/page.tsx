'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import styles from './login.module.css';
import {
  Mail,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader,
  ArrowRight,
} from 'lucide-react';

import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface ErrorState {
  email?: string;
  password?: string;
  general?: string;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  
  const [form, setForm] = useState<FormData>({
    email: '',
    password: '',
    rememberMe: false
  });

  const [errors, setErrors] = useState<ErrorState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { status } = useSession();

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = (session.user as any).role;
      if (role === 'admin') {
        router.replace('/dashboardAdmin');
      } else {
        router.replace('/profile');
      }
    }
  }, [status, session, router]);
  
  // Manage body styles to prevent double scrollbars
  useEffect(() => {
    const originalOverflowX = document.body.style.overflowX;
    const originalHeight = document.body.style.height;
    
    document.body.style.overflowX = 'hidden';
    document.body.style.height = 'auto';
    
    return () => {
      document.body.style.overflowX = originalOverflowX;
      document.body.style.height = originalHeight;
    };
  }, []);

  const [showSuccess, setShowSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  // Handle URL errors (e.g. from Google OAuth restriction)
  useEffect(() => {
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        'Configuration': 'There is a problem with the server configuration.',
        'AccessDenied': 'Access denied. You do not have permission to view this page.',
        'Verification': 'Verification failed. Please try again.',
        'OAuthSignin': 'Error starting the Google sign-in process.',
        'OAuthCallback': 'Error completing the Google sign-in process.',
        'OAuthCreateAccount': 'Could not create a user account with Google.',
        'EmailCreateAccount': 'Could not create a user account with email.',
        'Callback': 'Error during the authentication callback.',
        'OAuthAccountNotLinked': 'Email already exists with a different provider.',
        'EmailSignin': 'Check your email for a sign-in link.',
        'CredentialsSignin': 'Invalid email or password.',
        'SessionRequired': 'Please sign in to access this page.',
        'NO_ACCOUNT_FOUND': 'No account found. Only registered users can sign in with Google.',
        'default': 'An unexpected error occurred. Please try again.'
      };
      setErrors(prev => ({ 
        ...prev, 
        general: errorMessages[errorParam] || errorMessages.default 
      }));
    }
  }, [errorParam]);

  // Performance Optimization: Lazy load video and pause when inactive
  useEffect(() => {
    // Focus email input on mount
    if (emailInputRef.current && !errorParam) {
        emailInputRef.current.focus();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVideoVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    const leftPanel = document.querySelector(`.${styles.leftPanel}`);
    if (leftPanel) observer.observe(leftPanel);

    const handleVisibilityChange = () => {
      if (videoRef.current) {
        if (document.hidden) {
          videoRef.current.pause();
        } else if (isVideoVisible) {
          videoRef.current.play().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isVideoVisible, errorParam]);

  useEffect(() => {
    if (videoRef.current) {
      if (isVideoVisible) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVideoVisible]);

  const set = (field: keyof FormData, value: string | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
    // Clear general error when user starts typing
    if (errors.general) setErrors(e => ({ ...e, general: '' }));
  };

  const validateForm = (): boolean => {
    const newErrors: ErrorState = {};

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: form.email,
        password: form.password,
      });

      if (result?.error) {
        setErrors({ general: result.error });
        setIsLoading(false);
      } else {
        setSuccessMessage(`Welcome back! Logging in...`);
        setShowSuccess(true);
        // The useEffect above will handle the redirection once the session is updated
        setTimeout(() => {
          router.refresh();
        }, 1000);
      }
    } catch (error) {
      setErrors({
        general: 'Login failed. Please try again.'
      });
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
        await signIn('google', { callbackUrl: '/profile', redirect: true });
    } catch (error) {
        setErrors({ general: 'Google login failed' });
        setIsLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Left Side - Video Background */}
      <div className={styles.leftPanel}>
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className={styles.videoBackground}
        >
          <source src="/assets/img/login.mp4" type="video/mp4" />
        </video>
        <div className={styles.videoOverlay}></div>
        
        <div className={styles.leftContent}>
          <h1 className={styles.siteName}>Sehati AI</h1>
          <div className={styles.taglineWrapper}>
            <p className={styles.siteTagline}>First AI Model for Moroccan Diabetes</p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className={styles.rightPanel}>
        <div className={styles.formRoot}>
          {/* Header */}
          <div className={styles.loginHeader}>
            <h1 className={styles.mainTitle}>Welcome Back</h1>
            <p className={styles.mainSubtitle}>Enter your details to access your account</p>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className={styles.successBanner}>
              <CheckCircle2 size={20} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className={styles.formCard}>
            {/* Email Field */}
            <div className={`${styles.field} ${errors.email ? styles.fieldErr : ''}`}>
              <label className={styles.label} htmlFor="email">Email Address</label>
              <div className={styles.inputIcon}>
                <Mail size={18} />
                <input
                  id="email"
                  ref={emailInputRef}
                  type="email"
                  className={styles.input}
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <span className={styles.errMsg}>
                  <AlertTriangle size={14} /> {errors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className={`${styles.field} ${errors.password ? styles.fieldErr : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className={styles.label} htmlFor="password">Password</label>
                <a href="#" className={styles.forgotLink} style={{ fontSize: '0.8rem', color: '#049ebb', fontWeight: 600, textDecoration: 'none', marginBottom: '0.6rem' }}>Forgot password?</a>
              </div>
              <div className={styles.inputIcon}>
                <Lock size={18} />
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <span className={styles.errMsg}>
                  <AlertTriangle size={14} /> {errors.password}
                </span>
              )}
            </div>

            {/* Remember Me */}
            <div className={styles.checkRow} onClick={() => set('rememberMe', !form.rememberMe)}>
              <div className={`${styles.checkbox} ${form.rememberMe ? styles.checked : ''}`}>
                {form.rememberMe && <CheckIcon size={14} color="white" />}
              </div>
              <span>Remember me for 30 days</span>
            </div>

            {/* General Error */}
            {errors.general && (
              <div className={styles.errorBanner}>
                <AlertTriangle size={18} />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              className={styles.loginBtn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader size={20} className={styles.spinner} />
                  Processing...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            {/* Divider */}
            <div className={styles.divider}>
              <span>or sign in with</span>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          </form>

          {/* Footer */}
          <div className={styles.footer}>
            <p>
              Don't have an account?{' '}
              <Link href="/register" className={styles.signupLink}>
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.loadingOverlay}><Loader className={styles.spinner} /></div>}>
      <LoginContent />
    </Suspense>
  );
}

const CheckIcon = ({ size, color }: { size: number; color: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

