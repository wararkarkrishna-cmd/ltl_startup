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
  Key,
  Mail,
  Building2,
  User,
  Globe,
  Layers,
  FileText,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('broker@apex-freight.com');
  const [password, setPassword] = useState('••••••••••••');
  const [companyName, setCompanyName] = useState('Apex Freight Logistics LLC');
  const [mcDotNumber, setMcDotNumber] = useState('MC-984210 / DOT-382910');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/integration');
      }, 800);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Dynamic Background Gradients & Micro-Glow Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Brand Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white">APEX</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                LTL OS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">ENTERPRISE FREIGHT OPERATING SYSTEM</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>SOC2 Type II Certified • 256-Bit Encrypted</span>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 px-4 py-2 rounded-lg"
          >
            Explore System Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10 my-auto">
        {/* Left Side: Value Proposition & 1-Minute Onboarding Promise */}
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>Zero IT Support Required • Get Started in 60 Seconds</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              The Next-Gen Operating System Built for <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">Real Freight Brokers</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
              Connect your existing carrier contracts, forward RFQ emails, and import historical customer CSVs in under 1 minute.
            </p>
          </div>

          {/* 5 Modes of Integration Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">1. Email Shadow Ingestion</h3>
              </div>
              <p className="text-xs text-slate-400">Auto-forward RFQ emails from Outlook/Gmail. AI parses & quotes in 15 seconds.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">2. BYOC Carrier Vault</h3>
              </div>
              <p className="text-xs text-slate-400">Connect XPO, Saia, Estes, ABF, R+L accounts with encrypted instant rating.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">3. Magic AI CSV Importer</h3>
              </div>
              <p className="text-xs text-slate-400">Drag & drop customer/lane CSVs. AI auto-maps headers in 5 seconds.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">4. 1-Click Accounting Sync</h3>
              </div>
              <p className="text-xs text-slate-400">1-click OAuth sync for QuickBooks Online & Xero chart of accounts.</p>
            </div>
          </div>

          {/* Social Proof Footer */}
          <div className="flex items-center gap-6 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>FMCSA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>AES-256 Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>99.99% Uptime SLA</span>
            </div>
          </div>
        </div>

        {/* Right Side: High-Converting Auth Card */}
        <div className="lg:col-span-5">
          <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl shadow-indigo-950/50 relative">
            <div className="flex items-center justify-between p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  authMode === 'signup'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Broker Account (60s)
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  authMode === 'login'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">
                {authMode === 'signup' ? 'Start 1-Minute Setup' : 'Welcome Back, Broker'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {authMode === 'signup'
                  ? 'No credit card required. Instantly unlock AI quoting & carrier rating.'
                  : 'Enter your credentials to access your executive dispatch dashboard.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Brokerage Name</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        placeholder="Apex Freight Logistics LLC"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">MC / DOT License Number</label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={mcDotNumber}
                        onChange={(e) => setMcDotNumber(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        placeholder="MC-984210"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Work Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="broker@yourcompany.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Provisioning Tenant & Storage Vault...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Account Created! Launching Integration Hub...</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === 'signup' ? 'Launch 1-Minute Setup Wizard' : 'Sign In to Operating System'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Login Option */}
            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@apex-freight.com');
                  setCompanyName('Apex Freight Solutions LLC');
                  setAuthMode('login');
                  setTimeout(() => {
                    router.push('/integration');
                  }, 400);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center justify-center gap-1.5 mx-auto"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Instant Demo Login (Skip Form)</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500 z-10 border-t border-slate-900">
        © 2026 Apex Freight Operating System • Built for Real Freight Brokerages
      </footer>
    </div>
  );
}
