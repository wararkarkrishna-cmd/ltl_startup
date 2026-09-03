'use client';

import React, { useState, useEffect } from 'react';
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
  Eye,
  KanbanSquare,
  DollarSign,
  Camera,
  TrendingUp,
  Server,
  FileCheck2,
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
            href="/signup"
            className="text-xs font-sans font-medium text-black bg-white hover:bg-neutral-200 px-4 py-2 rounded-xl transition-all shadow font-bold flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </Link>
        </div>
      </header>

      {/* SECTION 1: HERO & INTENSE GLASSMORPHISM LOGIN CONTAINER */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column: Brand Hero Title & Value Proposition */}
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#09090b] border border-[#27272a] text-neutral-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>BROKER AUTHENTICATION PORTAL</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight leading-[1.15] font-normal">
              Sign In to Your LTL Freight Operating System
            </h1>
            <p className="text-base sm:text-lg text-neutral-300 max-w-2xl font-sans leading-relaxed">
              Access your real-time RFQ intake desk, multi-carrier BYOC rating matrix, 10-stage dispatch Kanban, and sub-60 second geotagged POD settlement.
            </p>
          </div>

          {/* Quick Metrics Bento Banner */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-mono text-neutral-400 uppercase">AI Extraction</span>
              <div className="text-2xl font-mono font-bold text-white tracking-tight">28 ms</div>
              <div className="text-[11px] text-neutral-400 font-sans">100% Accuracy</div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-mono text-neutral-400 uppercase">Gross Margin</span>
              <div className="text-2xl font-mono font-bold text-white tracking-tight">14.8%</div>
              <div className="text-[11px] text-neutral-400 font-sans">$75.00/load Floor</div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-mono text-neutral-400 uppercase">Carrier Rating</span>
              <div className="text-2xl font-mono font-bold text-white tracking-tight">5 Tier-1</div>
              <div className="text-[11px] text-neutral-400 font-sans">BYOC + Wholesale</div>
            </div>
          </div>

          {/* Core System Guarantees */}
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[#27272a] text-xs text-neutral-400 font-sans">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>FMCSA § 379 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>AES-256 Bit Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>99.99% Uptime SLA</span>
            </div>
          </div>
        </div>

        {/* Right Column: INTENSE GLASSMORPHISM LOGIN CONTAINER */}
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
                <Link href="/signup" className="text-xs text-neutral-400 hover:text-white underline font-mono transition">
                  Need an account?
                </Link>
              </div>
              <h2 className="text-2xl font-serif text-white font-normal pt-1">
                Sign In to Operating System
              </h2>
              <p className="text-xs text-neutral-400 font-sans">
                Enter your authorized work email & password to open the software dashboard.
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
                  <span className="text-[11px] text-neutral-500 hover:text-white cursor-pointer transition">
                    Forgot password?
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
                    <span>Authenticating Brokerage Tenant...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    <span>Success! Opening Software Dashboard...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In &amp; Open Software</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Instant Demo Login Button */}
            <div className="pt-4 border-t border-neutral-800/80 text-center space-y-3">
              <button
                type="button"
                onClick={handleDirectDemoLogin}
                className="w-full py-2.5 rounded-xl bg-[#121215] hover:bg-[#18181b] border border-neutral-800 text-white font-sans text-xs font-medium flex items-center justify-center gap-2 transition"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>Instant Demo Login (Skip Credentials)</span>
              </button>

              <div className="text-center pt-1">
                <Link
                  href="/signup"
                  className="text-xs text-neutral-400 hover:text-white font-sans font-semibold inline-flex items-center gap-1 transition"
                >
                  <span>First time here? Create an Account</span>
                  <ArrowRight className="w-3 h-3 text-neutral-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: LONG PAGE CONTENT — 6 PROCUREMENT LIFECYCLE MODULES */}
      <section className="border-t border-[#27272a] bg-[#09090b] py-20 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
              Autonomous Freight Procurement Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif text-white font-normal">
              Unified Operating Lifecycle in One System
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 font-sans leading-relaxed">
              Every phase engineered with intense performance SLAs to eliminate manual clerical overhead.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Module 1 */}
            <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-7 space-y-4 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#09090b] border border-neutral-800 flex items-center justify-center text-white">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Phase 1.1 – 1.9</span>
                  <h3 className="text-lg font-serif text-white">AI RFQ Ingestion & Density</h3>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Parses raw customer email bodies and attachments into structured manifests in 28ms with exact PCF density and NMFC classification.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-300">
                28ms Speed • 100% Benchmark
              </div>
            </div>

            {/* Module 2 */}
            <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-7 space-y-4 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#09090b] border border-neutral-800 flex items-center justify-center text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Phase 2.1 – 2.9</span>
                  <h3 className="text-lg font-serif text-white">Rating & Split Optimizer</h3>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Simultaneously rates across BYOC tariffs and wholesale contracts with knapsack split optimization saving $200–$400 per shipment.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-300">
                5 Tier-1 Tariffs • SSE Streaming
              </div>
            </div>

            {/* Module 3 */}
            <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-7 space-y-4 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#09090b] border border-neutral-800 flex items-center justify-center text-white">
                  <KanbanSquare className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Phase 3.1 – 3.8</span>
                  <h3 className="text-lg font-serif text-white">Dispatch & VICS eBOL</h3>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  10-stage lifecycle Kanban state machine with automated EDI 204/990 dispatches and machine-readable GS1-128 barcode eBOL PDFs.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-300">
                10-Stage Kanban • FMCSA Gate
              </div>
            </div>

            {/* Module 4 */}
            <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-7 space-y-4 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#09090b] border border-neutral-800 flex items-center justify-center text-white">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Phase 4.1 – 4.4</span>
                  <h3 className="text-lg font-serif text-white">Geotagged POD & Billing</h3>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Driver mobile PWA signature capture with 0.5-mile Haversine GPS geofence validation issuing customer invoices in &lt;60 seconds.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-300">
                0.5mi Geofence • &lt;60s Invoicing
              </div>
            </div>

            {/* Module 5 */}
            <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-7 space-y-4 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#09090b] border border-neutral-800 flex items-center justify-center text-white">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Phase 5.1 – 5.6</span>
                  <h3 className="text-lg font-serif text-white">Re-Bill Auditing & Disputes</h3>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Automated line-item comparison against carrier bills, 30-day FMCSA dispute tracking, and 20% recovery billing contingency fee capture.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-300">
                49 CFR 379 • 20% Recovery Fee
              </div>
            </div>

            {/* Module 6 */}
            <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-7 space-y-4 hover:border-neutral-600 transition shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#09090b] border border-neutral-800 flex items-center justify-center text-white">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Phase 6.1 – 6.7</span>
                  <h3 className="text-lg font-serif text-white">Embedded QuickPay Fintech</h3>
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Instant same-day RTP/FedNow payout rails with 2.5% take-rate spread monetization on double-entry general ledger with 1099-NEC automation.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-800 text-[11px] font-mono text-neutral-300">
                RTP / FedNow • 2.5% Take Rate
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: ENTERPRISE SECURITY & COMPLIANCE CERTIFICATIONS */}
      <section className="border-t border-[#27272a] bg-[#050507] py-20 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121215] border border-neutral-800 text-neutral-400 font-mono text-xs">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>HARDENED SECURITY VAULT</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif text-white font-normal">
              Bank-Grade Compliance & FMCSA Standards
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 font-sans leading-relaxed">
              Every quote transaction, carrier rating log, eBOL document, and QuickPay disbursement is cryptographically sealed in an immutable S3 WORM vault.
            </p>
            <div className="pt-2 flex flex-col gap-3 text-xs font-sans text-neutral-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>SHA-256 Merkle tree document audit trails</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>30-Day bank routing freeze for carrier fraud protection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>FMCSA § 379 statutory 3-year record retention locks</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#09090b] border border-[#27272a] rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#121215] border border-neutral-800 p-5 rounded-2xl space-y-2">
                <Server className="w-5 h-5 text-neutral-300" />
                <h4 className="font-serif text-white text-base">SOC2 Type II Audit</h4>
                <p className="text-xs text-neutral-400 font-sans">
                  Annual third-party security audits verifying end-to-end data privacy and tenant isolation.
                </p>
              </div>

              <div className="bg-[#121215] border border-neutral-800 p-5 rounded-2xl space-y-2">
                <ShieldCheck className="w-5 h-5 text-neutral-300" />
                <h4 className="font-serif text-white text-base">FMCSA Gatekeeper</h4>
                <p className="text-xs text-neutral-400 font-sans">
                  Real-time QCMobile background checks verifying $1M auto liability insurance before tender.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#121215] border border-neutral-800 text-center space-y-3">
              <span className="text-xs text-neutral-400 font-mono">READY TO ELEVATE YOUR FREIGHT BROKERAGE?</span>
              <div>
                <button
                  onClick={handleDirectDemoLogin}
                  className="px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs shadow-lg transition"
                >
                  Sign In &amp; Open Software Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: MINIMAL FOOTER */}
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
