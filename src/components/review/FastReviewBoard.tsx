'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RfqExtractionResult } from '@/lib/schema/rfq-extraction-schema';
import { AccessorialCode } from '@/db/schema';
import { HitlConfidenceEvaluator, ConfidenceTier } from '@/lib/confidence/confidence-evaluator';
import { DocumentPreviewPane } from './DocumentPreviewPane';
import { DensityCalculatorBadge } from './DensityCalculatorBadge';
import { AccessorialCommandPalette } from './AccessorialCommandPalette';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Command,
  MapPin,
  Package,
  Plus,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';

interface FastReviewBoardProps {
  shipmentId: string;
  initialRfq: RfqExtractionResult;
  rawDocumentText?: string;
  fileName?: string;
  mimeType?: string;
  sha256Hash?: string;
  onApproved?: (updatedRfq: RfqExtractionResult) => void;
}

export const FastReviewBoard: React.FC<FastReviewBoardProps> = ({
  shipmentId,
  initialRfq,
  rawDocumentText,
  fileName,
  mimeType,
  sha256Hash,
  onApproved,
}) => {
  const [rfq, setRfq] = useState<RfqExtractionResult>(initialRfq);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  const evaluation = HitlConfidenceEvaluator.evaluateRfq(rfq);

  // Global Keyboard Navigation Suite (Cmd+K / Ctrl+K and Cmd+Enter / Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleApproveAndRate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rfq]);

  const getBorderColorClass = (tier: ConfidenceTier) => {
    switch (tier) {
      case 'GREEN':
        return 'border-emerald-500/50 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400';
      case 'YELLOW':
        return 'border-amber-500/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-amber-950/10';
      case 'RED':
        return 'border-rose-500 focus:border-rose-400 focus:ring-2 focus:ring-rose-500 bg-rose-950/20';
    }
  };

  const toggleAccessorial = (code: AccessorialCode) => {
    setRfq((prev) => {
      const exists = prev.accessorials.includes(code);
      const updated = exists
        ? prev.accessorials.filter((c) => c !== code)
        : [...prev.accessorials, code];
      return { ...prev, accessorials: updated };
    });
  };

  const handleApproveAndRate = async () => {
    setIsSubmitting(true);
    setApprovalMessage(null);

    try {
      const res = await fetch(`/api/shipments/${shipmentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedRfq: rfq,
          originalExtractedJson: initialRfq,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setApprovalMessage('RFQ Approved successfully! Ready for multi-carrier rating.');
        if (onApproved) onApproved(rfq);
      } else {
        setApprovalMessage(`Error: ${data.error || 'Approval failed'}`);
      }
    } catch (err: any) {
      setApprovalMessage(`Network error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryItem = rfq.items[0] || {
    quantity: 1,
    lengthIn: 48,
    widthIn: 40,
    heightIn: 48,
    unitWeightLbs: 1000,
    totalWeightLbs: 1000,
    packagingType: 'PALLET' as const,
    commodityDescription: 'General Freight',
    isStackable: false,
    isHazmat: false,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-[#09090b] border border-[#27272a] rounded-2xl text-neutral-100 overflow-hidden font-sans shadow-2xl">
      {/* Top Notification / Command Banner */}
      <header className="h-14 border-b border-[#27272a] bg-[#0c0c0e] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-neutral-900 text-white rounded-lg border border-neutral-700">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-serif font-normal tracking-tight text-white">
              High-Velocity Broker Review &amp; Edit Board
            </h1>
            <span className="text-[10px] text-neutral-400 font-mono">
              Shipment ID: {shipmentId} &bull; 15-Sec Keyboard SLA
            </span>
          </div>
        </div>

        {/* Global Confidence & Keyboard Indicator */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPaletteOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 text-xs font-sans font-medium text-neutral-300 bg-[#121215] hover:bg-neutral-800 rounded-lg border border-neutral-800 transition"
          >
            <Command className="w-3.5 h-3.5 text-neutral-400" />
            <span>Accessorials</span>
            <kbd className="px-1 py-0.2 text-[10px] bg-neutral-900 text-neutral-400 rounded font-mono border border-neutral-700">
              Cmd+K
            </kbd>
          </button>

          <div className="px-3 py-1 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 border border-neutral-700 bg-neutral-900 text-white">
            <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
            <span>{Math.round(evaluation.overallConfidence * 100)}% Confidence</span>
          </div>
        </div>
      </header>

      {/* Dual-Pane Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Pane: Document & Stream Viewer (5 cols) */}
        <div className="lg:col-span-5 h-full overflow-hidden flex flex-col">
          <DocumentPreviewPane
            fileName={fileName}
            mimeType={mimeType}
            sha256Hash={sha256Hash}
            rawText={rawDocumentText}
          />
        </div>

        {/* Right Pane: Fast-Edit Form (7 cols) */}
        <div className="lg:col-span-7 h-full overflow-y-auto pr-1 space-y-4">
          {/* Escalation Alert Banner if Human Review Required */}
          {evaluation.requiresHumanReview && (
            <div className="bg-rose-950/30 border border-rose-500/40 p-3.5 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center space-x-2 text-rose-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Mandatory Human Confirmation Required</span>
              </div>
              <ul className="list-disc list-inside text-rose-200/90 space-y-0.5 pl-1">
                {evaluation.escalationReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 1: Origin & Destination Postal Details */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Lane &amp; Routing Geometry</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Origin Block */}
              <div className="space-y-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-xs font-semibold text-emerald-400 flex items-center justify-between">
                  Origin (Pickup)
                  <span className="text-[10px] font-mono text-slate-500">
                    {evaluation.fields['origin.zip']?.tier}
                  </span>
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 block mb-0.5">City, State</label>
                    <input
                      type="text"
                      value={`${rfq.origin.city}, ${rfq.origin.state}`}
                      onChange={(e) => {
                        const parts = e.target.value.split(',');
                        setRfq({
                          ...rfq,
                          origin: {
                            ...rfq.origin,
                            city: parts[0]?.trim() || '',
                            state: parts[1]?.trim().toUpperCase().substring(0, 2) || rfq.origin.state,
                          },
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded px-2.5 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">ZIP Code</label>
                    <input
                      type="text"
                      value={rfq.origin.zip}
                      onChange={(e) =>
                        setRfq({
                          ...rfq,
                          origin: { ...rfq.origin, zip: e.target.value },
                        })
                      }
                      className={`w-full bg-slate-900 border text-xs text-slate-100 font-mono rounded px-2.5 py-1.5 focus:outline-none ${getBorderColorClass(
                        evaluation.fields['origin.zip']?.tier || 'GREEN'
                      )}`}
                    />
                  </div>
                </div>
              </div>

              {/* Destination Block */}
              <div className="space-y-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-xs font-semibold text-blue-400 flex items-center justify-between">
                  Destination (Consignee)
                  <span className="text-[10px] font-mono text-slate-500">
                    {evaluation.fields['destination.zip']?.tier}
                  </span>
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 block mb-0.5">City, State</label>
                    <input
                      type="text"
                      value={`${rfq.destination.city}, ${rfq.destination.state}`}
                      onChange={(e) => {
                        const parts = e.target.value.split(',');
                        setRfq({
                          ...rfq,
                          destination: {
                            ...rfq.destination,
                            city: parts[0]?.trim() || '',
                            state: parts[1]?.trim().toUpperCase().substring(0, 2) || rfq.destination.state,
                          },
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded px-2.5 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">ZIP Code</label>
                    <input
                      type="text"
                      value={rfq.destination.zip}
                      onChange={(e) =>
                        setRfq({
                          ...rfq,
                          destination: { ...rfq.destination, zip: e.target.value },
                        })
                      }
                      className={`w-full bg-slate-900 border text-xs text-slate-100 font-mono rounded px-2.5 py-1.5 focus:outline-none ${getBorderColorClass(
                        evaluation.fields['destination.zip']?.tier || 'GREEN'
                      )}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Line Items, Dimensions & Weights */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Line Items &amp; Packaging</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Total: {rfq.totalPallets} Plts / {rfq.totalWeightLbs} lbs
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={primaryItem.quantity}
                  onChange={(e) => {
                    const qty = parseInt(e.target.value, 10) || 1;
                    const items = [...rfq.items];
                    items[0] = {
                      ...primaryItem,
                      quantity: qty,
                      totalWeightLbs: primaryItem.unitWeightLbs * qty,
                    };
                    setRfq({
                      ...rfq,
                      totalPallets: qty,
                      totalWeightLbs: items[0].totalWeightLbs,
                      items,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded px-2 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Length (in)</label>
                <input
                  type="number"
                  value={primaryItem.lengthIn}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 48;
                    const items = [...rfq.items];
                    items[0] = { ...primaryItem, lengthIn: val };
                    setRfq({ ...rfq, items });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded px-2 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Width (in)</label>
                <input
                  type="number"
                  value={primaryItem.widthIn}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 40;
                    const items = [...rfq.items];
                    items[0] = { ...primaryItem, widthIn: val };
                    setRfq({ ...rfq, items });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded px-2 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Height (in)</label>
                <input
                  type="number"
                  value={primaryItem.heightIn}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 48;
                    const items = [...rfq.items];
                    items[0] = { ...primaryItem, heightIn: val };
                    setRfq({ ...rfq, items });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded px-2 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Unit Wgt (lbs)</label>
                <input
                  type="number"
                  value={primaryItem.unitWeightLbs}
                  onChange={(e) => {
                    const wgt = parseFloat(e.target.value) || 500;
                    const items = [...rfq.items];
                    items[0] = {
                      ...primaryItem,
                      unitWeightLbs: wgt,
                      totalWeightLbs: wgt * primaryItem.quantity,
                    };
                    setRfq({
                      ...rfq,
                      totalWeightLbs: items[0].totalWeightLbs,
                      items,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded px-2 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Total Wgt (lbs)</label>
                <input
                  type="number"
                  value={rfq.totalWeightLbs}
                  onChange={(e) => {
                    const totalWgt = parseFloat(e.target.value) || 1000;
                    const items = [...rfq.items];
                    items[0] = {
                      ...primaryItem,
                      totalWeightLbs: totalWgt,
                      unitWeightLbs: parseFloat((totalWgt / primaryItem.quantity).toFixed(2)),
                    };
                    setRfq({ ...rfq, totalWeightLbs: totalWgt, items });
                  }}
                  className={`w-full bg-slate-950 border text-xs text-slate-100 font-bold rounded px-2 py-1.5 focus:outline-none ${getBorderColorClass(
                    evaluation.fields['totalWeightLbs']?.tier || 'GREEN'
                  )}`}
                />
              </div>
            </div>

            {/* Live Density & NMFC Preview Badge */}
            <DensityCalculatorBadge
              lengthIn={primaryItem.lengthIn}
              widthIn={primaryItem.widthIn}
              heightIn={primaryItem.heightIn}
              weightLbs={primaryItem.unitWeightLbs}
              quantity={primaryItem.quantity}
              isStackable={primaryItem.isStackable}
            />
          </div>

          {/* Section 3: Accessorials Chips & Command Palette Trigger */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Selected Accessorials ({rfq.accessorials.length})</span>
              </div>
              <button
                onClick={() => setIsPaletteOpen(true)}
                className="text-xs text-white hover:text-neutral-300 flex items-center space-x-1 font-medium font-sans"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Toggle (Cmd+K)</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {rfq.accessorials.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs font-mono font-medium rounded-lg"
                >
                  <span>{code}</span>
                  <button
                    onClick={() => toggleAccessorial(code)}
                    className="hover:text-white text-neutral-400 p-0.5 rounded transition"
                  >
                    &times;
                  </button>
                </span>
              ))}

              {rfq.accessorials.length === 0 && (
                <span className="text-xs text-neutral-500 italic py-1 font-sans">
                  Standard Dock-to-Dock (No Accessorials Selected)
                </span>
              )}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-2 flex items-center justify-between">
            {approvalMessage ? (
              <span className="text-xs font-medium text-white flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-4 h-4" />
                {approvalMessage}
              </span>
            ) : (
              <span className="text-xs text-neutral-400 font-sans">
                Press <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded font-mono text-[10px] text-neutral-300">Cmd+Enter</kbd> to Approve
              </span>
            )}

            <button
              onClick={handleApproveAndRate}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-xl shadow flex items-center space-x-2 transition disabled:opacity-50"
            >
              <span>Approve &amp; Rate Load</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>

      {/* Accessorial Command Palette Modal */}
      <AccessorialCommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        selectedAccessorials={rfq.accessorials}
        onToggle={toggleAccessorial}
      />
    </div>
  );
};
