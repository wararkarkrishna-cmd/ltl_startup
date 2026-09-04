'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Building2,
  AlertCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function IntegrationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState<number>(1);

  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const parsedStep = parseInt(stepParam, 10);
      if (!isNaN(parsedStep) && parsedStep >= 1 && parsedStep <= 5) {
        setCurrentStep(parsedStep);
      }
    }
  }, [searchParams]);

  // Progress State
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Email Ingestion State
  const shadowEmail = 'rfq-apex-7080@inbound.freight.ai';
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [simulatingEmailTest, setSimulatingEmailTest] = useState(false);
  const [emailTestSuccess, setEmailTestSuccess] = useState(false);

  // BYOC Vault Form State
  const [carrierInputs, setCarrierInputs] = useState<
    Record<string, { account: string; apiKey: string; status: 'IDLE' | 'TESTING' | 'CONNECTED' | 'ERROR'; errorMessage?: string }>
  >({
    XPO: { account: 'XPO-884210', apiKey: 'xpo_live_sec_99481a88421', status: 'IDLE' },
    SAIA: { account: 'SAIA-98412', apiKey: 'saia_live_sec_77412b99812', status: 'IDLE' },
    ESTES: { account: 'EXLA-33291', apiKey: 'exla_live_sec_11092c44810', status: 'IDLE' },
    ABF: { account: 'ABFS-71092', apiKey: 'abf_live_sec_44810d77109', status: 'IDLE' },
    RL: { account: 'RLCA-44210', apiKey: 'rl_live_sec_88391e99421', status: 'IDLE' },
  });

  // CSV Importer State
  const [csvImportType, setCsvImportType] = useState<'fleet' | 'accounts'>('fleet');
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<any | null>(null);

  const handleDownloadCustomerTemplate = () => {
    const content = `company_name,email,phone,city,state,zip\nAcme Manufacturing,ap@acmemfg.com,(555) 102-9988,Chicago,IL,60601\nSummit Supply Co,billing@summitsupply.com,(555) 304-1122,Dallas,TX,75001\nPacific Freight Distributors,ap@pacificdist.com,(555) 408-7733,Los Angeles,CA,90001`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'apex_customer_accounts_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadFleetTemplate = () => {
    const content = `unit_number,equipment_type,carrier_name,driver_name,driver_phone,city,state,zip,max_weight_lbs,max_pallets,has_liftgate\nTRK-101,DRY_VAN_53,Apex Dedicated Carrier,Marcus Vance,(312) 555-0144,Chicago,IL,60601,45000,26,false\nREF-204,REEFER_53,ColdChain Logistics,Elena Rostova,(404) 555-0188,Atlanta,GA,30301,43500,26,false\nBOX-308,BOX_TRUCK_26,Apex Freight Express,David Miller,(213) 555-0122,Los Angeles,CA,90001,10000,12,true\nFLT-402,FLATBED_48,Apex Dedicated Carrier,Robert Hayes,(214) 555-0166,Dallas,TX,75001,48000,24,false`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'apex_fleet_equipment_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreloadFleetSample = () => {
    setCsvImportType('fleet');
    setRawCsvText(
      `unit_number,equipment_type,carrier_name,driver_name,driver_phone,city,state,zip,max_weight_lbs,max_pallets,has_liftgate\nTRK-101,DRY_VAN_53,Apex Dedicated Carrier,Marcus Vance,(312) 555-0144,Chicago,IL,60601,45000,26,false\nREF-204,REEFER_53,ColdChain Logistics,Elena Rostova,(404) 555-0188,Atlanta,GA,30301,43500,26,false\nBOX-308,BOX_TRUCK_26,Apex Freight Express,David Miller,(213) 555-0122,Los Angeles,CA,90001,10000,12,true`
    );
  };

  const handlePreloadCustomerSample = () => {
    setCsvImportType('accounts');
    setRawCsvText(
      `company_name,email,phone,city,state,zip\nAcme Manufacturing,ap@acmemfg.com,(555) 102-9988,Chicago,IL,60601\nSummit Supply Co,billing@summitsupply.com,(555) 304-1122,Dallas,TX,75001\nPacific Freight Distributors,ap@pacificdist.com,(555) 408-7733,Los Angeles,CA,90001`
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setRawCsvText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteCsvIngestion = async () => {
    if (!rawCsvText.trim()) {
      setCsvUploadError('Please select a file or enter CSV data before submitting.');
      return;
    }

    setIsUploadingCsv(true);
    setCsvUploadError(null);

    try {
      const res = await fetch('/api/v1/integration/upload-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: rawCsvText,
          type: csvImportType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCsvUploadError(data.error || 'Failed to ingest CSV data into Supabase.');
      } else {
        setCsvImportResult(data);
        markStepComplete(3);
      }
    } catch (err: any) {
      setCsvUploadError(err.message || 'Network error during CSV upload.');
    } finally {
      setIsUploadingCsv(false);
    }
  };

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
    }, 800);
  };

  const handleTestCarrierConn = async (carrierCode: string) => {
    const currentInput = carrierInputs[carrierCode];
    setCarrierInputs((prev) => ({
      ...prev,
      [carrierCode]: { ...prev[carrierCode], status: 'TESTING', errorMessage: undefined },
    }));

    try {
      const res = await fetch('/api/v1/integration/carrier-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierCode,
          accountNumber: currentInput?.account || '',
          apiKey: currentInput?.apiKey || '',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setCarrierInputs((prev) => ({
          ...prev,
          [carrierCode]: {
            ...prev[carrierCode],
            status: 'ERROR',
            errorMessage: data.error || 'Verification Failed: Invalid credentials.',
          },
        }));
      } else {
        setCarrierInputs((prev) => ({
          ...prev,
          [carrierCode]: { ...prev[carrierCode], status: 'CONNECTED', errorMessage: undefined },
        }));
        markStepComplete(2);
      }
    } catch (err: any) {
      setCarrierInputs((prev) => ({
        ...prev,
        [carrierCode]: {
          ...prev[carrierCode],
          status: 'ERROR',
          errorMessage: err.message || 'Connection Timeout.',
        },
      }));
    }
  };

  const handleFinishOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apex_onboarding_completed', 'true');
    }
    router.push('/');
  };

  const stepsList = [
    { num: 1, title: 'Email Shadowing', icon: Mail, subtitle: 'Forward RFQs' },
    { num: 2, title: 'BYOC Carrier Vault', icon: Key, subtitle: 'XPO, Saia, Estes, ABF, R+L' },
    { num: 3, title: 'Magic AI CSV Import', icon: FileText, subtitle: 'Import Fleet & Accounts' },
    { num: 4, title: '1-Click Accounting', icon: Layers, subtitle: 'QuickBooks Online & Xero' },
    { num: 5, title: 'Outlook Extension', icon: Puzzle, subtitle: 'Sidecar API Token' },
  ];

  const activeStepProgress = Math.round((Object.keys(completedSteps).length / 5) * 100);

  return (
    <div className="min-h-screen bg-[#050507] text-[#f4f4f5] font-sans flex flex-col justify-between relative selection:bg-white selection:text-black">
      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between border-b border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white shadow-md">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl text-white tracking-tight font-normal">APEX</span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800">
                Integration Hub
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleFinishOnboarding}
            className="text-xs font-sans text-neutral-400 hover:text-white transition bg-[#121215] hover:bg-neutral-800 border border-neutral-800 px-4 py-2 rounded-xl flex items-center gap-1.5"
          >
            <span>Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Integration Container */}
      <main className="w-full max-w-6xl mx-auto px-6 py-8 flex-1 space-y-6 my-auto">
        {/* Onboarding Header Banner & Progress */}
        <div className="p-6 rounded-3xl bg-[#09090b] border border-neutral-800 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-serif font-normal text-white tracking-tight">
                System Integration Hub
              </h1>
            </div>

            <div className="p-3 rounded-2xl bg-[#121215] border border-neutral-800/80 min-w-[200px]">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-neutral-400">Setup Progress</span>
                <span className="text-white font-bold">{activeStepProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#050507] rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-white transition-all duration-500"
                  style={{ width: `${activeStepProgress}%` }}
                />
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
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    isCurrent
                      ? 'bg-white text-black border-white shadow-xl'
                      : 'bg-[#121215]/80 border-neutral-800 text-neutral-400 hover:text-white hover:bg-[#121215]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
                        isCurrent
                          ? 'bg-black text-white'
                          : isDone
                          ? 'bg-neutral-800 text-white'
                          : 'bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : step.num}
                    </span>
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-black' : 'text-neutral-500'}`} />
                  </div>
                  <div className={`text-xs font-sans font-bold ${isCurrent ? 'text-black' : 'text-white'}`}>
                    {step.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 1: EMAIL SHADOW INGESTION */}
        {currentStep === 1 && (
          <div className="p-6 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-serif text-white font-normal">Step 1: Email Shadow Ingestion</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800 text-[10px] font-mono">
                Forwarding Address
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-neutral-500 uppercase">Inbound Forwarding Address</div>
                <div className="text-sm font-mono font-bold text-white bg-[#050507] px-3 py-1.5 rounded-xl border border-neutral-800 inline-block">
                  {shadowEmail}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-1.5 transition shadow"
                >
                  {copiedEmail ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedEmail ? 'Copied!' : 'Copy Address'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestEmailInbound}
                  disabled={simulatingEmailTest}
                  className="px-4 py-2 rounded-xl bg-[#050507] hover:bg-neutral-900 text-neutral-300 font-sans font-bold text-xs flex items-center gap-1.5 border border-neutral-800 transition"
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
              <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Inbound simulation verified! RFQ parsed (4 Pallets HVAC, LA to Chicago).</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: BYOC CARRIER VAULT */}
        {currentStep === 2 && (
          <div className="p-6 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-serif text-white font-normal">Step 2: BYOC Carrier Credentials Vault</h2>
              <button
                type="button"
                onClick={() => {
                  const sandboxKeys = {
                    XPO: { account: 'XPO-884210', apiKey: 'xpo_live_sec_99481a88421' },
                    SAIA: { account: 'SAIA-98412', apiKey: 'saia_live_sec_77412b99812' },
                    ESTES: { account: 'EXLA-33291', apiKey: 'exla_live_sec_11092c44810' },
                    ABF: { account: 'ABFS-71092', apiKey: 'abf_live_sec_44810d77109' },
                    RL: { account: 'RLCA-44210', apiKey: 'rl_live_sec_88391e99421' },
                  };
                  for (const [code, val] of Object.entries(sandboxKeys)) {
                    setCarrierInputs((prev) => ({
                      ...prev,
                      [code]: { account: val.account, apiKey: val.apiKey, status: 'CONNECTED', errorMessage: undefined },
                    }));
                  }
                  markStepComplete(2);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-1.5 shadow transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-black" />
                <span>Fill Instant Developer Keys</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { code: 'XPO', name: 'XPO Logistics', scac: 'CNWY' },
                { code: 'SAIA', name: 'SAIA LTL Freight', scac: 'SAIA' },
                { code: 'ESTES', name: 'Estes Express Lines', scac: 'EXLA' },
                { code: 'ABF', name: 'ArcBest / ABF Freight', scac: 'ABFS' },
                { code: 'RL', name: 'R+L Carriers', scac: 'RLCA' },
              ].map((c) => {
                const state = carrierInputs[c.code] || { account: '', apiKey: '', status: 'IDLE' };
                return (
                  <div key={c.code} className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white">{c.name} ({c.scac})</div>
                      {state.status === 'CONNECTED' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-500 text-[10px] font-mono">
                          Ready
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={state.account}
                        onChange={(e) =>
                          setCarrierInputs((prev) => ({
                            ...prev,
                            [c.code]: { ...prev[c.code], account: e.target.value, status: 'IDLE' },
                          }))
                        }
                        placeholder="Account Number"
                        className="w-full bg-[#050507] border border-neutral-800 rounded-lg py-1 px-2.5 text-xs font-mono text-white focus:outline-none"
                      />
                      <input
                        type="password"
                        value={state.apiKey}
                        onChange={(e) =>
                          setCarrierInputs((prev) => ({
                            ...prev,
                            [c.code]: { ...prev[c.code], apiKey: e.target.value, status: 'IDLE' },
                          }))
                        }
                        placeholder="API Key"
                        className="w-full bg-[#050507] border border-neutral-800 rounded-lg py-1 px-2.5 text-xs font-mono text-white focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestCarrierConn(c.code)}
                      disabled={state.status === 'TESTING'}
                      className="w-full py-1.5 rounded-lg bg-[#050507] hover:bg-neutral-900 text-neutral-200 border border-neutral-800 text-xs font-sans font-bold flex items-center justify-center gap-1 transition"
                    >
                      {state.status === 'TESTING' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <span>Save &amp; Verify</span>
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
          <div className="p-6 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-3 gap-2">
              <h2 className="text-base font-serif text-white font-normal">Step 3: Magic AI CSV &amp; Legacy Data Importer</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCustomerTemplate}
                  className="px-3 py-1 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-sans font-medium flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Customer Template</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFleetTemplate}
                  className="px-3 py-1 rounded-xl bg-[#121215] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-sans font-medium flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Fleet Template</span>
                </button>
              </div>
            </div>

            {!csvImportResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#121215] border border-neutral-800 text-xs">
                  <div className="flex items-center gap-4 font-mono text-neutral-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="csvType"
                        value="fleet"
                        checked={csvImportType === 'fleet'}
                        onChange={() => setCsvImportType('fleet')}
                        className="accent-white"
                      />
                      <span>Fleet Equipment</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="csvType"
                        value="accounts"
                        checked={csvImportType === 'accounts'}
                        onChange={() => setCsvImportType('accounts')}
                        className="accent-white"
                      />
                      <span>Customer Accounts</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePreloadFleetSample}
                      className="px-2.5 py-1 rounded-lg bg-[#050507] hover:bg-neutral-900 text-neutral-300 border border-neutral-800 text-[11px] font-mono transition"
                    >
                      Pre-load Fleet CSV
                    </button>
                    <button
                      type="button"
                      onClick={handlePreloadCustomerSample}
                      className="px-2.5 py-1 rounded-lg bg-[#050507] hover:bg-neutral-900 text-neutral-300 border border-neutral-800 text-[11px] font-mono transition"
                    >
                      Pre-load Customer CSV
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={rawCsvText}
                    onChange={(e) => setRawCsvText(e.target.value)}
                    placeholder="Paste CSV text here or click Browse CSV file..."
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl p-3 text-xs font-mono text-neutral-200 focus:outline-none"
                  />
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-neutral-400 font-mono hover:text-white cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Browse CSV File</span>
                      <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteCsvIngestion}
                  disabled={isUploadingCsv}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center justify-center gap-2 shadow transition disabled:opacity-50"
                >
                  {isUploadingCsv ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-black" />
                      <span>Upload CSV</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#121215] border border-neutral-800 space-y-4">
                <div className="flex items-center gap-2 text-xs text-white">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{csvImportResult.message} ({csvImportResult.totalRowsProcessed} rows processed)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCsvImportResult(null);
                    setRawCsvText('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#050507] hover:bg-neutral-900 text-neutral-300 border border-neutral-800 text-xs font-mono transition"
                >
                  Upload Another File
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: 1-CLICK ACCOUNTING SYNC */}
        {currentStep === 4 && (
          <div className="p-6 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-serif text-white font-normal">Step 4: 1-Click Accounting &amp; ERP Sync</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#121215] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white">QuickBooks Online</div>
                  {qboConnected && <span className="text-[10px] font-mono text-emerald-400">Connected</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQboConnected(true);
                    markStepComplete(4);
                  }}
                  className="w-full py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs transition shadow"
                >
                  {qboConnected ? 'Re-Sync QuickBooks' : 'Connect QuickBooks Online'}
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-[#121215] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white">Xero Cloud Accounting</div>
                  {xeroConnected && <span className="text-[10px] font-mono text-emerald-400">Connected</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setXeroConnected(true);
                    markStepComplete(4);
                  }}
                  className="w-full py-2 rounded-xl bg-[#050507] hover:bg-neutral-900 text-neutral-200 border border-neutral-800 font-sans font-bold text-xs transition"
                >
                  {xeroConnected ? 'Re-Sync Xero' : 'Connect Xero Accounting'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: OUTLOOK ADD-IN & CHROME EXTENSION SIDECAR */}
        {currentStep === 5 && (
          <div className="p-6 rounded-3xl bg-[#09090b] border border-neutral-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-serif text-white font-normal">Step 5: Outlook Add-in &amp; Chrome Extension Sidecar</h2>
            </div>

            <div className="p-5 rounded-2xl bg-[#121215] border border-neutral-800 space-y-3">
              <label className="block text-xs font-mono text-neutral-400 uppercase">Your Sidecar API Authentication Token</label>
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
                  <span>{copiedSidecarKey ? 'Copied' : 'Copy Token'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation Controls */}
        <div className="p-4 rounded-2xl bg-[#09090b] border border-neutral-800 flex items-center justify-between gap-4 shadow-xl">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="px-4 py-2 rounded-xl bg-[#121215] hover:bg-neutral-800 text-white font-sans font-bold text-xs border border-neutral-800 flex items-center gap-1.5 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => {
                markStepComplete(currentStep);
                setCurrentStep((prev) => Math.min(5, prev + 1));
              }}
              className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-1.5 shadow transition"
            >
              <span>Next Step →</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs flex items-center gap-1.5 shadow transition"
            >
              <span>Complete Setup &amp; Open Dashboard</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function IntegrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507] text-white p-8">Loading Integration Hub...</div>}>
      <IntegrationPageContent />
    </Suspense>
  );
}
