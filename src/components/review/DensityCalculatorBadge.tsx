'use client';

import React from 'react';
import { LtlDensityCalculator } from '@/lib/classification/density-calculator';
import { AlertTriangle, Box, Gauge, Layers, Truck } from 'lucide-react';

interface DensityCalculatorBadgeProps {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLbs: number;
  quantity: number;
  isStackable?: boolean;
}

export const DensityCalculatorBadge: React.FC<DensityCalculatorBadgeProps> = ({
  lengthIn,
  widthIn,
  heightIn,
  weightLbs,
  quantity,
  isStackable = false,
}) => {
  try {
    const summary = LtlDensityCalculator.evaluateShipment([
      {
        lengthIn: Math.max(1, lengthIn || 48),
        widthIn: Math.max(1, widthIn || 40),
        heightIn: Math.max(1, heightIn || 48),
        weightLbs: Math.max(1, weightLbs || 1000),
        quantity: Math.max(1, quantity || 1),
        isStackable,
      },
    ]);

    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
            <Gauge className="w-4 h-4" />
            <span>Algorithmic Density & NMFC Engine</span>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Class {summary.recommendedShipmentClass}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1 mb-1">
              <Box className="w-3.5 h-3.5 text-blue-400" />
              PCF Density
            </span>
            <span className="text-sm font-bold text-slate-100">{summary.effectiveShipmentPcf} lbs/cu.ft</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1 mb-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Total Volume
            </span>
            <span className="text-sm font-bold text-slate-100">{summary.totalCubicFeet} cu.ft</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1 mb-1">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              Linear Feet
            </span>
            <span className="text-sm font-bold text-slate-100">{summary.totalLinearFeet} ft</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
            <span className="text-slate-400 block mb-1">53ft Trailer Cap</span>
            <span className="text-sm font-bold text-slate-100">{summary.trailerSpaceUtilizationPercent}%</span>
          </div>
        </div>

        {summary.volumeLtlFlags.isVolumeLtl && (
          <div className="flex items-center space-x-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-md text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Volume-LTL Threshold Warning:</strong> Exceeds standard single-carrier thresholds ({summary.totalLinearFeet} LF / {summary.totalWeightLbs} lbs). Routing to Split-Optimizer recommended.
            </span>
          </div>
        )}
      </div>
    );
  } catch (err) {
    return null;
  }
};
