'use client';

import React, { useState, useEffect } from 'react';
import { AccessorialCode } from '@/db/schema';
import { Check, Search, X } from 'lucide-react';

interface AccessorialCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccessorials: AccessorialCode[];
  onToggle: (code: AccessorialCode) => void;
}

const AVAILABLE_ACCESSORIALS: Array<{
  code: AccessorialCode;
  name: string;
  category: string;
  fee: string;
  description: string;
}> = [
  { code: 'LG_PU', name: 'Liftgate Pickup', category: 'PICKUP', fee: '$75.00', description: 'Hydraulic liftgate required at origin' },
  { code: 'LG_DEL', name: 'Liftgate Delivery', category: 'DELIVERY', fee: '$75.00', description: 'Hydraulic liftgate required at consignee dock' },
  { code: 'RES_PU', name: 'Residential Pickup', category: 'PICKUP', fee: '$85.00', description: 'Origin in residential or home business zone' },
  { code: 'RES_DEL', name: 'Residential Delivery', category: 'DELIVERY', fee: '$85.00', description: 'Destination in residential neighborhood' },
  { code: 'LIM_ACC', name: 'Limited Access', category: 'ACCESS', fee: '$95.00', description: 'Construction site, school, military base, church' },
  { code: 'INS_DEL', name: 'Inside Delivery', category: 'DELIVERY', fee: '$120.00', description: 'Driver moves freight past dock threshold' },
  { code: 'NOTIFY', name: 'Notification / Appointment', category: 'SPECIAL', fee: '$35.00', description: 'Call receiver 24h prior to delivery' },
  { code: 'HAZMAT', name: 'Hazardous Materials', category: 'COMPLIANCE', fee: '$150.00', description: 'DOT placards and hazmat certification required' },
  { code: 'TRADESHOW', name: 'Tradeshow / Expo Delivery', category: 'SPECIAL', fee: '$250.00', description: 'Convention center marshalling yard delivery' },
  { code: 'SORT_SEG', name: 'Sort & Segregate', category: 'HANDLING', fee: '$110.00', description: 'Driver or lumpers break down freight by SKU' },
  { code: 'DETENTION', name: 'Driver Detention', category: 'ACCESSORIAL', fee: '$85.00', description: 'Billed per hour after 2 hours free time' },
];

export const AccessorialCommandPalette: React.FC<AccessorialCommandPaletteProps> = ({
  isOpen,
  onClose,
  selectedAccessorials,
  onToggle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = AVAILABLE_ACCESSORIALS.filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            placeholder="Search accessorials (Liftgate, Residential, Hazmat...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none w-full"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Accessorials */}
        <div className="overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/50">
          {filtered.map((acc) => {
            const isSelected = selectedAccessorials.includes(acc.code);
            return (
              <button
                key={acc.code}
                onClick={() => onToggle(acc.code)}
                className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition ${
                  isSelected
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm">{acc.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                      {acc.code}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ~{acc.fee}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{acc.description}</p>
                </div>

                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center border transition ${
                    isSelected
                      ? 'bg-emerald-500 border-emerald-400 text-black'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              No matching accessorials found.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-xs text-slate-400 flex justify-between items-center">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-[10px]">Esc</kbd> to exit</span>
          <span>{selectedAccessorials.length} selected</span>
        </div>
      </div>
    </div>
  );
};
