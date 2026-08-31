'use client';

import React from 'react';
import {
  Sparkles,
  ArrowRight,
  TrendingDown,
  Layers,
  ShieldAlert,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { SplitOptimizationResult } from '../../lib/optimization/split-optimizer';

export interface SplitSavingsHighlightCardProps {
  splitResult: SplitOptimizationResult | null;
  onAcceptSplit: (split: SplitOptimizationResult) => void;
}

export const SplitSavingsHighlightCard: React.FC<SplitSavingsHighlightCardProps> = ({
  splitResult,
  onAcceptSplit,
}) => {
  if (!splitResult || !splitResult.isSplitFeasible || !splitResult.isRecommended) {
    return null;
  }

  const netSavingsDollars = (splitResult.netSplitBenefitCents / 100).toFixed(2);
  const grossSavingsDollars = (splitResult.grossSavingsCents / 100).toFixed(2);
  const frictionDollars = (splitResult.operationalFrictionCents / 100).toFixed(2);
  const singlePriceDollars = (splitResult.singleCarrierCustomerPriceCents / 100).toFixed(2);
  const splitPriceDollars = (splitResult.combinedSplitCustomerPriceCents / 100).toFixed(2);

  const subA = splitResult.subShipmentA;
  const subB = splitResult.subShipmentB;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950/70 via-slate-900 to-emerald-950/40 border-2 border-emerald-500/40 rounded-xl p-5 shadow-2xl space-y-4">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30 shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Split Optimizer
              </span>
              <span className="text-emerald-300 font-semibold text-sm">
                Verified Net Savings: ${netSavingsDollars} ({splitResult.grossSavingsPercent}% Savings)
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5">
              {splitResult.plainLanguageHeadline}
            </h3>
          </div>
        </div>

        <button
          onClick={() => onAcceptSplit(splitResult)}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg transition transform active:scale-95 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Book Split Plan
        </button>
      </div>

      {/* Split Legs Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        {/* Sub-Shipment Leg A */}
        {subA && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold uppercase">{subA.subShipmentName}</span>
              <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
                {subA.selectedCarrier.carrierName}
              </span>
            </div>
            <div className="text-white font-bold text-base">
              {subA.totalPallets} Pallets ({subA.totalWeightLbs.toLocaleString()} lbs)
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800 font-mono">
              <span className="text-slate-400">Carrier Price:</span>
              <span className="text-white font-bold">${(subA.carrierPriceCents / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Sub-Shipment Leg B */}
        {subB && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold uppercase">{subB.subShipmentName}</span>
              <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
                {subB.selectedCarrier.carrierName}
              </span>
            </div>
            <div className="text-white font-bold text-base">
              {subB.totalPallets} Pallets ({subB.totalWeightLbs.toLocaleString()} lbs)
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800 font-mono">
              <span className="text-slate-400">Carrier Price:</span>
              <span className="text-white font-bold">${(subB.carrierPriceCents / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Operational Friction & Net Math Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-1.5 font-mono text-xs">
          <div className="text-slate-400 font-sans font-semibold uppercase">Friction & Net Return</div>
          <div className="flex justify-between text-slate-300">
            <span>Single Rate:</span>
            <span>${singlePriceDollars}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Split Rate:</span>
            <span>${splitPriceDollars}</span>
          </div>
          <div className="flex justify-between text-amber-400">
            <span>Dock Buffer:</span>
            <span>-${frictionDollars}</span>
          </div>
          <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-800 pt-1 text-sm">
            <span>Net Savings:</span>
            <span>+${netSavingsDollars}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 italic">
        {splitResult.plainLanguageExplanation}
      </p>
    </div>
  );
};
