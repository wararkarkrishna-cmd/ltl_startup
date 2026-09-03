'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  CheckCircle2,
  Mail,
  UserPlus,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('broker@apex-freight.com');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('apex_logged_in', 'true');
      }
      setTimeout(() => {
        router.push('/');
      }, 600);
    }, 800);
  };

  const handleDirectDemoLogin = () => {
    setEmail('broker@apex-freight.com');
    setPassword('••••••••••••');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('apex_logged_in', 'true');
      }
      setTimeout(() => {
        router.push('/');
      }, 400);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#f4f4f5] font-sans flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-white selection:text-black">
      {/* Dynamic Background Ambient Blur Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-white/[0.03] rounded-full blur-[150px] pointer-events-none" />

      {/* CENTERED INTENSE GLASSMORPHISM LOGIN CONTAINER */}
      <div className="max-w-md w-full relative z-10">
        {/* Outer Intense Glass Backlight Glow */}
        <div className="absolute -inset-1.5 bg-gradient-to-tr from-white/10 via-neutral-700/20 to-white/15 rounded-[2.5rem] blur-2xl opacity-75 pointer-events-none" />

        <div className="relative rounded-3xl bg-[#09090b]/80 border border-white/15 backdrop-blur-3xl p-8 sm:p-10 shadow-[0_25px_80px_rgba(0,0,0,0.95)] space-y-7">
          {/* Brand Logo Header */}
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white mx-auto shadow-lg">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="font-serif text-2xl text-white tracking-tight font-normal">APEX</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">
                  LTL OS v3.8
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono tracking-wider mt-1">ENTERPRISE FREIGHT OPERATING SYSTEM</p>
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="text-center space-y-1 pt-1 border-t border-neutral-800/80">
            <h1 className="text-xl font-serif text-white font-normal pt-3">
              Sign In to Your Account
            </h1>
            <p className="text-xs text-neutral-400 font-sans">
              Enter your work email and password to access the software.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-neutral-400 uppercase mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#121215]/90 border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-all"
                  placeholder="broker@yourcompany.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-mono text-neutral-400 uppercase">
                  Password
                </label>
                <span className="text-[11px] text-neutral-500 hover:text-white cursor-pointer transition font-mono">
                  Forgot?
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#121215]/90 border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-all"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full py-3.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs tracking-wide shadow-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Authenticating Account...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Success! Opening Software...</span>
                </>
              ) : (
                <>
                  <span>Sign In &amp; Open Software</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login & Switch to Signup */}
          <div className="pt-4 border-t border-neutral-800/80 space-y-3 text-center">
            <button
              type="button"
              onClick={handleDirectDemoLogin}
              className="w-full py-2.5 rounded-xl bg-[#121215] hover:bg-[#18181b] border border-neutral-800 text-white font-sans text-xs font-medium flex items-center justify-center gap-2 transition"
            >
              <Zap className="w-3.5 h-3.5 text-white" />
              <span>Instant Demo Login (Skip Credentials)</span>
            </button>

            <div className="pt-1">
              <Link
                href="/signup"
                className="text-xs text-neutral-400 hover:text-white font-sans font-semibold inline-flex items-center gap-1.5 transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-neutral-400" />
                <span>Don&apos;t have an account? Create Account</span>
              </Link>
            </div>
          </div>

          {/* Security Micro Badge */}
          <div className="pt-2 text-center text-[10px] text-neutral-500 font-mono flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
            <span>256-BIT ENCRYPTED • SOC2 TYPE II COMPLIANT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
