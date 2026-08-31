'use client';

import React, { useState, useEffect } from 'react';
import { ExtractedRFQ } from '@/lib/schema/extracted-rfq-schema';
import { ShipmentDensityMetrics, DensityRiskEngine } from '@/lib/classification/density-engine';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  FileText,
  Lock,
  Package,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';

interface SpatialBlock {
  text: string;
  box: { x: number; y: number; w: number; h: number };
  page: number;
}

interface Phase1ReviewWorkspaceProps {
  shipmentId: string;
  initialRfq: ExtractedRFQ;
  densityMetrics: ShipmentDensityMetrics;
  rawText?: string;
  spatialBlocks?: SpatialBlock[];
  onApprove?: (rfq: ExtractedRFQ) => void;
}

export const Phase1ReviewWorkspace: React.FC<Phase1ReviewWorkspaceProps> = ({
  shipmentId,
  initialRfq,
  densityMetrics,
  rawText = '',
  spatialBlocks = [],
  onApprove,
}) => {
  const [rfq, setRfq] = useState<ExtractedRFQ>(initialRfq);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [confirmedFields, setConfirmedFields] = useState<Set<string>>(new Set());

  // Compute live metrics
  const liveDensity = DensityRiskEngine.evaluateShipment(rfq.items);

  // Confidence calculations
  const originZipScore = /^\d{5}$/.test(rfq.origin.zip) ? 0.99 : 0.65;
  const destZipScore = /^\d{5}$/.test(rfq.destination.zip) ? 0.99 : 0.65;
  const weightScore = liveDensity.totalWeightLbs > 0 ? 0.98 : 0.6;

  const isOriginZipRed = originZipScore < 0.8 && !confirmedFields.has('origin.zip');
  const isDestZipRed = destZipScore < 0.8 && !confirmedFields.has('destination.zip');
  const isWeightRed = weightScore < 0.8 && !confirmedFields.has('total_weight');

  const isSafetyLockActive = isOriginZipRed || isDestZipRed || isWeightRed;

  // Global Keyboard Shortcuts (Alt+1..Alt+9, Esc, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsJsonMode((prev) => !prev);
      }

      if (e.altKey && e.key === '1') {
        e.preventDefault();
        toggleAccessorial('LIFTGATE_DELIVERY');
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        toggleAccessorial('INSIDE_DELIVERY');
      }
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        toggleAccessorial('LIMITED_ACCESS_DELIVERY');
      }
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        toggleAccessorial('APPOINTMENT_DELIVERY');
      }
      if (e.altKey && e.key === '5') {
        e.preventDefault();
        toggleAccessorial('NOTIFY_BEFORE_DELIVERY');
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!isSafetyLockActive && onApprove) {
          onApprove(rfq);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rfq, isSafetyLockActive]);

  const toggleAccessorial = (code: any) => {
    setRfq((prev) => {
      const exists = prev.destination.accessorials.includes(code);
      const updated = exists
        ? prev.destination.accessorials.filter((c) => c !== code)
        : [...prev.destination.accessorials, code];
      return {
        ...prev,
        destination: { ...prev.destination, accessorials: updated },
      };
    });
  };

  const getScoreBadge = (score: number, fieldKey: string) => {
    const isConfirmed = confirmedFields.has(fieldKey);
    if (isConfirmed || score >= 0.95) {
      return <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-mono">GREEN ({Math.round(score * 100)}%)</span>;
    }
    if (score >= 0.8) {
      return <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">YELLOW ({Math.round(score * 100)}%)</span>;
    }
    return <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/50 font-bold font-mono">RED ({Math.round(score * 100)}%)</span>;
  };

  const confirmField = (fieldKey: string) => {
    setConfirmedFields((prev) => new Set([...prev, fieldKey]));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100">
              Phase 1: Multi-Modal RFQ Ingestion &amp; Density Guard
            </h1>
            <span className="text-[11px] text-slate-400 font-mono">
              Shipment ID: {shipmentId} &bull; Hotkeys: [Tab] Low-Conf &bull; [Alt+1..5] Accessorials &bull; [Esc] JSON
            </span>
          </div>
        </div>

        {/* Safety Lock Indicator */}
        <div className="flex items-center space-x-3">
          {isSafetyLockActive ? (
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-rose-950/60 border border-rose-500 text-rose-300 text-xs font-semibold rounded-lg animate-pulse">
              <Lock className="w-3.5 h-3.5" />
              <span>SAFETY LOCK ACTIVE (Verify Red Fields)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Ready for Multi-Carrier Rating</span>
            </div>
          )}
        </div>
      </header>

      {/* Reclassification Risk Banner */}
      {liveDensity.reclassificationRisk.hasRisk && (
        <div className="bg-amber-950/40 border-b border-amber-500/40 px-6 py-2.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="font-semibold">
              {liveDensity.reclassificationRisk.warningMessage}
            </span>
          </div>
          <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold px-2 py-0.5 rounded text-[11px]">
            Exposure: ${liveDensity.reclassificationRisk.estimatedRebillPenaltyUsd.toFixed(2)}
          </span>
        </div>
      )}

      {/* Main Split-Pane Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Pane: Interactive Document & Spatial Highlight Viewer (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg">
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              Document Text &amp; Spatial Coordinate OCR
            </span>
            <button
              onClick={() => setIsJsonMode(!isJsonMode)}
              className="text-[11px] text-slate-400 hover:text-slate-200 font-mono bg-slate-800 px-2 py-0.5 rounded"
            >
              {isJsonMode ? 'View OCR' : 'View JSON (Esc)'}
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-slate-950/80 font-mono text-xs text-slate-300 whitespace-pre-wrap">
            {isJsonMode ? (
              <pre className="text-emerald-400">{JSON.stringify(rfq, null, 2)}</pre>
            ) : (
              rawText || 'No source document stream available.'
            )}
          </div>
        </div>

        {/* Right Pane: Fast-Edit Structured Review Form (7 cols) */}
        <div className="lg:col-span-7 overflow-y-auto space-y-4 pr-1">
          {/* Origin / Destination Lane Details */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Lane Routing &amp; Postal Resolution
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Origin */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400">Origin (Pickup)</span>
                  {getScoreBadge(originZipScore, 'origin.zip')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400">City, State</label>
                    <input
                      type="text"
                      value={`${rfq.origin.city || ''}, ${rfq.origin.state || ''}`}
                      onChange={(e) => {
                        const [c, s] = e.target.value.split(',');
                        setRfq({
                          ...rfq,
                          origin: { ...rfq.origin, city: c?.trim(), state: s?.trim()?.toUpperCase() },
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded px-2 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ZIP</label>
                    <input
                      type="text"
                      value={rfq.origin.zip}
                      onFocus={() => setActiveHighlight(rfq.origin.zip)}
                      onChange={(e) => {
                        confirmField('origin.zip');
                        setRfq({ ...rfq, origin: { ...rfq.origin, zip: e.target.value } });
                      }}
                      className={`w-full bg-slate-900 border text-xs text-slate-100 font-mono rounded px-2 py-1.5 focus:outline-none ${
                        isOriginZipRed ? 'border-rose-500 bg-rose-950/20' : 'border-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Destination */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-400">Destination (Consignee)</span>
                  {getScoreBadge(destZipScore, 'destination.zip')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400">City, State</label>
                    <input
                      type="text"
                      value={`${rfq.destination.city || ''}, ${rfq.destination.state || ''}`}
                      onChange={(e) => {
                        const [c, s] = e.target.value.split(',');
                        setRfq({
                          ...rfq,
                          destination: { ...rfq.destination, city: c?.trim(), state: s?.trim()?.toUpperCase() },
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded px-2 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ZIP</label>
                    <input
                      type="text"
                      value={rfq.destination.zip}
                      onFocus={() => setActiveHighlight(rfq.destination.zip)}
                      onChange={(e) => {
                        confirmField('destination.zip');
                        setRfq({ ...rfq, destination: { ...rfq.destination, zip: e.target.value } });
                      }}
                      className={`w-full bg-slate-900 border text-xs text-slate-100 font-mono rounded px-2 py-1.5 focus:outline-none ${
                        isDestZipRed ? 'border-rose-500 bg-rose-950/20' : 'border-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items, PCF & Dimensions */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-400" />
                Line Items &amp; Density Calculation
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {liveDensity.totalHandlingUnits} Units &bull; {liveDensity.totalWeightLbs} lbs &bull; {liveDensity.totalVolumeCuFt} cu.ft
              </span>
            </div>

            {/* Density & NMFC Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">DENSITY (PCF)</span>
                <span className="text-emerald-400 font-bold text-sm">{liveDensity.calculatedPcf} PCF</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">RECOMMENDED CLASS</span>
                <span className="text-blue-400 font-bold text-sm">Class {liveDensity.recommendedShipmentClass}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">LINEAR FEET</span>
                <span className="text-amber-400 font-bold text-sm">{liveDensity.linearFeet} LF</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">OVERLENGTH</span>
                <span className={liveDensity.hasOverlengthItems ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {liveDensity.hasOverlengthItems ? 'YES (>96")' : 'STANDARD'}
                </span>
              </div>
            </div>
          </div>

          {/* Accessorial Hotkey Bar (Alt+1..Alt+5) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Accessorial Toggles (Hotkeys: Alt+1 to Alt+5)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { code: 'LIFTGATE_DELIVERY', label: 'Liftgate Delivery', hotkey: 'Alt+1' },
                { code: 'INSIDE_DELIVERY', label: 'Inside Delivery', hotkey: 'Alt+2' },
                { code: 'LIMITED_ACCESS_DELIVERY', label: 'Limited Access', hotkey: 'Alt+3' },
                { code: 'APPOINTMENT_DELIVERY', label: 'Appointment', hotkey: 'Alt+4' },
                { code: 'NOTIFY_BEFORE_DELIVERY', label: 'Notify Prior', hotkey: 'Alt+5' },
              ].map((acc) => {
                const isSelected = rfq.destination.accessorials.includes(acc.code as any);
                return (
                  <button
                    key={acc.code}
                    onClick={() => toggleAccessorial(acc.code)}
                    className={`px-3 py-2 rounded-lg border text-left flex items-center justify-between text-xs transition ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{acc.label}</span>
                    <kbd className="text-[10px] bg-slate-900 px-1 py-0.5 rounded text-slate-500">
                      {acc.hotkey}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Dispatch Action */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">Cmd+Enter</kbd> to Dispatch
            </span>
            <button
              onClick={() => onApprove && onApprove(rfq)}
              disabled={isSafetyLockActive}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Dispatch to Rating Engine</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
