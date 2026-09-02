'use client';

import React from 'react';
import { AlertTriangle, Info, Truck } from 'lucide-react';
import { VolumeLtlEvaluation } from '../../lib/classification/volume-ltl-engine';

export interface VolumeLtlWarningCardProps {
  evaluation: VolumeLtlEvaluation | null;
}

export const VolumeLtlWarningCard: React.FC<VolumeLtlWarningCardProps> = ({ evaluation }) => {
  if (!evaluation || !evaluation.isVolumeLtl) {
    return null;
  }

  const isSevereCubic = evaluation.isCubicCapacityPenaltyRisk;

  return (
    <div className="rounded-2xl p-4 border border-[#27272a] bg-[#09090b] text-neutral-200 font-sans shadow-xl">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-neutral-900 text-white border border-neutral-700">
          <AlertTriangle className="w-5 h-5 text-neutral-300" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-white text-sm">
            <span>
              {isSevereCubic
                ? 'High Risk: Low-Density Cubic Capacity Penalty (Rule 110)'
                : 'Volume LTL Space Warning'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-neutral-900 text-white border border-neutral-700">
              {evaluation.totalLinearFeet} Linear Ft / {evaluation.totalPallets} Pallets
            </span>
          </div>
          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            {evaluation.warningMessage}
          </p>
          <div className="flex flex-wrap gap-2 pt-1.5 text-[11px]">
            {evaluation.triggerReasons.map((reason, idx) => (
              <span
                key={idx}
                className="bg-[#121215] px-2.5 py-0.5 rounded border border-neutral-800 text-neutral-300 font-mono"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
