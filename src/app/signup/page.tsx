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
  Sparkles,
  CheckCircle2,
  Mail,
  Building2,
  Globe,
  User,
  Key,
  Layers,
  FileText,
  UserPlus,
  LogIn,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function CreateAccountPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('Apex Freight Logistics LLC');
  const [mcDotNumber, setMcDotNumber] = useState('MC-984210 / DOT-382910');
  const [email, setEmail] = useState('broker@apex-freight.com');
  const [password, setPassword] = useState('••••••••••••');
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

  const handleDirectDemoSetup = () => {
    setCompanyName('Apex Freight Logistics LLC');
    setMcDotNumber('MC-984210 / DOT-382910');
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
        router.push('/integration');
      }, 400);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#f4f4f5] font-sans relative overflow-x-hidden selection:bg-white selection:text-black">
      {/* Dynamic Background Ambient Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-white/5 via-neutral-900/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[800px] right-0 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      {/* Top Luxury Brand Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#050507]/80 backdrop-blur-xl border-b border-[#27272a]/60 px-6 lg:px-12 py-4 flex items-center justify-between">
        <Link href="/login" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white group-hover:border-neutral-500 transition-all shadow-lg">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl text-white tracking-tight font-normal">APEX</span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">
                LTL OS v3.8
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-mono tracking-wider">ENTERPRISE FREIGHT OPERATING SYSTEM</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400 bg-[#09090b] border border-[#27272a] px-3.5 py-1.5 rounded-full font-mono">
            <ShieldCheck className="w-4 h-4 text-white" />
            <span>SOC2 TYPE II CERTIFIED • 256-BIT ENCRYPTED</span>
          </div>
          <Link
            href="/login"
            className="text-xs font-sans font-medium text-white bg-[#121215] hover:bg-[#18181b] border border-neutral-800 px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 font-semibold"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        </div>
      </header>

      {/* SECTION 1: HERO & INTENSE GLASSMORPHISM CREATE ACCOUNT CONTAINER */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column: Value Proposition & 60-Second Provisioning Promise */}
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#09090b] border border-[#27272a] text-neutral-300 text-xs font-mono">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
            <span>ZERO IT SUPPORT REQUIRED • GET STARTED IN 60 SECONDS</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight leading-[1.15] font-normal">
              Create Your Enterprise Brokerage Account
            </h1>
            <p className="text-base sm:text-lg text-neutral-300 max-w-2xl font-sans leading-relaxed">
              Connect your carrier contracts, auto-forward customer RFQ emails, and import lane CSVs in under 1 minute.
            </p>
          </div>

          {/* 4 Integration Cards Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-sm text-white">1. Email Shadow Ingestion</h3>
              </div>
              <p className="text-xs text-neutral-400 font-sans">
                Auto-forward customer RFQ emails from Outlook or Gmail. AI quotes in 28ms.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-sm text-white">2. BYOC Carrier Vault</h3>
              </div>
              <p className="text-xs text-neutral-400 font-sans">
                Connect XPO, Saia, Estes, ABF & R+L tariffs with encrypted real-time rating.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-sm text-white">3. Magic AI CSV Importer</h3>
              </div>
              <p className="text-xs text-neutral-400 font-sans">
                Drag & drop customer shipment CSVs. AI auto-maps headers in 5 seconds.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#09090b] border border-[#27272a] hover:border-neutral-600 transition space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-sm text-white">4. 1-Click Accounting Sync</h3>
              </div>
              <p className="text-xs text-neutral-400 font-sans">
                1-click OAuth sync for QuickBooks Online & Xero general ledger accounts.
              </p>
            </div>
          </div>

          {/* Core Guarantees */}
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[#27272a] text-xs text-neutral-400 font-sans">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>FMCSA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>AES-256 Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>99.99% Uptime SLA</span>
            </div>
          </div>
        </div>

        {/* Right Column: INTENSE GLASSMORPHISM CREATE ACCOUNT CARD */}
        <div className="lg:col-span-5 relative">
          {/* Intense Outer Glass Reflection & Glow */}
          <div className="absolute -inset-1.5 bg-gradient-to-tr from-white/10 via-neutral-700/20 to-white/15 rounded-[2.5rem] blur-2xl opacity-75 pointer-events-none" />

          <div className="relative rounded-3xl bg-[#09090b]/75 border border-white/15 backdrop-blur-3xl p-8 sm:p-10 shadow-[0_25px_70px_rgba(0,0,0,0.9)] space-y-6">
            {/* Header Text */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px] font-bold">
                  STEP 1 OF 2
                </span>
                <Link href="/login" className="text-xs text-neutral-400 hover:text-white underline font-mono transition">
                  Already registered?
                </Link>
              </div>
              <h2 className="text-2xl font-serif text-white font-normal pt-1">
                Create Broker Account
              </h2>
              <p className="text-xs text-neutral-400 font-sans">
                Provision your tenant & unlock AI quoting & carrier rating in 60 seconds.
              </p>
            </div>

            {/* Create Account Form */}
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-neutral-400 uppercase mb-1.5">
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
                <label className="block text-xs font-mono text-neutral-400 uppercase mb-1.5">
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
                    placeholder="MC-984210 / DOT-382910"
                  />
                </div>
              </div>

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
                <label className="block text-xs font-mono text-neutral-400 uppercase mb-1.5">
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
                    <span>Provisioning Tenant & Storage Vault...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    <span>Account Created! Opening Integration Hub...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account &amp; Proceed to Integration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Setup */}
            <div className="pt-4 border-t border-neutral-800/80 text-center space-y-3">
              <button
                type="button"
                onClick={handleDirectDemoSetup}
                className="w-full py-2.5 rounded-xl bg-[#121215] hover:bg-[#18181b] border border-neutral-800 text-white font-sans text-xs font-medium flex items-center justify-center gap-2 transition"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>Instant Demo Setup (1-Click)</span>
              </button>

              <div className="text-center pt-1">
                <Link
                  href="/login"
                  className="text-xs text-neutral-400 hover:text-white font-sans font-semibold inline-flex items-center gap-1 transition"
                >
                  <span>Already registered? Sign In to your account</span>
                  <ArrowRight className="w-3 h-3 text-neutral-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FOOTER */}
      <footer className="border-t border-[#27272a] bg-[#050507] py-8 text-center text-xs text-neutral-500 font-mono relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© 2026 Apex Freight Operating System • Built for Enterprise LTL Freight Brokers</div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-400">
            <Link href="/login" className="hover:text-white transition">Sign In</Link>
            <span>•</span>
            <Link href="/signup" className="hover:text-white transition">Create Account</Link>
            <span>•</span>
            <Link href="/" className="hover:text-white transition">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
