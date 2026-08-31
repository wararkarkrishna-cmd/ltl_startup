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
    <div
      className={`rounded-xl p-4 border transition ${
        isSevereCubic
          ? 'bg-rose-950/40 border-rose-600/50 text-rose-200'
          : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            isSevereCubic ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <span>
              {isSevereCubic
                ? 'High Risk: Low-Density Cubic Capacity Penalty (Rule 110)'
                : 'Volume LTL Space Warning'}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                isSevereCubic ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
              }`}
            >
              {evaluation.totalLinearFeet} Linear Ft / {evaluation.totalPallets} Pallets
            </span>
          </div>
          <p className="text-xs text-slate-300">
            {evaluation.warningMessage}
          </p>
          <div className="flex flex-wrap gap-2 pt-1.5 text-[11px]">
            {evaluation.triggerReasons.map((reason, idx) => (
              <span
                key={idx}
                className="bg-slate-900/80 px-2.5 py-0.5 rounded-md border border-slate-700 text-slate-300 font-mono"
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
