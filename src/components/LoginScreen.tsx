// src/components/LoginScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowDown,
} from 'lucide-react';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from 'motion/react';
import { useAuth } from '../context/AuthContext.tsx';

export const LoginScreen: React.FC = () => {
  const { loginWithCredentials } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLampOn, setIsLampOn] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const shouldReduceMotion = useReducedMotion();
  const employeeInputRef = useRef<HTMLInputElement>(null);

  // Pull-cord spring motion values
  const cordY = useMotionValue(0);
  const cordEndY = useTransform(cordY, (v) => 246 + v);
  const dragStateRef = useRef<{
    startY: number;
    maxDelta: number;
    active: boolean;
  }>({ startY: 0, maxDelta: 0, active: false });

  useEffect(() => {
    if (isLampOn) {
      const timer = setTimeout(() => {
        employeeInputRef.current?.focus();
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [isLampOn]);

  const triggerCordBounce = () => {
    if (shouldReduceMotion) {
      cordY.set(0);
      return;
    }
    animate(cordY, 28, {
      duration: 0.11,
      ease: 'easeOut',
    }).then(() => {
      animate(cordY, 0, {
        type: 'spring',
        stiffness: 460,
        damping: 14,
        mass: 0.85,
      });
    });
  };

  const toggleLamp = () => {
    setIsLampOn((prev) => !prev);
  };

  const handleCordPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPulling(true);
    dragStateRef.current = {
      startY: e.clientY,
      maxDelta: 0,
      active: true,
    };
  };

  const handleCordPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current.active) return;
    const delta = e.clientY - dragStateRef.current.startY;
    if (delta > dragStateRef.current.maxDelta) {
      dragStateRef.current.maxDelta = delta;
    }
    const damped = Math.min(48, Math.max(-4, delta * 0.78));
    cordY.set(damped);
  };

  const handleCordPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current.active) return;
    const endDelta = e.clientY - dragStateRef.current.startY;
    const maxDelta = dragStateRef.current.maxDelta;
    dragStateRef.current.active = false;
    setIsPulling(false);

    const wasClick = Math.abs(endDelta) < 8 && maxDelta < 8;
    const pulledEnough = endDelta >= 14 || maxDelta >= 16;

    if (wasClick) {
      toggleLamp();
      triggerCordBounce();
    } else if (pulledEnough) {
      toggleLamp();
      animate(cordY, 0, {
        type: 'spring',
        stiffness: 480,
        damping: 15,
        mass: 0.85,
      });
    } else {
      animate(cordY, 0, {
        type: 'spring',
        stiffness: 420,
        damping: 20,
      });
    }
  };

  const handleCordKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleLamp();
      triggerCordBounce();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLampOn) return;
    setError('');
    setLoading(true);

    try {
      const result = await loginWithCredentials(employeeId, password);
      if (!result.success) {
        setError(
          result.message || 'Invalid Employee ID or Password. Please try again.'
        );
        setLoading(false);
      }
    } catch {
      setError('An error occurred during authentication. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d14] text-slate-100 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-10 selection:bg-cyan-400 selection:text-slate-950 relative overflow-hidden">
      {/* Deep dark ambient room backdrop & subtle architectural dot matrix */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Ambient cyan illumination across the room when lamp is ON */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{
          opacity: isLampOn ? 1 : 0,
          scale: isLampOn ? 1 : 0.88,
        }}
        transition={{ duration: shouldReduceMotion ? 0.15 : 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 68% 58% at 34% 44%, rgba(0, 229, 255, 0.12) 0%, rgba(34, 211, 238, 0.045) 45%, rgba(8, 13, 20, 0) 78%)',
        }}
      />

      {/* Responsive Split Stage: Lamp (Left on Desktop, Top on Mobile) + Login Card (Right / Below) */}
      <div className="w-full max-w-5xl relative z-10 grid grid-cols-1 md:grid-cols-12 items-center gap-6 md:gap-8 lg:gap-12">
        {/* LEFT / TOP: Interactive Minimalist Standing Floor Lamp */}
        <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center relative select-none">
          <div className="relative w-[270px] h-[340px] sm:w-[320px] sm:h-[410px] md:w-[360px] md:h-[470px]">
            <svg
              viewBox="0 0 380 500"
              className="w-full h-full overflow-visible"
              aria-hidden="true"
            >
              <defs>
                {/* Metallic pole gradient */}
                <linearGradient id="lampPoleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#121a26" />
                  <stop offset="45%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>

                {/* Lamp shade exterior gradient */}
                <linearGradient id="lampShadeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="55%" stopColor="#111827" />
                  <stop offset="100%" stopColor="#090e17" />
                </linearGradient>

                {/* Lamp shade interior when OFF vs ON */}
                <radialGradient id="shadeInnerOn" cx="50%" cy="25%" r="70%">
                  <stop offset="0%" stopColor="#e0fcff" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#00e5ff" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#083344" stopOpacity="0.9" />
                </radialGradient>

                {/* Outer soft cyan volumetric beam */}
                <linearGradient id="beamOuterGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.34" />
                  <stop offset="38%" stopColor="#22d3ee" stopOpacity="0.14" />
                  <stop offset="78%" stopColor="#06b6d4" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#080d14" stopOpacity="0" />
                </linearGradient>

                {/* Inner brighter cyan light core */}
                <linearGradient id="beamInnerGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.46" />
                  <stop offset="32%" stopColor="#00e5ff" stopOpacity="0.18" />
                  <stop offset="85%" stopColor="#22d3ee" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#080d14" stopOpacity="0" />
                </linearGradient>

                {/* Bulb radial halo */}
                <radialGradient id="bulbHaloGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ecfeff" stopOpacity="1" />
                  <stop offset="30%" stopColor="#00e5ff" stopOpacity="0.9" />
                  <stop offset="65%" stopColor="#22d3ee" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
                </radialGradient>

                {/* Floor ambient reflection pool */}
                <radialGradient id="floorPoolGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.26" />
                  <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#080d14" stopOpacity="0" />
                </radialGradient>

                {/* Soft Gaussian filters */}
                <filter id="beamBlurWide" x="-30%" y="-10%" width="160%" height="130%">
                  <feGaussianBlur stdDeviation="16" />
                </filter>
                <filter id="beamBlurTight" x="-25%" y="-10%" width="150%" height="125%">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
                <filter id="bulbGlowFilter" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="9" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Soft ambient floor shadow (always present) */}
              <ellipse cx="126" cy="472" rx="64" ry="12" fill="rgba(0,0,0,0.65)" />

              {/* Illuminated Floor Pool when Lamp is ON */}
              <motion.ellipse
                cx="228"
                cy="472"
                rx="145"
                ry="22"
                fill="url(#floorPoolGrad)"
                initial={false}
                animate={{
                  opacity: isLampOn ? 1 : 0,
                  scaleX: isLampOn ? 1 : 0.65,
                }}
                transition={{ duration: shouldReduceMotion ? 0.15 : 0.45 }}
              />

              {/* Volumetric Cyan Downward Light Beam (Only visible when Lamp is ON) */}
              <motion.g
                initial={false}
                animate={{
                  opacity: isLampOn ? 1 : 0,
                  scaleY: isLampOn ? 1 : 0.85,
                }}
                style={{ transformOrigin: '228px 146px' }}
                transition={{
                  duration: shouldReduceMotion ? 0.12 : 0.42,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {/* Wide soft ambient cone */}
                <polygon
                  points="168,146 288,146 392,476 64,476"
                  fill="url(#beamOuterGrad)"
                  filter="url(#beamBlurWide)"
                />
                {/* Inner concentrated cyan core beam */}
                <polygon
                  points="190,146 266,146 332,474 124,474"
                  fill="url(#beamInnerGrad)"
                  filter="url(#beamBlurTight)"
                />
              </motion.g>

              {/* Floor Lamp Weighted Circular Base */}
              <ellipse
                cx="126"
                cy="466"
                rx="52"
                ry="10"
                fill="#111926"
                stroke={isLampOn ? 'rgba(34, 211, 238, 0.38)' : 'rgba(148, 163, 184, 0.16)'}
                strokeWidth="1.5"
              />
              <ellipse
                cx="126"
                cy="463"
                rx="46"
                ry="7.5"
                fill="#182233"
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth="1"
              />
              {/* Base stem collar */}
              <rect x="118" y="446" width="16" height="17" rx="3" fill="url(#lampPoleGrad)" />

              {/* Slender Vertical Floor Lamp Stem */}
              <rect
                x="122"
                y="150"
                width="8"
                height="298"
                rx="2"
                fill="url(#lampPoleGrad)"
              />
              {/* Subtle cyan rim reflection along inner side of pole when ON */}
              <motion.rect
                x="128.5"
                y="152"
                width="1.5"
                height="294"
                rx="0.75"
                fill="#22d3ee"
                initial={false}
                animate={{ opacity: isLampOn ? 0.48 : 0 }}
                transition={{ duration: 0.35 }}
              />

              {/* Mid-pole subtle architectural brass/steel collar joint */}
              <rect
                x="120"
                y="296"
                width="12"
                height="6"
                rx="2"
                fill="#334155"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="0.75"
              />

              {/* Curved Cantilevered Upper Arm */}
              <path
                d="M 126 154 C 126 78, 164 46, 208 48 C 224 49, 228 60, 228 76"
                fill="none"
                stroke="url(#lampPoleGrad)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              {/* Subtle top highlight on curved arm */}
              <path
                d="M 126 154 C 126 78, 164 46, 208 48 C 224 49, 228 60, 228 76"
                fill="none"
                stroke={isLampOn ? 'rgba(34, 211, 238, 0.35)' : 'rgba(255, 255, 255, 0.08)'}
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              {/* Socket Cap above Shade */}
              <rect
                x="217"
                y="72"
                width="22"
                height="13"
                rx="3.5"
                fill="#1e293b"
                stroke="rgba(148, 163, 184, 0.25)"
                strokeWidth="1"
              />

              {/* Minimalist Tapered Drum/Conical Lamp Shade */}
              <path
                d="M 196 84 Q 228 76 260 84 L 298 145 Q 228 154 158 145 Z"
                fill="url(#lampShadeGrad)"
                stroke={isLampOn ? 'rgba(34, 211, 238, 0.48)' : 'rgba(148, 163, 184, 0.18)'}
                strokeWidth="1.5"
              />

              {/* Inner underside of the lamp shade */}
              <ellipse
                cx="228"
                cy="146"
                rx="69"
                ry="11"
                fill={isLampOn ? 'url(#shadeInnerOn)' : '#0a1019'}
                stroke={isLampOn ? 'rgba(103, 232, 249, 0.6)' : 'rgba(148, 163, 184, 0.14)'}
                strokeWidth="1.2"
              />

              {/* Light Bulb */}
              <g>
                {/* Bulb Ambient Halo when ON */}
                <motion.circle
                  cx="228"
                  cy="149"
                  r="42"
                  fill="url(#bulbHaloGrad)"
                  initial={false}
                  animate={{
                    opacity: isLampOn ? 1 : 0,
                    scale: isLampOn ? 1 : 0.5,
                  }}
                  transition={{ duration: 0.3 }}
                />

                {/* Physical Glass Bulb Dome */}
                <circle
                  cx="228"
                  cy="146"
                  r="11.5"
                  fill={isLampOn ? '#e0fcff' : '#1b2638'}
                  stroke={isLampOn ? '#00e5ff' : 'rgba(148, 163, 184, 0.28)'}
                  strokeWidth="1.4"
                  filter={isLampOn ? 'url(#bulbGlowFilter)' : undefined}
                />
                {/* Filament detail inside OFF bulb */}
                {!isLampOn && (
                  <path
                    d="M 224 146 Q 228 141 232 146"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.35)"
                    strokeWidth="1.2"
                  />
                )}
              </g>

              {/* Hanging Pull-Cord Line (Stretches dynamically with cordY) */}
              <line
                x1="266"
                y1="147"
                x2="266"
                y2="152"
                stroke="#475569"
                strokeWidth="2"
              />
              <motion.line
                x1="266"
                y1="150"
                x2="266"
                y2={cordEndY}
                stroke={isLampOn ? '#67e8f9' : '#64748b'}
                strokeWidth="2"
                strokeDasharray="3 2.5"
                strokeLinecap="round"
              />

              {/* Pull-Cord Handle Assembly (Moves with cordY) */}
              <motion.g style={{ y: cordY }}>
                {/* Subtle pulsing cyan ring around handle when Lamp is OFF */}
                {!isLampOn && !shouldReduceMotion && (
                  <motion.circle
                    cx="266"
                    cy="262"
                    r="18"
                    fill="none"
                    stroke="#00e5ff"
                    strokeWidth="1.5"
                    initial={{ scale: 0.85, opacity: 0.7 }}
                    animate={{
                      scale: [0.85, 1.45, 0.85],
                      opacity: [0.7, 0.08, 0.7],
                    }}
                    transition={{
                      duration: 2.1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}

                {/* Connector ring */}
                <circle
                  cx="266"
                  cy="247"
                  r="3.2"
                  fill="#0f172a"
                  stroke={isLampOn ? '#22d3ee' : '#94a3b8'}
                  strokeWidth="1.5"
                />

                {/* Weighted metallic pull-handle */}
                <rect
                  x="259"
                  y="250"
                  width="14"
                  height="26"
                  rx="7"
                  fill={isLampOn ? '#164e63' : '#1e293b'}
                  stroke={isLampOn ? '#22d3ee' : '#94a3b8'}
                  strokeWidth="1.5"
                />

                {/* Glowing indicator tip inside handle */}
                <circle
                  cx="266"
                  cy="268"
                  r="3"
                  fill={isLampOn ? '#00e5ff' : '#22d3ee'}
                  opacity={isLampOn ? 1 : 0.85}
                />
              </motion.g>
            </svg>

            {/* Accessible Interactive Hit Area Overlay for the Pull-Cord Handle (Click or Drag Down) */}
            <motion.button
              type="button"
              aria-pressed={isLampOn}
              aria-label={
                isLampOn
                  ? 'Turn off lamp and hide login form'
                  : 'Pull or click cord to turn on lamp and reveal login form'
              }
              onPointerDown={handleCordPointerDown}
              onPointerMove={handleCordPointerMove}
              onPointerUp={handleCordPointerEnd}
              onPointerCancel={handleCordPointerEnd}
              onKeyDown={handleCordKeyDown}
              style={{
                y: cordY,
                left: '70%',
                top: '52.4%',
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-14 h-16 rounded-xl touch-none flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d14] ${
                isPulling ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <span className="sr-only">
                {isLampOn ? 'Pull cord to turn lamp off' : 'Pull cord to turn lamp on'}
              </span>
            </motion.button>

            {/* Helpful Pulsing Tooltip next to Pull-Cord Handle when Lamp is OFF */}
            <motion.div
              initial={false}
              animate={{
                opacity: isLampOn ? 0 : 1,
                y: isLampOn ? -6 : 0,
              }}
              transition={{ duration: 0.25 }}
              style={{ left: '70%', top: '61.5%' }}
              className={`absolute -translate-x-1/2 pointer-events-none select-none z-20 ${
                isLampOn ? 'invisible' : 'visible'
              }`}
            >
              <div className="relative bg-[#0f1926]/95 border border-cyan-400/35 text-cyan-200 px-3 py-1.5 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.2)] flex items-center gap-1.5 whitespace-nowrap">
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-bounce" />
                <span className="text-xs font-medium tracking-wide">
                  Click or pull cord
                </span>
              </div>
            </motion.div>

            {/* Subtle minimal hint when Lamp is ON */}
            <motion.div
              initial={false}
              animate={{
                opacity: isLampOn ? 0.65 : 0,
              }}
              transition={{ duration: 0.3 }}
              style={{ left: '70%', top: '61.5%' }}
              className="absolute -translate-x-1/2 pointer-events-none select-none"
            >
              <span className="text-[11px] font-medium text-cyan-300/70 whitespace-nowrap">
                Pull cord to dim
              </span>
            </motion.div>
          </div>
        </div>

        {/* RIGHT / BOTTOM: Dark Glassmorphic Login Card (Hidden when Lamp is OFF) */}
        <div className="md:col-span-7 lg:col-span-7 flex justify-center md:justify-start">
          <motion.div
            initial={false}
            animate={{
              opacity: isLampOn ? 1 : 0,
              y: isLampOn ? 0 : 28,
              scale: isLampOn ? 1 : 0.97,
            }}
            transition={{
              duration: shouldReduceMotion ? 0.15 : 0.48,
              ease: [0.16, 1, 0.3, 1],
            }}
            aria-hidden={!isLampOn}
            className={`w-full max-w-md relative ${
              isLampOn ? 'pointer-events-auto' : 'pointer-events-none select-none'
            }`}
          >
            {/* Soft cyan rim illumination spilled onto card edge from lamp */}
            <div
              aria-hidden="true"
              className="absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-400/30 via-teal-400/10 to-slate-800/40 pointer-events-none"
            />

            {/* Main Dark Glassmorphic Container */}
            <div className="relative bg-[#0c1421]/85 backdrop-blur-2xl rounded-2xl shadow-[0_24px_80px_-16px_rgba(0,229,255,0.2),0_12px_36px_rgba(0,0,0,0.65)] border border-cyan-400/20 overflow-hidden">
              {/* Top illuminated hairline highlight */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

              {/* Header */}
              <div className="px-7 pt-8 pb-6 text-center border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-transparent">
                <div className="w-13 h-13 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan-950/90 via-slate-900 to-slate-950 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_24px_rgba(0,229,255,0.16)]">
                  <Building2 className="w-6 h-6 text-cyan-300" />
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                  Welcome Back
                </h1>
                <p className="text-sm font-semibold text-cyan-300/95 mt-1">
                  Renaissance Group HR &amp; OD Portal
                </p>
                <p className="text-xs text-slate-400 mt-1.5">
                  Enter your authorized Employee ID &amp; Password
                </p>
              </div>

              {/* Form Body */}
              <div className="p-7 sm:p-8">
                {error && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl flex items-start space-x-2.5 text-xs text-rose-200 font-medium"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-employee-id"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Employee ID
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        ref={employeeInputRef}
                        id="login-employee-id"
                        type="text"
                        required
                        tabIndex={isLampOn ? 0 : -1}
                        disabled={!isLampOn}
                        placeholder="e.g. 22-02-1826"
                        value={employeeId}
                        onChange={(e) => {
                          setEmployeeId(e.target.value);
                          setError('');
                        }}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#070b12]/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:bg-[#09101a] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/80 font-mono transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        tabIndex={isLampOn ? 0 : -1}
                        disabled={!isLampOn}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError('');
                        }}
                        className="w-full pl-10 pr-11 py-2.5 text-sm bg-[#070b12]/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:bg-[#09101a] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/80 font-medium transition"
                      />
                      <button
                        type="button"
                        tabIndex={isLampOn ? 0 : -1}
                        disabled={!isLampOn}
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-cyan-300 transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    tabIndex={isLampOn ? 0 : -1}
                    disabled={loading || !isLampOn}
                    className="w-full py-3 px-5 bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500 hover:from-cyan-300 hover:via-teal-300 hover:to-cyan-400 text-slate-950 font-extrabold rounded-xl shadow-[0_0_26px_rgba(0,229,255,0.34)] hover:shadow-[0_0_36px_rgba(0,229,255,0.5)] transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-70 mt-3 active:scale-[0.99] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1421]"
                  >
                    <span>
                      {loading ? 'Verifying Credentials...' : 'Sign In to Portal'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center space-x-2 text-slate-400 text-xs">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Enterprise Single Sign-On · Renaissance Group</span>
                </div>
              </div>
            </div>

            {/* Footer info */}
            <div className="mt-4 text-center text-xs text-slate-500">
              Internal HR &amp; OD Portal · Authorized Access Only
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
