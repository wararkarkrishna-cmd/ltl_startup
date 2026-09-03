'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  Mail,
  Building2,
  Globe,
  LogIn,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [mcDotNumber, setMcDotNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('apex_logged_in', 'true');
      }
      setTimeout(() => {
        router.push('/integration');
      }, 600);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#f4f4f5] font-sans flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-white selection:text-black">
      {/* Dynamic Background Ambient Blur Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-white/[0.03] rounded-full blur-[150px] pointer-events-none" />

      {/* CENTERED INTENSE GLASSMORPHISM SIGNUP CONTAINER */}
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
              Create Your Brokerage Account
            </h1>
            <p className="text-xs text-neutral-400 font-sans">
              Get started in 60 seconds with zero IT support required.
            </p>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                Company / Brokerage Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-[#121215]/90 border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-all"
                  placeholder="Apex Freight Logistics LLC"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                MC / DOT License Number
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={mcDotNumber}
                  onChange={(e) => setMcDotNumber(e.target.value)}
                  className="w-full bg-[#121215]/90 border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-all"
                  placeholder="MC-984210"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
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
              <label className="block text-xs font-mono text-neutral-400 uppercase mb-1">
                Password
              </label>
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
                  <span>Provisioning Account & Vault...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Account Created! Opening Data Integration...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Start Integration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="pt-3 border-t border-neutral-800/80 text-center">
            <Link
              href="/login"
              className="text-xs text-neutral-400 hover:text-white font-sans font-semibold inline-flex items-center gap-1.5 transition"
            >
              <LogIn className="w-3.5 h-3.5 text-neutral-400" />
              <span>Already have an account? Sign In</span>
            </Link>
          </div>

          {/* Security Micro Badge */}
          <div className="pt-1 text-center text-[10px] text-neutral-500 font-mono flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
            <span>256-BIT ENCRYPTED • SOC2 TYPE II COMPLIANT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
