'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  Key,
  FileText,
  Layers,
  Puzzle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Upload,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  Building2,
  Database,
  ExternalLink,
  HelpCircle,
  Sparkles,
  Download,
  Info,
} from 'lucide-react';
import { AppHeader } from '../../components/navigation/AppHeader';
import { AppSidebar } from '../../components/navigation/AppSidebar';

export const dynamic = 'force-dynamic';

function IntegrationPageContent() {

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'byoc' | 'csv' | 'accounting' | 'extension'>('email');
  
  // Progress State
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [byocConfigured, setByocConfigured] = useState(false);
  const [csvConfigured, setCsvConfigured] = useState(false);
  const [accountingConfigured, setAccountingConfigured] = useState(false);
  const [extensionConfigured, setExtensionConfigured] = useState(false);

  // Email Ingestion State
  const shadowEmail = 'rfq-apex-7080@inbound.freight.ai';
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [simulatingEmailTest, setSimulatingEmailTest] = useState(false);
  const [emailTestSuccess, setEmailTestSuccess] = useState(false);

  // BYOC Vault Form State
  const [carrierInputs, setCarrierInputs] = useState({
    XPO: { account: 'XPO-884210', apiKey: 'xpo_live_sec_99481a', status: 'IDLE' },
    SAIA: { account: 'SAIA-98412', apiKey: 'saia_live_sec_77412b', status: 'IDLE' },
    ESTES: { account: 'EXLA-33291', apiKey: 'exla_live_sec_11092c', status: 'IDLE' },
    ABF: { account: 'ABFS-71092', apiKey: 'abf_live_sec_44810d', status: 'IDLE' },
    RL: { account: 'RLCA-44210', apiKey: 'rl_live_sec_88391e', status: 'IDLE' },
  });

  // CSV Importer State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<any | null>(null);
  const [csvImportSuccess, setCsvImportSuccess] = useState(false);

  // Accounting OAuth State
  const [qboConnected, setQboConnected] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);

  // Sidecar API Key
  const [sidecarApiKey, setSidecarApiKey] = useState('apex_ext_live_9948102941829014');
  const [copiedSidecarKey, setCopiedSidecarKey] = useState(false);

  // Calculate Overall Completion
  const completedSteps = [emailConfigured, byocConfigured, csvConfigured, accountingConfigured, extensionConfigured].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 5) * 100);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(shadowEmail);
    setCopiedEmail(true);
    setEmailConfigured(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleTestEmailInbound = () => {
    setSimulatingEmailTest(true);
    setTimeout(() => {
      setSimulatingEmailTest(false);
      setEmailTestSuccess(true);
      setEmailConfigured(true);
    }, 1200);
  };

  const handleTestCarrierConn = (carrierCode: keyof typeof carrierInputs) => {
    setCarrierInputs((prev) => ({
      ...prev,
      [carrierCode]: { ...prev[carrierCode], status: 'TESTING' },
    }));

    setTimeout(() => {
      setCarrierInputs((prev) => ({
        ...prev,
        [carrierCode]: { ...prev[carrierCode], status: 'CONNECTED' },
      }));
      setByocConfigured(true);
    }, 1000);
  };

  const handleSimulateCsvUpload = () => {
    setIsUploadingCsv(true);
    setTimeout(() => {
      setIsUploadingCsv(false);
      setCsvPreviewData({
        fileName: 'Apex_Customer_Lanes_2026.csv',
        totalRows: 142,
        mappedFields: [
          { header: 'Cust_Company_Name', mappedTo: 'customerName', confidence: '100% Exact' },
          { header: 'Shipper_Zip', mappedTo: 'originZip', confidence: '100% Exact' },
          { header: 'Consignee_Zip', mappedTo: 'destZip', confidence: '100% Exact' },
          { header: 'Contract_Discount_%', mappedTo: 'marginMarkup', confidence: '98.5% AI Match' },
          { header: 'Monthly_Pallet_Vol', mappedTo: 'volumeMonthly', confidence: '95.0% Match' },
        ],
      });
    }, 1200);
  };

  const handleFinalizeCsvImport = () => {
    setCsvImportSuccess(true);
    setCsvConfigured(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <AppHeader isSidebarCollapsed={isSidebarCollapsed} />

      <div className="flex-1 flex overflow-hidden">
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-950">
          {/* Header Banner & Guided Day-1 Assistant */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-blue-950/80 border border-indigo-500/30 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> 1-Minute Zero-Friction Setup
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Tenant ID: 01916362-7901</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  Broker Integration & Data Onboarding Hub
                </h1>
                <p className="text-xs lg:text-sm text-slate-300 max-w-3xl">
                  Connect your existing carrier accounts, forward shipper emails, import historical CSVs, and sync accounting in under 60 seconds.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Link
                    href="/"
                    className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-2 shadow-xl transition"
                  >
                    <span>Proceed to Operational Software</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>


              {/* Day-1 Broker Readiness Progress Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg min-w-[280px]">

                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">Day-1 Setup Progress</span>
                  <span className="font-mono font-extrabold text-indigo-400">{progressPercent}% Ready</span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{completedSteps} of 5 Integrations Active</span>
                  {progressPercent === 100 ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully Active
                    </span>
                  ) : (
                    <span className="text-indigo-400 font-semibold">Complete Below ↓</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5 Integration Method Navigation Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                activeTab === 'email'
                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Mail className={`w-4 h-4 ${activeTab === 'email' ? 'text-indigo-400' : 'text-slate-500'}`} />
                {emailConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-bold">1. Email Shadowing</div>
              <div className="text-[10px] text-slate-400 mt-0.5">0 IT Setup (Outlook/Gmail)</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('byoc')}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                activeTab === 'byoc'
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-600/10'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Key className={`w-4 h-4 ${activeTab === 'byoc' ? 'text-blue-400' : 'text-slate-500'}`} />
                {byocConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-bold">2. BYOC Carrier Vault</div>
              <div className="text-[10px] text-slate-400 mt-0.5">XPO, Saia, Estes, ABF, R+L</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                activeTab === 'csv'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-600/10'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <FileText className={`w-4 h-4 ${activeTab === 'csv' ? 'text-emerald-400' : 'text-slate-500'}`} />
                {csvConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-bold">3. Magic AI CSV Import</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Auto-header matching</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('accounting')}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                activeTab === 'accounting'
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-600/10'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Layers className={`w-4 h-4 ${activeTab === 'accounting' ? 'text-purple-400' : 'text-slate-500'}`} />
                {accountingConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-bold">4. 1-Click Accounting</div>
              <div className="text-[10px] text-slate-400 mt-0.5">QuickBooks Online & Xero</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('extension')}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                activeTab === 'extension'
                  ? 'bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-600/10'
                  : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Puzzle className={`w-4 h-4 ${activeTab === 'extension' ? 'text-amber-400' : 'text-slate-500'}`} />
                {extensionConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <div className="text-xs font-bold">5. Extension & Sidecar</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Outlook & Chrome Add-in</div>
            </button>
          </div>

          {/* TAB 1: EMAIL SHADOW INGESTION */}
          {activeTab === 'email' && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Method 1: Email Shadow Ingestion Setup</h2>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                      Zero IT Setup
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Auto-forward incoming RFQ emails or PDFs from shippers. Our AI extracts load details and generates rate options in 15s.
                  </p>
                </div>
              </div>

              {/* Unique Shadow Email Provisioning Card */}
              <div className="p-5 rounded-xl bg-slate-950 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Dedicated Inbound RFQ Email</div>
                  <div className="text-base font-mono font-bold text-indigo-400 bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-500/30 inline-block">
                    {shadowEmail}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    {copiedEmail ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedEmail ? 'Copied to Clipboard!' : 'Copy Address'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestEmailInbound}
                    disabled={simulatingEmailTest}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all border border-slate-700"
                  >
                    {simulatingEmailTest ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    ) : (
                      <Zap className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Simulate Inbound RFQ Test</span>
                  </button>
                </div>
              </div>

              {emailTestSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Inbound email simulation successful! RFQ parsed (4 Pallets HVAC, LA to Chicago) and queued in Fast Review.</span>
                  </div>
                  <Link href="/review/01916362-7901-7080-867c-9b8895092s01" className="font-bold underline text-emerald-200">
                    View Extracted RFQ →
                  </Link>
                </div>
              )}

              {/* Step-by-Step Guide for Outlook & Gmail */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center">
                      1
                    </span>
                    <span>Microsoft Outlook Auto-Forward Rule (30s)</span>
                  </div>
                  <ol className="text-xs text-slate-400 space-y-1.5 pl-7 list-decimal">
                    <li>Open Outlook $\rightarrow$ Settings $\rightarrow$ Rules $\rightarrow$ Add New Rule.</li>
                    <li>Set condition: <i>Subject contains "RFQ", "Rate Quote", or "Freight Inquiry"</i>.</li>
                    <li>Set action: <i>Forward to {shadowEmail}</i>.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
                      2
                    </span>
                    <span>Google Workspace / Gmail Rule (30s)</span>
                  </div>
                  <ol className="text-xs text-slate-400 space-y-1.5 pl-7 list-decimal">
                    <li>Go to Gmail Settings $\rightarrow$ Forwarding and POP/IMAP.</li>
                    <li>Click <i>Add a forwarding address</i> and paste <code className="text-indigo-300">{shadowEmail}</code>.</li>
                    <li>Create filter for subject terms: <i>quote, RFQ, shipment</i>.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BYOC CARRIER VAULT */}
          {activeTab === 'byoc' && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="border-b border-slate-800/80 pb-4">
                <h2 className="text-lg font-bold text-white">Method 2: BYOC Carrier Vault (Bring Your Own Carrier)</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect your direct carrier accounts. Our engine rates your contracted tariffs alongside our Platform Master Wholesale tiers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { code: 'XPO' as const, name: 'XPO Logistics', scac: 'CNWY', logo: 'XPO' },
                  { code: 'SAIA' as const, name: 'SAIA LTL Freight', scac: 'SAIA', logo: 'SAIA' },
                  { code: 'ESTES' as const, name: 'Estes Express Lines', scac: 'EXLA', logo: 'ESTES' },
                  { code: 'ABF' as const, name: 'ArcBest / ABF Freight', scac: 'ABFS', logo: 'ABF' },
                  { code: 'RL' as const, name: 'R+L Carriers', scac: 'RLCA', logo: 'R+L' },
                ].map((c) => {
                  const state = carrierInputs[c.code];
                  return (
                    <div key={c.code} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold text-xs flex items-center justify-center font-mono">
                            {c.logo}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{c.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">SCAC: {c.scac}</div>
                          </div>
                        </div>

                        {state.status === 'CONNECTED' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                            Ready
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Account Number</label>
                          <input
                            type="text"
                            value={state.account}
                            onChange={(e) =>
                              setCarrierInputs((prev) => ({
                                ...prev,
                                [c.code]: { ...prev[c.code], account: e.target.value },
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">API Auth Secret / Key</label>
                          <input
                            type="password"
                            value={state.apiKey}
                            onChange={(e) =>
                              setCarrierInputs((prev) => ({
                                ...prev,
                                [c.code]: { ...prev[c.code], apiKey: e.target.value },
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTestCarrierConn(c.code)}
                        disabled={state.status === 'TESTING'}
                        className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        {state.status === 'TESTING' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            <span>Pinging API Endpoint...</span>
                          </>
                        ) : state.status === 'CONNECTED' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Re-Test Credentials</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Save & Verify API Connection</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: MAGIC AI CSV IMPORTER */}
          {activeTab === 'csv' && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="border-b border-slate-800/80 pb-4">
                <h2 className="text-lg font-bold text-white">Method 3: Magic AI CSV & Legacy Data Importer</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Drag and drop any customer list or historical lane CSV from McLeod, Tai Software, Rose Rocket, or Excel.
                </p>
              </div>

              {!csvPreviewData ? (
                <div
                  onClick={handleSimulateCsvUpload}
                  className="p-8 rounded-2xl border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/60 hover:bg-slate-950 cursor-pointer text-center space-y-3 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Drag & Drop Customer / Lane CSV File Here</h3>
                    <p className="text-xs text-slate-400 mt-1">Supports McLeod, Tai, Rose Rocket, CSV, or Excel (.xlsx)</p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors inline-block shadow-lg shadow-emerald-600/20"
                  >
                    Select File to AI Auto-Map
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      <div>
                        <div className="text-xs font-bold text-white">{csvPreviewData.fileName}</div>
                        <div className="text-[10px] text-slate-400">{csvPreviewData.totalRows} Records Detected</div>
                      </div>
                    </div>

                    {!csvImportSuccess ? (
                      <button
                        type="button"
                        onClick={handleFinalizeCsvImport}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm AI Import (142 Records)</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> 142 Records Seeded to Database
                      </span>
                    )}
                  </div>

                  {/* AI Header Auto-Match Mapping Table */}
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5">CSV File Column Header</th>
                          <th className="p-2.5">Auto-Mapped System Field</th>
                          <th className="p-2.5">AI Matching Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {csvPreviewData.mappedFields.map((f: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2.5 font-mono text-indigo-300">{f.header}</td>
                            <td className="p-2.5 font-mono text-emerald-400 font-bold">➔ {f.mappedTo}</td>
                            <td className="p-2.5 font-mono text-slate-400">{f.confidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: 1-CLICK ACCOUNTING SYNC */}
          {activeTab === 'accounting' && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="border-b border-slate-800/80 pb-4">
                <h2 className="text-lg font-bold text-white">Method 4: 1-Click Accounting & ERP OAuth Sync</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect your accounting software so customer invoices and carrier payouts automatically sync without double data entry.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm flex items-center justify-center font-mono">
                        QBO
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">QuickBooks Online</div>
                        <div className="text-xs text-slate-400">Intuit Accounting Engine</div>
                      </div>
                    </div>
                    {qboConnected ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono">Disconnected</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Syncs Chart of Accounts, open AR invoices, and AP carrier vouchers in real time.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQboConnected(true);
                      setAccountingConfigured(true);
                    }}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    {qboConnected ? 'Re-Sync QuickBooks Online' : 'Connect to QuickBooks Online (1-Click OAuth)'}
                  </button>
                </div>

                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center font-mono">
                        XERO
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Xero Cloud Accounting</div>
                        <div className="text-xs text-slate-400">Global Financial Ledger</div>
                      </div>
                    </div>
                    {xeroConnected ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono">Disconnected</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Automatic reconciliation for multi-currency freight invoices and QuickPay disbursements.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setXeroConnected(true);
                      setAccountingConfigured(true);
                    }}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-lg shadow-blue-600/20"
                  >
                    {xeroConnected ? 'Re-Sync Xero Ledger' : 'Connect to Xero Accounting (1-Click OAuth)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BROWSER EXTENSION & OUTLOOK SIDECAR */}
          {activeTab === 'extension' && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="border-b border-slate-800/80 pb-4">
                <h2 className="text-lg font-bold text-white">Method 5: Outlook Add-in & Chrome Extension Sidecar</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Quote and dispatch freight directly inside Outlook or Chrome without ever changing tabs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <Puzzle className="w-8 h-8 text-amber-400" />
                    <div>
                      <div className="text-sm font-bold text-white">Chrome & Outlook Sidecar Extension</div>
                      <div className="text-xs text-slate-400">Version 2.4 • Freight Broker Co-Pilot</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Your Sidecar API Authentication Token</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={sidecarApiKey}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-indigo-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(sidecarApiKey);
                          setCopiedSidecarKey(true);
                          setExtensionConfigured(true);
                          setTimeout(() => setCopiedSidecarKey(false), 2000);
                        }}
                        className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        {copiedSidecarKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedSidecarKey ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setExtensionConfigured(true)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Chrome Extension</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>How to Use Sidecar in Outlook</span>
                  </div>
                  <ol className="text-xs text-slate-400 space-y-2 pl-5 list-decimal">
                    <li>Install the extension in Chrome or Outlook.</li>
                    <li>Paste your sidecar API token generated on the left.</li>
                    <li>When opening an email from a shipper, click <b>"Apex Co-Pilot Quote"</b>.</li>
                    <li>The sidebar automatically shows rates from XPO, Saia, Estes, and 1-click replies to the shipper.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* GUIDED BROKER HOW-TO WALKTHROUGH CARD */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/60 border border-indigo-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">How to Use All 5 Integration Methods in Your Daily Workflow</h3>
              </div>
              <span className="text-xs text-indigo-300 font-semibold">Broker Quick-Reference Guide</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-indigo-400">1. Email Shadowing</div>
                <div className="text-slate-400">Forward RFQ emails to your custom inbox. AI extracts load details and drafts quotes in 15 seconds.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-blue-400">2. BYOC Vault</div>
                <div className="text-slate-400">Enter carrier account numbers. Rating matrix automatically pulls your direct discount tariffs.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-emerald-400">3. Magic AI CSV</div>
                <div className="text-slate-400">Upload customer lists. AI maps headers automatically to seed your database in 5 seconds.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-purple-400">4. Accounting Sync</div>
                <div className="text-slate-400">1-click QuickBooks/Xero link. Delivered loads auto-issue customer invoices with zero manual data entry.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="font-bold text-amber-400">5. Outlook Sidecar</div>
                <div className="text-slate-400">Use the Chrome/Outlook sidebar to quote and dispatch loads directly inside email.</div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-2 shadow-xl transition"
              >
                <span>Proceed to Operating Software Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

export default function IntegrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white p-8">Loading Integration Hub...</div>}>
      <IntegrationPageContent />
    </Suspense>
  );
}

