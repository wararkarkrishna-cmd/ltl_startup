'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RfqExtractionResult } from '@/lib/schema/rfq-extraction-schema';
import { AccessorialCode } from '@/db/schema';
import { HitlConfidenceEvaluator, ConfidenceTier } from '@/lib/confidence/confidence-evaluator';
import { LtlDensityCalculator } from '@/lib/classification/density-calculator';
import { AccessorialDetector } from '@/lib/classification/accessorial-detector';
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
  Sliders,
  FileCheck2,
  Layers,
  Scale,
  ShieldCheck,
  Eye,
  X,
  Info,
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

function FastReviewBoardContent({
  shipmentId,
  initialRfq,
  rawDocumentText,
  fileName,
  mimeType,
  sha256Hash,
  onApproved,
}: FastReviewBoardProps) {
  const searchParams = useSearchParams();
  const [rfq, setRfq] = useState<RfqExtractionResult>(initialRfq);
  const [activeSubView, setActiveSubView] = useState<'board' | 'density' | 'accessorials' | 'confidence'>('board');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [showUseCaseModal, setShowUseCaseModal] = useState(false);

  // Standalone Density Calculator State
  const [calcLength, setCalcLength] = useState(48);
  const [calcWidth, setCalcWidth] = useState(40);
  const [calcHeight, setCalcHeight] = useState(48);
  const [calcWeight, setCalcWeight] = useState(1200);
  const [calcQuantity, setCalcQuantity] = useState(4);

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'density') {
      setActiveSubView('density');
    } else if (viewParam === 'accessorials') {
      setActiveSubView('accessorials');
      setIsPaletteOpen(true);
    } else if (viewParam === 'confidence') {
      setActiveSubView('confidence');
    } else {
      setActiveSubView('board');
    }
  }, [searchParams]);

  const handleSubViewChange = (view: 'board' | 'density' | 'accessorials' | 'confidence') => {
    setActiveSubView(view);
    const url = view === 'board' ? `/review/${shipmentId}` : `/review/${shipmentId}?view=${view}`;
    window.history.pushState(null, '', url);
    if (view === 'accessorials') {
      setIsPaletteOpen(true);
    }
  };

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
        return 'border-neutral-700 focus:border-neutral-500';
      case 'YELLOW':
        return 'border-amber-500/60 focus:border-amber-400 bg-amber-950/10';
      case 'RED':
        return 'border-rose-500 focus:border-rose-400 bg-rose-950/20';
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

  const calculatedDensity = LtlDensityCalculator.evaluateItem({
    lengthIn: calcLength,
    widthIn: calcWidth,
    heightIn: calcHeight,
    weightLbs: calcWeight,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-[#09090b] border border-[#27272a] rounded-2xl text-neutral-100 overflow-hidden font-sans shadow-2xl">
      {/* Top Notification / Command Banner */}
      <header className="h-14 border-b border-[#27272a] bg-[#0c0c0e] px-4 sm:px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-neutral-900 text-white rounded-lg border border-neutral-700">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-serif font-normal tracking-tight text-white">
                RFQ Intake &amp; Review Desk
              </h1>
              <button
                onClick={() => setShowUseCaseModal(true)}
                className="px-2 py-0.5 rounded-full bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 text-[10px] font-sans transition flex items-center gap-1"
                title="View Review Desk Use Case"
              >
                <Eye className="w-3 h-3 text-white" />
                <span>Use Case</span>
              </button>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono">
              Shipment ID: {shipmentId} &bull; 15-Sec Keyboard SLA
            </span>
          </div>
        </div>

        {/* Sub-Feature Tabs inside Review Desk */}
        <div className="hidden md:flex items-center bg-[#121215] border border-neutral-800 rounded-lg p-0.5 text-xs">
          {[
            { id: 'board', label: 'Fast Review Board' },
            { id: 'density', label: 'PCF Density Calculator' },
            { id: 'accessorials', label: 'Accessorial Palette (⌘K)' },
            { id: 'confidence', label: 'HITL Confidence Scorer' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleSubViewChange(tab.id as any)}
              className={`px-3 py-1 rounded-md font-sans text-xs transition ${
                activeSubView === tab.id
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Confidence & Keyboard Indicator */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => {
              setIsPaletteOpen(true);
              handleSubViewChange('accessorials');
            }}
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

      {/* SUB-VIEW 1: PCF DENSITY CALCULATOR WORKBENCH */}
      {activeSubView === 'density' && (
        <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#09090b]">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                11-Tier NMFC Automatic Classification Engine
              </span>
              <h2 className="text-xl font-serif text-white mt-1">PCF Density &amp; Freight Class Calculator</h2>
            </div>
            <button
              onClick={() => handleSubViewChange('board')}
              className="px-3.5 py-1.5 bg-[#121215] hover:bg-neutral-800 text-white text-xs font-sans font-medium rounded-lg border border-neutral-800 transition"
            >
              Back to Dual-Pane Board
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-5">
              <h3 className="text-sm font-sans font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-neutral-400" /> Pallet Dimensions &amp; Weight Inputs
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-mono text-neutral-500 uppercase">Length (in)</label>
                  <input
                    type="number"
                    value={calcLength}
                    onChange={(e) => setCalcLength(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none focus:border-neutral-600 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-neutral-500 uppercase">Width (in)</label>
                  <input
                    type="number"
                    value={calcWidth}
                    onChange={(e) => setCalcWidth(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none focus:border-neutral-600 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-neutral-500 uppercase">Height (in)</label>
                  <input
                    type="number"
                    value={calcHeight}
                    onChange={(e) => setCalcHeight(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none focus:border-neutral-600 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono text-neutral-500 uppercase">Unit Weight (lbs)</label>
                  <input
                    type="number"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none focus:border-neutral-600 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-neutral-500 uppercase">Pallet Quantity</label>
                  <input
                    type="number"
                    value={calcQuantity}
                    onChange={(e) => setCalcQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#09090b] border border-neutral-800 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none focus:border-neutral-600 mt-1"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    const items = [...rfq.items];
                    if (items[0]) {
                      items[0] = {
                        ...items[0],
                        lengthIn: calcLength,
                        widthIn: calcWidth,
                        heightIn: calcHeight,
                        unitWeightLbs: calcWeight,
                        totalWeightLbs: calcWeight * calcQuantity,
                        quantity: calcQuantity,
                        nmfcClass: calculatedDensity.estimatedNmfcClass,
                      };
                      setRfq({ ...rfq, items, totalWeightLbs: calcWeight * calcQuantity, totalPallets: calcQuantity });
                    }
                    handleSubViewChange('board');
                  }}
                  className="w-full py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Apply Density &amp; Class to Current RFQ
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-sans font-semibold text-white">Calculated Output</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#09090b] p-4 rounded-xl border border-neutral-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-neutral-500">PCF Density</span>
                    <div className="text-3xl font-mono font-bold text-white mt-1">{calculatedDensity.pcf} PCF</div>
                  </div>
                  <div className="bg-[#09090b] p-4 rounded-xl border border-neutral-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-neutral-500">Recommended NMFC Class</span>
                    <div className="text-3xl font-mono font-bold text-white mt-1">Class {calculatedDensity.estimatedNmfcClass}</div>
                  </div>
                </div>

                <div className="bg-[#09090b] p-4 rounded-xl border border-neutral-800 space-y-2 text-xs font-sans">
                  <div className="flex justify-between text-neutral-400">
                    <span>Total Cubic Feet:</span>
                    <span className="font-mono text-white font-bold">{calculatedDensity.totalCubicFeet} cu ft</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Total Shipment Weight:</span>
                    <span className="font-mono text-white font-bold">{(calcWeight * calcQuantity).toLocaleString()} lbs</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Density Range:</span>
                    <span className="font-mono text-neutral-300">
                      {calculatedDensity.estimatedNmfcClass === '50' ? '>= 50 PCF' : 'Standard 11-Tier Spectrum'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: HITL CONFIDENCE SCORER MATRIX */}
      {activeSubView === 'confidence' && (
        <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#09090b]">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-4">
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Human-In-The-Loop AI Verification Gate
              </span>
              <h2 className="text-xl font-serif text-white mt-1">HITL Confidence Scorer &amp; Entropy Matrix</h2>
              <p className="text-xs text-neutral-400 font-sans mt-0.5">
                Field-level certainty scores, entropy threshold evaluation, and automated human review escalation triggers.
              </p>
            </div>
            <button
              onClick={() => handleSubViewChange('board')}
              className="px-3.5 py-1.5 bg-[#121215] hover:bg-neutral-800 text-white text-xs font-sans font-medium rounded-lg border border-neutral-800 transition"
            >
              Back to Dual-Pane Board
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-5 space-y-3 text-center">
              <span className="text-[10px] font-mono text-neutral-500 uppercase">Overall Extraction Confidence</span>
              <div className="text-4xl font-mono font-bold text-white mt-1">
                {Math.round(evaluation.overallConfidence * 100)}%
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-[10px] font-mono font-bold text-white">
                TIER: {evaluation.overallTier}
              </span>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-5 space-y-3 text-center">
              <span className="text-[10px] font-mono text-neutral-500 uppercase">Human Review Trigger</span>
              <div className="text-4xl font-mono font-bold text-white mt-1">
                {evaluation.requiresHumanReview ? 'TRIGGERED' : 'CLEAN'}
              </div>
              <span className="inline-block text-[11px] text-neutral-400 font-sans">
                {evaluation.requiresHumanReview ? 'Low confidence entropy detected' : 'Passes 90%+ confidence floor'}
              </span>
            </div>

            <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-5 space-y-3 text-center">
              <span className="text-[10px] font-mono text-neutral-500 uppercase">Escalation Threshold</span>
              <div className="text-4xl font-mono font-bold text-white mt-1">
                &lt; 0.85
              </div>
              <span className="inline-block text-[11px] text-neutral-400 font-sans">
                Mandatory broker audit gate
              </span>
            </div>
          </div>

          <div className="bg-[#121215] border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-sans font-semibold text-white uppercase tracking-wider">Field-by-Field Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
              {Object.entries(evaluation.fields).map(([fieldName, fieldData]: [string, any]) => (
                <div key={fieldName} className="bg-[#09090b] p-3 rounded-xl border border-neutral-800 flex justify-between items-center">
                  <span className="text-neutral-400 font-sans">{fieldName}</span>
                  <span className="text-white font-bold">{Math.round((fieldData?.confidence || 0.95) * 100)}% ({fieldData?.tier || 'GREEN'})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3 / DEFAULT: DUAL-PANE FAST REVIEW BOARD */}
      {(activeSubView === 'board' || activeSubView === 'accessorials') && (
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
          <div className="lg:col-span-7 h-full overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {/* Escalation Alert Banner if Human Review Required */}
            {evaluation.requiresHumanReview && (
              <div className="bg-rose-950/30 border border-rose-500/40 p-3.5 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center space-x-2 text-rose-400 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Mandatory Human Confirmation Required</span>
                </div>
                <ul className="list-disc list-inside text-rose-200/90 space-y-0.5 pl-1 font-mono text-[11px]">
                  {evaluation.escalationReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Section 1: Origin & Destination Postal Details */}
            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider font-sans">
                <MapPin className="w-4 h-4 text-neutral-400" />
                <span>Lane &amp; Routing Geometry</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Origin Block */}
                <div className="space-y-2 p-3 bg-[#09090b] rounded-lg border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-200 flex items-center justify-between font-sans">
                    Origin (Pickup)
                    <span className="text-[10px] font-mono text-neutral-500">
                      {evaluation.fields['origin.zip']?.tier}
                    </span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">City, State</label>
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
                        className="w-full bg-[#121215] border border-neutral-800 text-xs text-neutral-100 rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">ZIP Code</label>
                      <input
                        type="text"
                        value={rfq.origin.zip}
                        onChange={(e) =>
                          setRfq({
                            ...rfq,
                            origin: { ...rfq.origin, zip: e.target.value },
                          })
                        }
                        className={`w-full bg-[#121215] border text-xs text-neutral-100 font-mono rounded px-2.5 py-1.5 focus:outline-none ${getBorderColorClass(
                          evaluation.fields['origin.zip']?.tier || 'GREEN'
                        )}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Destination Block */}
                <div className="space-y-2 p-3 bg-[#09090b] rounded-lg border border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-200 flex items-center justify-between font-sans">
                    Destination (Delivery)
                    <span className="text-[10px] font-mono text-neutral-500">
                      {evaluation.fields['dest.zip']?.tier}
                    </span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">City, State</label>
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
                        className="w-full bg-[#121215] border border-neutral-800 text-xs text-neutral-100 rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">ZIP Code</label>
                      <input
                        type="text"
                        value={rfq.destination.zip}
                        onChange={(e) =>
                          setRfq({
                            ...rfq,
                            destination: { ...rfq.destination, zip: e.target.value },
                          })
                        }
                        className={`w-full bg-[#121215] border text-xs text-neutral-100 font-mono rounded px-2.5 py-1.5 focus:outline-none ${getBorderColorClass(
                          evaluation.fields['dest.zip']?.tier || 'GREEN'
                        )}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Items, Dimensions & Dynamic PCF Classification */}
            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider font-sans">
                  <Package className="w-4 h-4 text-neutral-400" />
                  <span>Freight Cargo &amp; Density Specs</span>
                </div>
                <DensityCalculatorBadge
                  lengthIn={primaryItem.lengthIn}
                  widthIn={primaryItem.widthIn}
                  heightIn={primaryItem.heightIn}
                  weightLbs={primaryItem.unitWeightLbs}
                  quantity={primaryItem.quantity || 1}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">Pallets</label>
                  <input
                    type="number"
                    value={primaryItem.quantity}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value) || 1;
                      const items = [...rfq.items];
                      items[0] = {
                        ...primaryItem,
                        quantity: qty,
                        totalWeightLbs: qty * primaryItem.unitWeightLbs,
                      };
                      setRfq({ ...rfq, items, totalPallets: qty, totalWeightLbs: qty * primaryItem.unitWeightLbs });
                    }}
                    className="w-full bg-[#09090b] border border-neutral-800 text-xs text-white font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">Length (in)</label>
                  <input
                    type="number"
                    value={primaryItem.lengthIn}
                    onChange={(e) => {
                      const l = parseFloat(e.target.value) || 48;
                      const items = [...rfq.items];
                      items[0] = { ...primaryItem, lengthIn: l };
                      setRfq({ ...rfq, items });
                    }}
                    className="w-full bg-[#09090b] border border-neutral-800 text-xs text-white font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">Width (in)</label>
                  <input
                    type="number"
                    value={primaryItem.widthIn}
                    onChange={(e) => {
                      const w = parseFloat(e.target.value) || 40;
                      const items = [...rfq.items];
                      items[0] = { ...primaryItem, widthIn: w };
                      setRfq({ ...rfq, items });
                    }}
                    className="w-full bg-[#09090b] border border-neutral-800 text-xs text-white font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">Height (in)</label>
                  <input
                    type="number"
                    value={primaryItem.heightIn}
                    onChange={(e) => {
                      const h = parseFloat(e.target.value) || 48;
                      const items = [...rfq.items];
                      items[0] = { ...primaryItem, heightIn: h };
                      setRfq({ ...rfq, items });
                    }}
                    className="w-full bg-[#09090b] border border-neutral-800 text-xs text-white font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-0.5 font-sans">Total Weight (lbs)</label>
                  <input
                    type="number"
                    value={rfq.totalWeightLbs}
                    onChange={(e) => {
                      const wt = parseFloat(e.target.value) || 1000;
                      const items = [...rfq.items];
                      items[0] = { ...primaryItem, totalWeightLbs: wt, unitWeightLbs: wt / primaryItem.quantity };
                      setRfq({ ...rfq, items, totalWeightLbs: wt });
                    }}
                    className="w-full bg-[#09090b] border border-neutral-800 text-xs text-white font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-600 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Accessorials Chips & Command Palette Trigger */}
            <div className="bg-[#121215] border border-neutral-800 rounded-xl p-4 space-y-3">
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
      )}

      {/* Accessorial Command Palette Modal */}
      <AccessorialCommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        selectedAccessorials={rfq.accessorials}
        onToggle={toggleAccessorial}
      />

      {/* Interactive Use Case Modal */}
      {showUseCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowUseCaseModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-[#121215] text-neutral-400 hover:text-white border border-neutral-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px] font-bold">
                  Phase 1.1–1.9
                </span>
                <span className="text-xs text-neutral-400 font-mono">Dual-Pane Keyboard Review Desk</span>
              </div>
              <h3 className="text-2xl font-serif text-white font-normal">RFQ Intake &amp; Fast Review Desk</h3>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-300" /> What This Feature Does
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Provides a high-speed, dual-pane workspace comparing original customer emails and PDFs directly against AI-extracted freight parameters.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-300" /> Why Freight Brokers Need It
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Brokers are inundated with 100+ quote emails daily. Reviewing each manually takes 10+ minutes. This desk enables a 15-second keyboard audit (Cmd+K accessorials, Cmd+Enter rating) with zero mouse dependence.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono">
                  Key Automated Capabilities:
                </div>
                <div className="space-y-2">
                  {[
                    'Dual-pane original PDF / raw email text side-by-side inspection',
                    '11-Tier NMFC freight density engine (automatic class recommendations 50–500)',
                    'Accessorial Command Palette (Cmd+K) with instant keyword detectors',
                    'HITL Entropy Scorer flagging low-confidence fields for human review',
                  ].map((b, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-mono">Step 1 in Freight Procurement Lifecycle</span>
              <button
                onClick={() => setShowUseCaseModal(false)}
                className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-xl shadow transition"
              >
                Got It, Return to Desk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const FastReviewBoard: React.FC<FastReviewBoardProps> = (props) => {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 font-mono text-xs">Loading Review Desk...</div>}>
      <FastReviewBoardContent {...props} />
    </Suspense>
  );
};
