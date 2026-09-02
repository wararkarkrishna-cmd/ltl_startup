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
  Zap,
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
  const singlePriceDollars = (splitResult.singleCarrierCustomerPriceCents / 100).toFixed(2);
  const splitPriceDollars = (splitResult.combinedSplitCustomerPriceCents / 100).toFixed(2);

  const subA = splitResult.subShipmentA;
  const subB = splitResult.subShipmentB;

  return (
    <div className="relative overflow-hidden bg-[#09090b] border border-[#27272a] rounded-2xl p-5 shadow-2xl space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 text-white p-2.5 rounded-xl border border-neutral-700">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-white text-black font-sans font-bold text-xs px-2.5 py-0.5 rounded uppercase tracking-wider">
                Split Optimizer
              </span>
              <span className="text-neutral-300 font-medium text-xs font-mono">
                Verified Net Savings: ${netSavingsDollars} ({splitResult.grossSavingsPercent}% Savings)
              </span>
            </div>
            <h3 className="text-base font-serif text-white font-normal mt-1">
              {splitResult.plainLanguageHeadline}
            </h3>
          </div>
        </div>

        <button
          onClick={() => onAcceptSplit(splitResult)}
          className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-xl shadow transition flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Book Split Plan
        </button>
      </div>

      {/* Split Legs Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        {/* Sub-Shipment Leg A */}
        {subA && (
          <div className="bg-[#121215] border border-neutral-800 rounded-xl p-3.5 space-y-1.5 font-sans">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-semibold uppercase text-[10px]">{subA.subShipmentName}</span>
              <span className="bg-[#09090b] text-neutral-200 px-2 py-0.5 rounded font-mono text-[10px] border border-neutral-800">
                {subA.selectedCarrier.carrierName}
              </span>
            </div>
            <div className="text-white font-bold text-sm">
              {subA.totalPallets} Pallets ({subA.totalWeightLbs.toLocaleString()} lbs)
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-neutral-800/80 font-mono">
              <span className="text-neutral-400 font-sans">Carrier Price:</span>
              <span className="text-white font-bold">${(subA.carrierPriceCents / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Sub-Shipment Leg B */}
        {subB && (
          <div className="bg-[#121215] border border-neutral-800 rounded-xl p-3.5 space-y-1.5 font-sans">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-semibold uppercase text-[10px]">{subB.subShipmentName}</span>
              <span className="bg-[#09090b] text-neutral-200 px-2 py-0.5 rounded font-mono text-[10px] border border-neutral-800">
                {subB.selectedCarrier.carrierName}
              </span>
            </div>
            <div className="text-white font-bold text-sm">
              {subB.totalPallets} Pallets ({subB.totalWeightLbs.toLocaleString()} lbs)
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-neutral-800/80 font-mono">
              <span className="text-neutral-400 font-sans">Carrier Price:</span>
              <span className="text-white font-bold">${(subB.carrierPriceCents / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Operational Friction & Net Return Card */}
        <div className="bg-[#121215] border border-neutral-800 rounded-xl p-3.5 space-y-1.5 font-mono text-xs">
          <div className="text-neutral-400 font-sans font-semibold uppercase text-[10px]">Friction &amp; Net Return</div>
          <div className="flex justify-between text-neutral-300">
            <span>Single Rate:</span>
            <span>${singlePriceDollars}</span>
          </div>
          <div className="flex justify-between text-neutral-300">
            <span>Split Rate:</span>
            <span>${splitPriceDollars}</span>
          </div>
          <div className="flex justify-between text-white font-bold border-t border-neutral-800 pt-1 text-sm">
            <span>Net Savings:</span>
            <span>+${netSavingsDollars}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-400 italic font-sans">
        {splitResult.plainLanguageExplanation}
      </p>
    </div>
  );
};
