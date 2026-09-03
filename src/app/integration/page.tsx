'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Mail,
  Key,
  FileText,
  Layers,
  Puzzle,
  CheckCircle2,
  Copy,
  Check,
  Upload,
  RefreshCw,
  Zap,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Download,
  Info,
  Building2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function IntegrationPageContent() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  // Progress State
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

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
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<any | null>(null);
  const [csvImportSuccess, setCsvImportSuccess] = useState(false);

  // Accounting OAuth State
  const [qboConnected, setQboConnected] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);

  // Sidecar API Key
  const sidecarApiKey = 'apex_ext_live_9948102941829014';
  const [copiedSidecarKey, setCopiedSidecarKey] = useState(false);

  const markStepComplete = (stepNum: number) => {
    setCompletedSteps((prev) => ({ ...prev, [stepNum]: true }));
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(shadowEmail);
    setCopiedEmail(true);
    markStepComplete(1);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleTestEmailInbound = () => {
    setSimulatingEmailTest(true);
    setTimeout(() => {
      setSimulatingEmailTest(false);
      setEmailTestSuccess(true);
      markStepComplete(1);
    }, 1000);
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
      markStepComplete(2);
    }, 900);
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
    }, 1000);
  };

  const handleFinalizeCsvImport = () => {
    setCsvImportSuccess(true);
    markStepComplete(3);
  };

  const handleFinishOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apex_onboarding_completed', 'true');
    }
    router.push('/');
  };

  const stepsList = [
    { num: 1, title: 'Email Shadowing', icon: Mail, subtitle: 'Forward RFQs from Outlook/Gmail' },
    { num: 2, title: 'BYOC Carrier Vault', icon: Key, subtitle: 'XPO, Saia, Estes, ABF, R+L' },
    { num: 3, title: 'Magic AI CSV Import', icon: FileText, subtitle: 'Drag & drop legacy data' },
    { num: 4, title: '1-Click Accounting', icon: Layers, subtitle: 'QuickBooks Online & Xero' },
    { num: 5, title: 'Outlook Extension', icon: Puzzle, subtitle: 'Quote directly inside email' },
  ];

  const activeStepProgress = Math.round((Object.keys(completedSteps).length / 5) * 100);

  return (
    <div className="min-h-screen bg-[#050507] text-[#f4f4f5] font-sans flex flex-col justify-between relative overflow-hidden selection:bg-white selection:text-black">
      {/* Background Ambient Blur Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/[0.02] rounded-full blur-[160px] pointer-events-none" />

      {/* STANDALONE TOP HEADER (NO DASHBOARD SIDEBAR) */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-10 border-b border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white shadow-md">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl text-white tracking-tight font-normal">APEX</span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">
                LTL OS v3.8
              </span>
            </div>
            <p className="text-[10px] text-neutral-500 font-mono tracking-wider">STANDALONE BROKER DATA ONBOARDING</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400 font-mono bg-[#0c0c0e] border border-neutral-800 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-300" />
            <span>Tenant: 01916362-7901</span>
          </div>
          <button
            onClick={handleFinishOnboarding}
            className="text-xs font-sans text-neutral-400 hover:text-white transition bg-[#121215] hover:bg-neutral-800 border border-neutral-800 px-4 py-2 rounded-xl flex items-center gap-1.5"
          >
            <span>Skip to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* MAIN DEDICATED ONBOARDING CONTAINER */}
      <main className="w-full max-w-6xl mx-auto px-6 py-8 flex-1 z-10 space-y-8 my-auto">
        {/* Onboarding Header Banner & Progress */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#09090b] border border-neutral-800 shadow-2xl relative overflow-hidden space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-mono">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>5-Step Zero-Friction Brokerage Setup</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-normal text-white tracking-tight">
                Data Integration &amp; Onboarding Wizard
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl font-sans">
                Follow these 5 steps to import customer lists, connect carrier contracts, forward RFQ emails, and link accounting.
              </p>
            </div>

            {/* Overall Progress Widget */}
            <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800/80 min-w-[240px]">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-neutral-400">Onboarding Completion</span>
                <span className="text-white font-bold">{activeStepProgress}%</span>
              </div>
              <div className="w-full h-2 bg-[#050507] rounded-full overflow-hidden border border-neutral-800 mb-2">
                <div
                  className="h-full bg-white transition-all duration-500"
                  style={{ width: `${activeStepProgress}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-neutral-500 text-right">
                {Object.keys(completedSteps).length} of 5 Completed
              </div>
            </div>
          </div>

          {/* 5-Step Horizontal Navigation Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stepsList.map((step) => {
              const Icon = step.icon;
              const isCurrent = currentStep === step.num;
              const isDone = completedSteps[step.num];

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num)}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    isCurrent
                      ? 'bg-white text-black border-white shadow-xl'
                      : 'bg-[#121215]/80 border-neutral-800/80 text-neutral-400 hover:text-white hover:bg-[#121215]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-mono font-bold flex items-center justify-center ${
                        isCurrent
                          ? 'bg-black text-white'
                          : isDone
                          ? 'bg-neutral-800 text-white'
                          : 'bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : step.num}
                    </span>
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-black' : 'text-neutral-500'}`} />
                  </div>
                  <div className={`text-xs font-sans font-bold ${isCurrent ? 'text-black' : 'text-white'}`}>
                    {step.title}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 truncate ${isCurrent ? 'text-neutral-700' : 'text-neutral-500'}`}>
                    {step.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 1: EMAIL SHADOW INGESTION */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Step 1 of 5</span>
                <h2 className="text-lg font-serif text-white font-normal">Email Shadow Ingestion Setup</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800 text-[10px] font-mono">
                0 IT Setup Required
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Auto-forward incoming shipper quote requests or attached PDFs from Outlook or Gmail. Our AI extracts load details and drafts rates in 15 seconds.
            </p>

            {/* Inbound Email Provision Card */}
            <div className="p-5 rounded-2xl bg-[#121215] border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-neutral-500 uppercase">Your Inbound Forwarding Address</div>
                <div className="text-sm sm:text-base font-mono font-bold text-white bg-[#050507] px-3.5 py-2 rounded-xl border border-neutral-800 inline-block">
                  {shadowEmail}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-2 transition shadow-md"
                >
                  {copiedEmail ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedEmail ? 'Copied!' : 'Copy Address'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestEmailInbound}
                  disabled={simulatingEmailTest}
                  className="px-4 py-2.5 rounded-xl bg-[#050507] hover:bg-neutral-900 text-neutral-300 font-sans font-bold text-xs flex items-center gap-2 border border-neutral-800 transition"
                >
                  {simulatingEmailTest ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Zap className="w-4 h-4 text-white" />
                  )}
                  <span>Simulate Test Email</span>
                </button>
              </div>
            </div>

            {emailTestSuccess && (
              <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-700 text-white text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Inbound simulation verified! RFQ parsed (4 Pallets HVAC, LA to Chicago).</span>
                </div>
                <span className="font-mono text-[11px] text-neutral-400">Step 1 Verified</span>
              </div>
            )}

            {/* Email Setup Guides */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-[#121215]/60 border border-neutral-800 space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-800 text-white text-[10px] font-mono flex items-center justify-center">
                    A
                  </span>
                  <span>Microsoft Outlook Forwarding Rule (30s)</span>
                </div>
                <ol className="text-xs text-neutral-400 space-y-1.5 pl-7 list-decimal font-sans">
                  <li>Open Outlook $\rightarrow$ Settings $\rightarrow$ Rules $\rightarrow$ Add New Rule.</li>
                  <li>Set condition: <i>Subject contains "RFQ", "Quote", or "Freight"</i>.</li>
                  <li>Set action: <i>Forward to {shadowEmail}</i>.</li>
                </ol>
              </div>

              <div className="p-5 rounded-2xl bg-[#121215]/60 border border-neutral-800 space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-800 text-white text-[10px] font-mono flex items-center justify-center">
                    B
                  </span>
                  <span>Gmail / Google Workspace Rule (30s)</span>
                </div>
                <ol className="text-xs text-neutral-400 space-y-1.5 pl-7 list-decimal font-sans">
                  <li>Go to Gmail Settings $\rightarrow$ Forwarding and POP/IMAP.</li>
                  <li>Click <i>Add forwarding address</i> and enter <code className="text-neutral-200">{shadowEmail}</code>.</li>
                  <li>Create filter for quote emails.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: BYOC CARRIER VAULT */}
        {currentStep === 2 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Step 2 of 5</span>
                <h2 className="text-lg font-serif text-white font-normal">BYOC Carrier Credentials Vault</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800 text-[10px] font-mono">
                AES-256 Encrypted
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Enter your direct carrier account numbers and API credentials. Our engine rates your contracted tariffs alongside wholesale platform rates.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { code: 'XPO' as const, name: 'XPO Logistics', scac: 'CNWY' },
                { code: 'SAIA' as const, name: 'SAIA LTL Freight', scac: 'SAIA' },
                { code: 'ESTES' as const, name: 'Estes Express Lines', scac: 'EXLA' },
                { code: 'ABF' as const, name: 'ArcBest / ABF Freight', scac: 'ABFS' },
                { code: 'RL' as const, name: 'R+L Carriers', scac: 'RLCA' },
              ].map((c) => {
                const state = carrierInputs[c.code];
                return (
                  <div key={c.code} className="p-5 rounded-2xl bg-[#121215] border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">{c.name}</div>
                        <div className="text-[10px] font-mono text-neutral-500">SCAC: {c.scac}</div>
                      </div>
                      {state.status === 'CONNECTED' ? (
                        <span className="px-2 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-mono border border-neutral-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-500 text-[10px] font-mono">
                          Ready
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-0.5">Account Number</label>
                        <input
                          type="text"
                          value={state.account}
                          onChange={(e) =>
                            setCarrierInputs((prev) => ({
                              ...prev,
                              [c.code]: { ...prev[c.code], account: e.target.value },
                            }))
                          }
                          className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-1.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-0.5">API Auth Secret / Key</label>
                        <input
                          type="password"
                          value={state.apiKey}
                          onChange={(e) =>
                            setCarrierInputs((prev) => ({
                              ...prev,
                              [c.code]: { ...prev[c.code], apiKey: e.target.value },
                            }))
                          }
                          className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-1.5 px-3 text-xs font-mono text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestCarrierConn(c.code)}
                      disabled={state.status === 'TESTING'}
                      className="w-full py-2 rounded-xl bg-[#050507] hover:bg-neutral-900 text-neutral-200 border border-neutral-800 text-xs font-sans font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      {state.status === 'TESTING' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Testing Connection...</span>
                        </>
                      ) : state.status === 'CONNECTED' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Re-Verify Credentials</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-white" />
                          <span>Save &amp; Verify Connection</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: MAGIC AI CSV IMPORTER */}
        {currentStep === 3 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Step 3 of 5</span>
                <h2 className="text-lg font-serif text-white font-normal">Magic AI CSV &amp; Legacy Data Importer</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800 text-[10px] font-mono">
                Auto-Header Mapping
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Drag and drop any exported CSV file from McLeod, Tai Software, Rose Rocket, or Excel. The AI automatically matches headers to seed your database.
            </p>

            {!csvPreviewData ? (
              <div
                onClick={handleSimulateCsvUpload}
                className="p-10 rounded-3xl border border-dashed border-neutral-800 hover:border-neutral-600 bg-[#121215]/50 hover:bg-[#121215] cursor-pointer text-center space-y-3 transition group"
              >
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 text-white flex items-center justify-center mx-auto group-hover:scale-105 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm text-white">Click or Drag Customer / Lane CSV File Here</h3>
                  <p className="text-xs text-neutral-500 mt-1">Supports McLeod, Tai, Rose Rocket, CSV, or Excel (.xlsx)</p>
                </div>
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs shadow transition inline-block"
                >
                  Select File to AI Auto-Map
                </button>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#121215] border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-white" />
                    <div>
                      <div className="text-xs font-bold text-white">{csvPreviewData.fileName}</div>
                      <div className="text-[10px] font-mono text-neutral-400">{csvPreviewData.totalRows} Records Detected</div>
                    </div>
                  </div>

                  {!csvImportSuccess ? (
                    <button
                      type="button"
                      onClick={handleFinalizeCsvImport}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-1.5 transition shadow"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm AI Import (142 Records)</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-neutral-900 text-white border border-neutral-700 text-xs font-mono font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-white" /> 142 Records Seeded to Database
                    </span>
                  )}
                </div>

                <div className="border border-neutral-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#050507] text-neutral-400 font-mono text-[10px] uppercase">
                      <tr>
                        <th className="p-3">CSV Column Header</th>
                        <th className="p-3">Auto-Mapped System Field</th>
                        <th className="p-3">AI Matching Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 text-neutral-300">
                      {csvPreviewData.mappedFields.map((f: any, idx: number) => (
                        <tr key={idx} className="hover:bg-neutral-900/50">
                          <td className="p-3 font-mono text-neutral-300">{f.header}</td>
                          <td className="p-3 font-mono text-white font-bold">➔ {f.mappedTo}</td>
                          <td className="p-3 font-mono text-neutral-400">{f.confidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: 1-CLICK ACCOUNTING SYNC */}
        {currentStep === 4 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Step 4 of 5</span>
                <h2 className="text-lg font-serif text-white font-normal">1-Click Accounting &amp; ERP Sync</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800 text-[10px] font-mono">
                OAuth 2.0 Integration
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Connect your accounting platform. Delivered shipments auto-issue customer freight invoices and carrier payables without double data entry.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-[#121215] border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">QuickBooks Online</div>
                    <div className="text-xs font-mono text-neutral-400">Intuit Accounting Engine</div>
                  </div>
                  {qboConnected ? (
                    <span className="px-2.5 py-1 rounded bg-neutral-900 text-white border border-neutral-700 text-xs font-mono font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-white" /> Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded bg-[#050507] text-neutral-500 text-xs font-mono">Disconnected</span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">Syncs Chart of Accounts, open AR invoices, and AP carrier vouchers in real time.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQboConnected(true);
                    markStepComplete(4);
                  }}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs transition shadow"
                >
                  {qboConnected ? 'Re-Sync QuickBooks Online' : 'Connect to QuickBooks Online (1-Click OAuth)'}
                </button>
              </div>

              <div className="p-6 rounded-2xl bg-[#121215] border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">Xero Cloud Accounting</div>
                    <div className="text-xs font-mono text-neutral-400">Global Financial Ledger</div>
                  </div>
                  {xeroConnected ? (
                    <span className="px-2.5 py-1 rounded bg-neutral-900 text-white border border-neutral-700 text-xs font-mono font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-white" /> Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded bg-[#050507] text-neutral-500 text-xs font-mono">Disconnected</span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">Automatic reconciliation for multi-currency freight invoices and QuickPay disbursements.</p>
                <button
                  type="button"
                  onClick={() => {
                    setXeroConnected(true);
                    markStepComplete(4);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#050507] hover:bg-neutral-900 text-neutral-200 border border-neutral-800 font-sans font-bold text-xs transition"
                >
                  {xeroConnected ? 'Re-Sync Xero Ledger' : 'Connect to Xero Accounting (1-Click OAuth)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: OUTLOOK ADD-IN & CHROME EXTENSION SIDECAR */}
        {currentStep === 5 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Step 5 of 5</span>
                <h2 className="text-lg font-serif text-white font-normal">Outlook Add-in &amp; Chrome Extension Sidecar</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800 text-[10px] font-mono">
                Email Co-Pilot
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Quote and dispatch freight directly inside Outlook or Chrome without ever changing tabs or leaving your email client.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-[#121215] border border-neutral-800 space-y-4">
                <div className="flex items-center gap-3">
                  <Puzzle className="w-7 h-7 text-white" />
                  <div>
                    <div className="text-sm font-bold text-white">Sidecar Co-Pilot Token</div>
                    <div className="text-xs font-mono text-neutral-400">Version 2.4 • Extension Secret</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono text-neutral-400 uppercase">Your API Authentication Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={sidecarApiKey}
                      className="flex-1 bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-neutral-300 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(sidecarApiKey);
                        setCopiedSidecarKey(true);
                        markStepComplete(5);
                        setTimeout(() => setCopiedSidecarKey(false), 2000);
                      }}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-1 transition shadow"
                    >
                      {copiedSidecarKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedSidecarKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => markStepComplete(5)}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center justify-center gap-2 shadow transition"
                >
                  <Download className="w-4 h-4 text-black" />
                  <span>Download Extension Package</span>
                </button>
              </div>

              <div className="p-6 rounded-2xl bg-[#121215] border border-neutral-800 space-y-3">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-neutral-300" />
                  <span>Outlook Quoting Instructions</span>
                </div>
                <ol className="text-xs text-neutral-400 space-y-2 pl-5 list-decimal font-sans">
                  <li>Install the extension in Chrome or Outlook.</li>
                  <li>Paste your Sidecar API token generated on the left.</li>
                  <li>Open any shipper email and click <b>"Apex Co-Pilot Quote"</b>.</li>
                  <li>View live rates from XPO/Saia/Estes and reply in 1 click.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BAR FOR ONBOARDING STEP NAVIGATION */}
        <div className="p-6 rounded-3xl bg-[#09090b] border border-neutral-800 flex items-center justify-between gap-4 shadow-2xl">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="px-5 py-2.5 rounded-xl bg-[#121215] hover:bg-neutral-800 text-white font-sans font-bold text-xs border border-neutral-800 flex items-center gap-2 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>

          <div className="text-xs font-mono text-neutral-400 hidden sm:block">
            Step {currentStep} of 5
          </div>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => {
                markStepComplete(currentStep);
                setCurrentStep((prev) => Math.min(5, prev + 1));
              }}
              className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-2 shadow-xl transition"
            >
              <span>Next Step →</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-2 shadow-xl transition"
            >
              <span>Complete Onboarding &amp; Open Software Dashboard</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          )}
        </div>
      </main>

      {/* STANDALONE FOOTER */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-neutral-500 z-10 border-t border-neutral-900">
        © 2026 Apex Freight Operating System • Standalone Data Integration Wizard
      </footer>
    </div>
  );
}

export default function IntegrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507] text-white p-8">Loading Integration Wizard...</div>}>
      <IntegrationPageContent />
    </Suspense>
  );
}
