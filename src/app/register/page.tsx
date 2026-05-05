'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './register.module.css';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Cake,
  Scale,
  Ruler,
  Cigarette,
  CigaretteOff,
  Stethoscope,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Heart,
  Syringe,
  Sparkles,
  PartyPopper,
  ShieldCheck,
  CheckCircle2,
  Circle,
  ArrowRight,
  Dna,
  Cpu,
  Activity,
  UserPlus
} from 'lucide-react';

// Professional Moroccan Flag SVG Component
const MoroccoFlag = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size * 0.66} viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px' }}>
    <rect width="900" height="600" fill="#c1272d"/>
    <path d="M450 128.4l51.5 158.4H668L533.1 385.2l51.5 158.4L450 445.2l-134.6 98.4 51.5-158.4L232 286.8h166.5z" fill="none" stroke="#006233" strokeWidth="26"/>
  </svg>
);


// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'welcome' | 'basic' | 'dob' | 'physical' | 'health' | 'confirm' | 'analysis';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  dateOfBirth: string;
  weight: string;
  height: string;
  smoking: string;
  diabetic: string;
  familyHistory: string;
}

interface ZodiacInfo {
  sign: string;
  symbol: string;
  emoji: string;
  color: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAge(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

function getZodiac(dob: string): ZodiacInfo {
  const date = new Date(dob);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mmdd = month * 100 + day;

  if (mmdd >= 321 && mmdd <= 419) return { sign: 'Aries',       symbol: '', emoji: '', color: '#ef4444' };
  if (mmdd >= 420 && mmdd <= 520) return { sign: 'Taurus',      symbol: '', emoji: '', color: '#84cc16' };
  if (mmdd >= 521 && mmdd <= 620) return { sign: 'Gemini',      symbol: '', emoji: '', color: '#facc15' };
  if (mmdd >= 621 && mmdd <= 722) return { sign: 'Cancer',      symbol: '', emoji: '', color: '#60a5fa' };
  if (mmdd >= 723 && mmdd <= 822) return { sign: 'Leo',         symbol: '', emoji: '', color: '#f97316' };
  if (mmdd >= 823 && mmdd <= 922) return { sign: 'Virgo',       symbol: '', emoji: '', color: '#22c55e' };
  if (mmdd >= 923 && mmdd <= 1022) return { sign: 'Libra',     symbol: '', emoji: '', color: '#a78bfa' };
  if (mmdd >= 1023 && mmdd <= 1121) return { sign: 'Scorpio',  symbol: '', emoji: '', color: '#dc2626' };
  if (mmdd >= 1122 && mmdd <= 1221) return { sign: 'Sagittarius', symbol: '', emoji: '', color: '#7c3aed' };
  if (mmdd >= 1222 || mmdd <= 119) return { sign: 'Capricorn', symbol: '', emoji: '', color: '#6b7280' };
  if (mmdd >= 120 && mmdd <= 218) return { sign: 'Aquarius',   symbol: '', emoji: '', color: '#0ea5e9' };
  return { sign: 'Pisces', symbol: '', emoji: '', color: '#8b5cf6' };
}

function getBMI(weight: string, height: string): number | null {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100;
  if (!w || !h || h <= 0) return null;
  return parseFloat((w / (h * h)).toFixed(1));
}

function getBMICategory(bmi: number): { label: string; color: string; pct: number } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6', pct: 18 };
  if (bmi < 25)   return { label: 'Normal weight', color: '#22c55e', pct: 50 };
  if (bmi < 30)   return { label: 'Overweight', color: '#f59e0b', pct: 74 };
  return { label: 'Obese', color: '#ef4444', pct: 92 };
}

// ─── Particle Canvas ─────────────────────────────────────────────────────────

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.8 + 0.6,
      o: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(4,158,187,${(1 - d / 130) * 0.12})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(4,158,187,${p.o})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.particleCanvas} />;
}

// ─── BMI Gauge ───────────────────────────────────────────────────────────────

function BMIGauge({ bmi }: { bmi: number | null }) {
  const cat = bmi ? getBMICategory(bmi) : null;
  const r = 64;
  const circ = 2 * Math.PI * r;
  const offset = cat ? circ * (1 - cat.pct / 100) : circ;

  return (
    <div className={styles.bmiWrap}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        {/* Track */}
        <circle cx="80" cy="80" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        {/* Glow filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Progress arc */}
        <circle
          cx="80" cy="80" r={r}
          fill="none"
          stroke={cat?.color ?? '#e5e7eb'}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          filter="url(#glow)"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke 0.6s ease' }}
        />
        {/* Center text */}
        <text x="80" y="72" textAnchor="middle" className={styles.bmiNumber} fontSize="24" fontWeight="700" fill="#18444c">
          {bmi ?? '--'}
        </text>
        <text x="80" y="90" textAnchor="middle" fontSize="11" fill="#6b7280" fontFamily="sans-serif">
          BMI
        </text>
        <text x="80" y="106" textAnchor="middle" fontSize="10" fill={cat?.color ?? '#9ca3af'} fontFamily="sans-serif" fontWeight="600">
          {cat?.label ?? 'Enter data above'}
        </text>
      </svg>
    </div>
  );
}

// ─── AI Scanner ──────────────────────────────────────────────────────────────

function AIScanner() {
  return (
    <div className={styles.scanner}>
      <div className={styles.scanRing} style={{ '--delay': '0s' } as React.CSSProperties} />
      <div className={styles.scanRing} style={{ '--delay': '0.6s' } as React.CSSProperties} />
      <div className={styles.scanRing} style={{ '--delay': '1.2s' } as React.CSSProperties} />
      <div className={styles.scanLine} />
      <div className={styles.scanCore}>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          <polygon points="26,4 48,15 48,37 26,48 4,37 4,15" stroke="#049ebb" strokeWidth="1.5" fill="rgba(4,158,187,0.06)" />
          <circle cx="26" cy="26" r="9" stroke="#049ebb" strokeWidth="1.5" fill="none" />
          <circle cx="26" cy="26" r="3.5" fill="#049ebb" />
          <line x1="26" y1="4" x2="26" y2="17" stroke="#049ebb" strokeWidth="1" opacity="0.4" />
          <line x1="26" y1="35" x2="26" y2="48" stroke="#049ebb" strokeWidth="1" opacity="0.4" />
          <line x1="4" y1="15" x2="15" y2="21" stroke="#049ebb" strokeWidth="1" opacity="0.4" />
          <line x1="37" y1="31" x2="48" y2="37" stroke="#049ebb" strokeWidth="1" opacity="0.4" />
          <line x1="4" y1="37" x2="15" y2="31" stroke="#049ebb" strokeWidth="1" opacity="0.4" />
          <line x1="37" y1="21" x2="48" y2="15" stroke="#049ebb" strokeWidth="1" opacity="0.4" />
        </svg>
      </div>
      <div className={styles.dataStreams}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles.dataStream} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

// ─── Step Progress ────────────────────────────────────────────────────────────

const FORM_STEPS: Step[] = ['basic', 'dob', 'physical', 'health', 'confirm'];
const STEP_LABELS = ['Identity', 'Birthday', 'Body', 'Health', 'Done'];

function StepDots({ current }: { current: Step }) {
  const idx = FORM_STEPS.indexOf(current);
  return (
    <div className={styles.stepDots}>
      {FORM_STEPS.map((s, i) => (
        <div
          key={s}
          className={`${styles.dot} ${i < idx ? styles.dotDone : ''} ${i === idx ? styles.dotActive : ''}`}
          title={STEP_LABELS[i]}
        >
          {i < idx ? (
            <Check size={10} color="#fff" strokeWidth={3} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─── Option Card ──────────────────────────────────────────────────────────────

function OptionCard({
  value, label, icon: Icon, selected, onClick,
}: { value: string; label: string; icon: any; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.optCard} ${selected ? styles.optSelected : ''}`}
      onClick={onClick}
    >
      <span className={styles.optIcon}>
        {typeof Icon === 'string' ? Icon : <Icon size={20} />}
      </span>
      <span className={styles.optLabel}>{label}</span>
      {selected && <div className={styles.optCheck}><Check size={12} strokeWidth={3} /></div>}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const INIT_FORM: FormData = {
  firstName: '', lastName: '', email: '',
  password: '', confirmPassword: '', acceptTerms: false,
  dateOfBirth: '', weight: '', height: '',
  smoking: '', diabetic: '', familyHistory: '',
};

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [exiting, setExiting] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState(0);
  const { status } = useSession();

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/profile');
    }
  }, [status, router]);
  
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
  const [form, setForm] = useState<FormData>(INIT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'general', string>>>({});
  const [displayAge, setDisplayAge] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Welcome cinematic sequence
  useEffect(() => {
    if (step !== 'welcome') return;
    const t1 = setTimeout(() => setWelcomePhase(1), 600);
    const t2 = setTimeout(() => setWelcomePhase(2), 1800);
    const t3 = setTimeout(() => setWelcomePhase(3), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [step]);

  // Age counter animation
  useEffect(() => {
    if (!form.dateOfBirth) { setDisplayAge(0); return; }
    const target = getAge(form.dateOfBirth);
    let cur = 0;
    setDisplayAge(0);
    const tick = setInterval(() => {
      cur = Math.min(cur + Math.ceil(target / 28), target);
      setDisplayAge(cur);
      if (cur >= target) clearInterval(tick);
    }, 40);
    return () => clearInterval(tick);
  }, [form.dateOfBirth]);

  // AI analysis progress
  useEffect(() => {
    if (step !== 'analysis') return;
    setAnalysisProgress(0);
    const interval = setInterval(() => {
      setAnalysisProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          // Redirect after completion
          setTimeout(() => { router.replace('/profile'); }, 800);
          return 100;
        }
        return p + 0.8;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [step]);

  const go = useCallback((next: Step) => {
    setExiting(true);
    // Smooth transition with refined timing
    setTimeout(() => {
      setStep(next);
      setExiting(false);
    }, 350);
  }, []);

  const set = (field: keyof FormData, value: string | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
    // Clear error on field change for better UX
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const validateBasic = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Please enter a valid email';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (!form.acceptTerms) errs.acceptTerms = 'You must accept the terms to continue';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          dateOfBirth: form.dateOfBirth,
          weight: form.weight,
          height: form.height,
          smoking: form.smoking,
          diabetic: form.diabetic,
          familyHistory: form.familyHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ general: data.error || 'Registration failed' });
        go('basic'); // Go back to first step to show errors
        return;
      }

      // Success - Start AI Analysis animation
      go('analysis');
    } catch (error) {
      setErrors({ general: 'Something went wrong. Please try again.' });
      go('basic');
    } finally {
      setIsLoading(false);
    }
  };

  const bmi = getBMI(form.weight, form.height);
  const zodiac = form.dateOfBirth ? getZodiac(form.dateOfBirth) : null;
  const pageClass = `${styles.page} ${exiting ? styles.pageExit : styles.pageEnter}`;

  // ── WELCOME ──────────────────────────────────────────────────────────────

  if (step === 'welcome') {
    return (
      <div className={styles.pageContainer}>
        <ParticleField />
        <div className={styles.glowOrb} />
        <div className={styles.glowOrb2} />

        <div className={`${styles.welcome} ${exiting ? styles.pageExit : ''}`}>
          {/* Logo mark */}
          <div className={`${styles.logoMark} ${welcomePhase >= 0 ? styles.logoIn : ''}`}>
            <div className={styles.logoHex}>
              <img 
                src="/assets/img/logo.png" 
                alt="Sehati Logo" 
                style={{ width: '64px', height: '64px', objectFit: 'contain' }} 
              />
            </div>
            <div className={styles.logoPulse1} />
            <div className={styles.logoPulse2} />
          </div>

          {/* Arabic tagline */}
          <p className={`${styles.arabic} ${welcomePhase >= 1 ? styles.fadeIn : ''}`}>
            المنصة الأولى المغربية للذكاء الاصطناعي
          </p>

          {/* Main title */}
          <div className={`${styles.titleWrap} ${welcomePhase >= 1 ? styles.titleIn : ''}`}>
            <h1 className={styles.welcomeTitle}>
              Welcome to{' '}
              <span className={styles.brand}>Sehati AI</span>
            </h1>
            <p className={styles.welcomeSub}>
              The first Moroccan AI-powered platform<br />
              for diabetes detection &amp; health monitoring
            </p>
          </div>

          {/* Feature pills */}
          <div className={`${styles.pills} ${welcomePhase >= 2 ? styles.pillsIn : ''}`}>
            {[
              { label: 'rPPG Detection', icon: Dna },
              { label: 'AI Powered', icon: Cpu },
              { label: 'Health Insights', icon: Activity },
              { label: 'Made in Morocco', flag: true },
            ].map((p, i) => (
              <span key={i} className={styles.pill} style={{ animationDelay: `${i * 0.1}s` }}>
                {p.flag ? <MoroccoFlag size={16} /> : p.icon && <p.icon size={14} />}
                {p.label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className={`${styles.ctaWrap} ${welcomePhase >= 3 ? styles.ctaIn : ''}`}>
            <button className={styles.ctaBtn} onClick={() => go('basic')}>
              <span className={styles.ctaBtnInner}>
                Let&apos;s Get Started
                <ArrowRight size={20} />
              </span>
              <div className={styles.ctaShimmer} />
            </button>
            <p className={styles.loginLink}>Already have an account? <Link href="/login">Sign in</Link></p>
          </div>
        </div>
      </div>
    );
  }

  // ── AI ANALYSIS ──────────────────────────────────────────────────────────

  if (step === 'analysis') {
    return (
      <div className={styles.pageContainer}>
        <ParticleField />
        <div className={styles.glowOrb} />
        <div className={`${styles.analysis} ${exiting ? styles.pageExit : styles.pageEnter}`}>
          <AIScanner />
          <div className={styles.analysisContent}>
            <h2 className={styles.analysisTitle}>Initializing AI Engine</h2>
            <p className={styles.analysisSub}>
              Calibrating your personalized rPPG-based diabetes detection model...
            </p>
            <div className={styles.analysisBar}>
              <div className={styles.analysisFill} style={{ width: `${analysisProgress}%` }} />
            </div>
            <div className={styles.analysisMeta}>
              {[
                { label: 'Health Profile', done: analysisProgress > 20 },
                { label: 'Risk Analysis', done: analysisProgress > 50 },
                { label: 'AI Calibration', done: analysisProgress > 75 },
                { label: 'Profile Ready', done: analysisProgress >= 100 },
              ].map(({ label, done }) => (
                <div key={label} className={`${styles.analysisTick} ${done ? styles.tickDone : ''}`}>
                  <div className={styles.tickIcon}>{done ? <CheckCircle2 size={16} /> : <Circle size={16} />}</div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM SHELL ───────────────────────────────────────────────────────────

  return (
    <div className={styles.pageContainer}>
      <ParticleField />

      <div className={styles.formRoot}>
        {/* Header */}
        <header className={styles.formHeader}>
          <button
            className={styles.backBtn}
            onClick={() => {
              const idx = FORM_STEPS.indexOf(step);
              if (idx > 0) go(FORM_STEPS[idx - 1]);
              else go('welcome');
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <div className={styles.headerLogo}>
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
              <path d="M18 3l14 7v14l-14 9L4 24V10z" fill="rgba(4,158,187,0.15)" stroke="#049ebb" strokeWidth="1.5" />
              <circle cx="18" cy="18" r="5" fill="#049ebb" />
            </svg>
            <span>Sehati AI</span>
          </div>

          <StepDots current={step} />
        </header>

        {/* Form card */}
        <main className={styles.formCard}>
          {errors.general && (
            <div className={styles.errorBanner}>
              <AlertTriangle size={18} />
              <span>{errors.general}</span>
            </div>
          )}
          <div className={pageClass}>

            {/* ── STEP 1: Basic Info ──────────────────────────── */}
            {step === 'basic' && (
              <div className={styles.stepWrap}>
                <div className={styles.stepTop}>
                  <div className={styles.stepNum}>01</div>
                  <h2 className={styles.stepTitle}>Your Identity</h2>
                  <p className={styles.stepDesc}>Create your account to start your health journey</p>
                </div>

                <div className={styles.fieldRow}>
                  <div className={`${styles.field} ${errors.firstName ? styles.fieldErr : ''}`}>
                    <label className={styles.label} htmlFor="firstName">First Name</label>
                    <input
                      id="firstName"
                      name="given-name"
                      className={styles.input}
                      value={form.firstName}
                      onChange={e => set('firstName', e.target.value)}
                      placeholder="Youssef"
                      autoComplete="given-name"
                    />
                    {errors.firstName && <span className={styles.errMsg}>{errors.firstName}</span>}
                  </div>
                  <div className={`${styles.field} ${errors.lastName ? styles.fieldErr : ''}`}>
                    <label className={styles.label} htmlFor="lastName">Last Name</label>
                    <input
                      id="lastName"
                      name="family-name"
                      className={styles.input}
                      value={form.lastName}
                      onChange={e => set('lastName', e.target.value)}
                      placeholder="Benali"
                      autoComplete="family-name"
                    />
                    {errors.lastName && <span className={styles.errMsg}>{errors.lastName}</span>}
                  </div>
                </div>

                <div className={`${styles.field} ${errors.email ? styles.fieldErr : ''}`}>
                  <label className={styles.label} htmlFor="email">Email Address</label>
                  <div className={styles.inputIcon}>
                    <Mail size={16} color="#9ca3af" />
                    <input
                      id="email"
                      name="email"
                      className={styles.input}
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                  {errors.email && <span className={styles.errMsg}>{errors.email}</span>}
                </div>

                <div className={styles.fieldRow}>
                  <div className={`${styles.field} ${errors.password ? styles.fieldErr : ''}`}>
                    <label className={styles.label} htmlFor="password">Password</label>
                    <div className={styles.inputIcon}>
                      <Lock size={16} color="#9ca3af" />
                      <input
                        id="password"
                        name="new-password"
                        className={styles.input}
                        type="password"
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>
                    {errors.password && <span className={styles.errMsg}>{errors.password}</span>}
                  </div>
                  <div className={`${styles.field} ${errors.confirmPassword ? styles.fieldErr : ''}`}>
                    <label className={styles.label} htmlFor="confirmPassword">Confirm Password</label>
                    <div className={styles.inputIcon}>
                      <Lock size={16} color="#9ca3af" />
                      <input
                        id="confirmPassword"
                        name="new-password"
                        className={styles.input}
                        type="password"
                        value={form.confirmPassword}
                        onChange={e => set('confirmPassword', e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>
                    {errors.confirmPassword && <span className={styles.errMsg}>{errors.confirmPassword}</span>}
                  </div>
                </div>

                {/* Password strength */}
                {form.password && (
                  <div className={styles.strengthRow}>
                    {[1, 2, 3, 4].map(lvl => {
                      const strength =
                        (form.password.length >= 8 ? 1 : 0) +
                        (/[A-Z]/.test(form.password) ? 1 : 0) +
                        (/[0-9]/.test(form.password) ? 1 : 0) +
                        (/[^A-Za-z0-9]/.test(form.password) ? 1 : 0);
                      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
                      return (
                        <div
                          key={lvl}
                          className={styles.strengthSeg}
                          style={{ background: lvl <= strength ? colors[strength - 1] : '#e5e7eb' }}
                        />
                      );
                    })}
                    <span className={styles.strengthLabel}>
                      {form.password.length < 8 ? 'Too short' :
                        (/[A-Z]/.test(form.password) && /[0-9]/.test(form.password) && /[^A-Za-z0-9]/.test(form.password))
                          ? 'Strong' : 'Good'}
                    </span>
                  </div>
                )}

                <label className={styles.checkRow}>
                  <div className={`${styles.checkbox} ${form.acceptTerms ? styles.checked : ''}`}
                       onClick={() => set('acceptTerms', !form.acceptTerms)}>
                    {form.acceptTerms && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span>
                    I agree to the <a href="#" className={styles.link}>Terms of Service</a> and{' '}
                    <a href="#" className={styles.link}>Privacy Policy</a>
                  </span>
                </label>
                {errors.acceptTerms && <span className={styles.errMsg}>{errors.acceptTerms}</span>}

                <button className={styles.nextBtn} onClick={() => { if (validateBasic()) go('dob'); }}>
                  Continue
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* ── STEP 2: Date of Birth ────────────────────────── */}
            {step === 'dob' && (
              <div className={styles.stepWrap}>
                <div className={styles.stepTop}>
                  <div className={styles.stepNum}>02</div>
                  <h2 className={styles.stepTitle}>Date of Birth</h2>
                  <p className={styles.stepDesc}>Help us personalize your health journey, {form.firstName}</p>
                </div>

                <div className={styles.dobWrap}>
                  <label htmlFor="dateOfBirth" className={styles.srOnly}>Date of Birth</label>
                  <input
                    id="dateOfBirth"
                    name="bday"
                    type="date"
                    className={styles.dateInput}
                    value={form.dateOfBirth}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => set('dateOfBirth', e.target.value)}
                    autoComplete="bday"
                  />
                </div>

                {form.dateOfBirth && (
                  <div className={styles.dobInsights}>
                    <div className={styles.insightCard}>
                      <Cake size={26} color="var(--ai-accent)" strokeWidth={1.5} />
                      <div className={styles.insightValue}>{displayAge}</div>
                      <div className={styles.insightLabel}>years old</div>
                    </div>
                    {zodiac && (
                      <div className={styles.insightCard} style={{ borderColor: zodiac.color + '40' }}>
                        <Sparkles size={26} color={zodiac.color} strokeWidth={1.5} />
                        <div className={styles.insightValue} style={{ color: zodiac.color }}>
                          {zodiac.sign}
                        </div>
                        <div className={styles.insightLabel}>Your zodiac</div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  className={styles.nextBtn}
                  disabled={!form.dateOfBirth}
                  onClick={() => { if (form.dateOfBirth) go('physical'); }}
                >
                  Continue
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* ── STEP 3: Physical Info ────────────────────────── */}
            {step === 'physical' && (
              <div className={styles.stepWrap}>
                <div className={styles.stepTop}>
                  <div className={styles.stepNum}>03</div>
                  <h2 className={styles.stepTitle}>Physical Profile</h2>
                  <p className={styles.stepDesc}>Your body metrics help us assess your health baseline</p>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="weight">Weight</label>
                    <div className={styles.inputUnit}>
                      <input
                        id="weight"
                        name="weight"
                        className={styles.input}
                        type="number"
                        value={form.weight}
                        onChange={e => set('weight', e.target.value)}
                        placeholder="70"
                        min="20" max="300"
                        autoComplete="off"
                      />
                      <span className={styles.unit}>kg</span>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="height">Height</label>
                    <div className={styles.inputUnit}>
                      <input
                        id="height"
                        name="height"
                        className={styles.input}
                        type="number"
                        value={form.height}
                        onChange={e => set('height', e.target.value)}
                        placeholder="175"
                        min="100" max="250"
                        autoComplete="off"
                      />
                      <span className={styles.unit}>cm</span>
                    </div>
                  </div>
                </div>

                <BMIGauge bmi={bmi} />

                {bmi && (
                  <div className={styles.bmiCaption}>
                    Your BMI of{' '}
                    <strong style={{ color: getBMICategory(bmi).color }}>{bmi}</strong>{' '}
                    indicates <strong style={{ color: getBMICategory(bmi).color }}>{getBMICategory(bmi).label}</strong>
                  </div>
                )}

                <button
                  className={styles.nextBtn}
                  disabled={!form.weight || !form.height}
                  onClick={() => { if (form.weight && form.height) go('health'); }}
                >
                  Continue
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* ── STEP 4: Health Questions ─────────────────────── */}
            {step === 'health' && (
              <div className={styles.stepWrap}>
                <div className={styles.stepTop}>
                  <div className={styles.stepNum}>04</div>
                  <h2 className={styles.stepTitle}>Health History</h2>
                  <p className={styles.stepDesc}>Quick questions to complete your health profile</p>
                </div>

                <div className={styles.questionGroup}>
                  <label className={styles.questionLabel}><Cigarette size={18} /> Smoking Status</label>
                  <div className={styles.optGrid}>
                    {[
                      { value: 'never', label: 'Never', icon: Check },
                      { value: 'former', label: 'Former', icon: CigaretteOff },
                      { value: 'current', label: 'Current', icon: Cigarette },
                    ].map(o => (
                      <OptionCard key={o.value} {...o} selected={form.smoking === o.value} onClick={() => set('smoking', o.value)} />
                    ))}
                  </div>
                </div>

                <div className={styles.questionGroup}>
                  <label className={styles.questionLabel}><Stethoscope size={18} /> Diabetes Status</label>
                  <div className={styles.optGrid}>
                    {[
                      { value: 'no', label: 'Not Diabetic', icon: Heart },
                      { value: 'pre', label: 'Pre-diabetic', icon: AlertTriangle },
                      { value: 'type1', label: 'Type 1', icon: Syringe },
                      { value: 'type2', label: 'Type 2', icon: Stethoscope },
                    ].map(o => (
                      <OptionCard key={o.value} {...o} selected={form.diabetic === o.value} onClick={() => set('diabetic', o.value)} />
                    ))}
                  </div>
                </div>

                <div className={styles.questionGroup}>
                  <label className={styles.questionLabel}><Users size={18} /> Family History of Diabetes</label>
                  <div className={styles.optGrid}>
                    {[
                      { value: 'none', label: 'None', icon: User },
                      { value: 'parent', label: 'Parent', icon: Users },
                      { value: 'sibling', label: 'Sibling', icon: Users },
                      { value: 'both', label: 'Both', icon: Users },
                    ].map(o => (
                      <OptionCard key={o.value} {...o} selected={form.familyHistory === o.value} onClick={() => set('familyHistory', o.value)} />
                    ))}
                  </div>
                </div>

                <button
                  className={styles.nextBtn}
                  disabled={!form.smoking || !form.diabetic || !form.familyHistory || isLoading}
                  onClick={handleFinalSubmit}
                >
                  {isLoading ? 'Creating Account...' : 'Create My Account'}
                  {!isLoading && <ArrowRight size={18} />}
                </button>
              </div>
            )}

            {/* ── STEP 5: Confirmation ─────────────────────────── */}
            {step === 'confirm' && (
              <div className={styles.stepWrap}>
                <div className={styles.confirmWrap}>
                  <div className={styles.successRing}>
                    <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                      <circle cx="45" cy="45" r="40" stroke="#e5e7eb" strokeWidth="2" />
                      <circle
                        cx="45" cy="45" r="40"
                        stroke="#049ebb"
                        strokeWidth="2.5"
                        strokeDasharray="251"
                        strokeLinecap="round"
                        transform="rotate(-90 45 45)"
                        className={styles.successArc}
                      />
                      <path
                        d="M28 45l11 11 23-23"
                        stroke="#049ebb"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={styles.checkDraw}
                      />
                    </svg>
                  </div>

                  <h2 className={styles.confirmTitle}>Welcome to Sehati, {form.firstName}! <PartyPopper size={24} className={styles.inlineIcon} color="var(--ai-accent)" /></h2>
                  <p className={styles.confirmSub}>
                    Your account has been successfully created. You&apos;re one step away from personalized AI-powered health insights.
                  </p>

                  <div className={styles.profilePreview}>
                    <div className={styles.previewRow}>
                      <User size={16} /><span>{form.firstName} {form.lastName}</span>
                    </div>
                    <div className={styles.previewRow}>
                      <Mail size={16} /><span>{form.email}</span>
                    </div>
                    <div className={styles.previewRow}>
                      <Cake size={16} /><span>{getAge(form.dateOfBirth)} years old</span>
                    </div>
                    {bmi && (
                      <div className={styles.previewRow}>
                        <Scale size={16} />
                        <span>BMI {bmi} — <span style={{ color: getBMICategory(bmi).color }}>{getBMICategory(bmi).label}</span></span>
                      </div>
                    )}
                  </div>

                  <button className={`${styles.nextBtn} ${styles.activateBtn}`} onClick={() => go('analysis')}>
                    Activate AI Analysis
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

