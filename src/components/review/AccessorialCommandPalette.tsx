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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4 font-sans">
      <div className="bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-[#27272a] bg-[#0c0c0e]">
          <Search className="w-4 h-4 text-neutral-400 mr-3" />
          <input
            type="text"
            placeholder="Search accessorials (Liftgate, Residential, Hazmat...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="bg-transparent text-white placeholder-neutral-500 text-xs font-sans focus:outline-none w-full"
          />
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Accessorials */}
        <div className="overflow-y-auto p-2 space-y-1 divide-y divide-neutral-800/50 custom-scrollbar">
          {filtered.map((acc) => {
            const isSelected = selectedAccessorials.includes(acc.code);
            return (
              <button
                key={acc.code}
                onClick={() => onToggle(acc.code)}
                className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition ${
                  isSelected
                    ? 'bg-[#121215] border border-neutral-700 text-white font-semibold'
                    : 'hover:bg-neutral-900 text-neutral-300 border border-transparent'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-white font-bold">{acc.code}</span>
                    <span className="text-xs font-sans text-neutral-200">{acc.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#09090b] text-neutral-400 border border-neutral-800 rounded">
                      {acc.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 font-sans">{acc.description}</p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs text-neutral-300">{acc.fee}</span>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                      isSelected
                        ? 'bg-white border-white text-black'
                        : 'border-neutral-700 bg-[#121215]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
