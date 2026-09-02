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
      <div className="rounded-xl border border-neutral-800 bg-[#09090b] p-4 space-y-3 shadow-md font-sans">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <div className="flex items-center space-x-2 text-white font-medium text-xs">
            <Gauge className="w-4 h-4 text-neutral-400" />
            <span>Algorithmic Density &amp; NMFC Engine</span>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded font-mono bg-neutral-900 text-white border border-neutral-700">
            Class {summary.recommendedShipmentClass}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#121215] p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 flex items-center gap-1 mb-1 font-sans text-[10px] uppercase">
              <Box className="w-3.5 h-3.5 text-neutral-400" />
              PCF Density
            </span>
            <span className="text-sm font-bold text-white">{summary.effectiveShipmentPcf} lbs/cu.ft</span>
          </div>

          <div className="bg-[#121215] p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 flex items-center gap-1 mb-1 font-sans text-[10px] uppercase">
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
              Total Volume
            </span>
            <span className="text-sm font-bold text-white">{summary.totalCubicFeet} cu.ft</span>
          </div>

          <div className="bg-[#121215] p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 flex items-center gap-1 mb-1 font-sans text-[10px] uppercase">
              <Truck className="w-3.5 h-3.5 text-neutral-400" />
              Linear Feet
            </span>
            <span className="text-sm font-bold text-white">{summary.totalLinearFeet} ft</span>
          </div>

          <div className="bg-[#121215] p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 block mb-1 font-sans text-[10px] uppercase">53ft Trailer Cap</span>
            <span className="text-sm font-bold text-white">{summary.trailerSpaceUtilizationPercent}%</span>
          </div>
        </div>

        {summary.volumeLtlFlags.isVolumeLtl && (
          <div className="flex items-center space-x-2 text-white bg-[#121215] border border-neutral-700 p-2.5 rounded-lg text-xs font-sans">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-neutral-300" />
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
