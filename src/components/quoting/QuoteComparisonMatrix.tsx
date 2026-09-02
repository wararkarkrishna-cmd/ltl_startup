'use client';

import React, { useState } from 'react';
import {
  TrendingDown,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Tag,
  Building2,
  Zap,
} from 'lucide-react';
import { Quote } from '../../db/schema';

export interface QuoteComparisonMatrixProps {
  quotes: any[];
  selectedQuoteId?: string | null;
  onSelectQuote: (quote: any) => void;
  wholesaleSavingsDollars?: number;
}

export const QuoteComparisonMatrix: React.FC<QuoteComparisonMatrixProps> = ({
  quotes,
  selectedQuoteId,
  onSelectQuote,
  wholesaleSavingsDollars = 0,
}) => {
  const [sortField, setSortField] = useState<'price' | 'transit' | 'reliability'>('price');
  const [filterAccountType, setFilterAccountType] = useState<'ALL' | 'DIRECT' | 'WHOLESALE'>('ALL');
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  const filteredQuotes = quotes.filter((q) => {
    if (filterAccountType === 'DIRECT') return q.accountType === 'DIRECT_BYOC';
    if (filterAccountType === 'WHOLESALE') return q.accountType === 'PLATFORM_WHOLESALE';
    return true;
  });

  const sortedQuotes = [...filteredQuotes].sort((a, b) => {
    if (sortField === 'price') return a.quotedCustomerPriceCents - b.quotedCustomerPriceCents;
    if (sortField === 'transit') return a.transitDays - b.transitDays;
    return a.carrierName.localeCompare(b.carrierName);
  });

  const toggleExpand = (id: string) => {
    setExpandedQuoteId(expandedQuoteId === id ? null : id);
  };

  return (
    <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 shadow-2xl space-y-4 font-sans">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-[#27272a]">
        <div>
          <h2 className="text-xl font-serif text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-neutral-400" />
            Carrier Rate Comparison Matrix
          </h2>
          <p className="text-xs text-neutral-400 font-sans">
            {quotes.length} Real-time rates generated across Direct BYOC &amp; Platform Wholesale Tiers
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Account Filter */}
          <div className="flex bg-[#121215] p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setFilterAccountType('ALL')}
              className={`px-3 py-1.5 rounded-md font-sans font-medium transition ${
                filterAccountType === 'ALL' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              All ({quotes.length})
            </button>
            <button
              onClick={() => setFilterAccountType('WHOLESALE')}
              className={`px-3 py-1.5 rounded-md font-sans font-medium transition flex items-center gap-1 ${
                filterAccountType === 'WHOLESALE' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              Wholesale
            </button>
            <button
              onClick={() => setFilterAccountType('DIRECT')}
              className={`px-3 py-1.5 rounded-md font-sans font-medium transition ${
                filterAccountType === 'DIRECT' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Direct BYOC
            </button>
          </div>

          {/* Sort Control */}
          <div className="flex bg-[#121215] p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setSortField('price')}
              className={`px-3 py-1.5 rounded-md font-sans font-medium transition flex items-center gap-1 ${
                sortField === 'price' ? 'bg-neutral-800 text-white font-semibold' : 'text-neutral-400'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              Best Price
            </button>
            <button
              onClick={() => setSortField('transit')}
              className={`px-3 py-1.5 rounded-md font-sans font-medium transition flex items-center gap-1 ${
                sortField === 'transit' ? 'bg-neutral-800 text-white font-semibold' : 'text-neutral-400'
              }`}
            >
              <Clock className="w-3 h-3" />
              Fastest
            </button>
          </div>
        </div>
      </div>

      {/* Rate Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-300 font-sans">
          <thead className="bg-[#121215] text-[10px] uppercase text-neutral-400 font-sans font-semibold tracking-wider">
            <tr>
              <th className="py-3 px-4">Carrier / Account</th>
              <th className="py-3 px-4">Transit</th>
              <th className="py-3 px-4">Carrier Cost</th>
              <th className="py-3 px-4">Broker Margin</th>
              <th className="py-3 px-4">Customer Quote</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272a]/60">
            {sortedQuotes.map((q, idx) => {
              const isSelected = selectedQuoteId === q.id || selectedQuoteId === q.quoteNumber;
              const isBestPrice = idx === 0 && sortField === 'price';
              const isWholesale = q.accountType === 'PLATFORM_WHOLESALE';

              return (
                <React.Fragment key={q.id || q.quoteNumber || idx}>
                  <tr
                    className={`transition hover:bg-[#121215] cursor-pointer ${
                      isSelected ? 'bg-[#18181c] border-l-4 border-white' : ''
                    }`}
                    onClick={() => toggleExpand(q.id || q.quoteNumber)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white text-sm font-sans">{q.carrierName}</div>
                        {isBestPrice && (
                          <span className="bg-neutral-900 text-white border border-neutral-700 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium uppercase tracking-wider">
                            Best Value
                          </span>
                        )}
                        {q.transitDays <= 2 && (
                          <span className="bg-neutral-900 text-neutral-300 border border-neutral-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
                            Fastest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-neutral-400 font-mono">{q.carrierScac}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            isWholesale
                              ? 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                              : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                          }`}
                        >
                          {q.sourceTag}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-white font-medium font-sans text-xs">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {q.transitDays} {q.transitDays === 1 ? 'Day' : 'Days'}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-sans">Est. Delivery ETA</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-neutral-300 text-xs">
                      ${(q.totalCarrierCostCents / 100).toFixed(2)}
                      <div className="text-[10px] text-neutral-500">
                        LH: ${(q.linehaulCostCents / 100).toFixed(0)} | Fuel: ${(q.fuelSurchargeCents / 100).toFixed(0)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-white font-medium text-xs">
                      +${((q.pricing?.grossProfitCents || q.grossProfitCents || 0) / 100).toFixed(2)}
                      <span className="text-[10px] text-neutral-500 ml-1 font-mono">
                        ({q.pricing?.appliedMarginPercent || q.appliedMarginPercent || 15}%)
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-base text-white">
                      ${(q.quotedCustomerPriceCents / 100).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectQuote(q);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition shadow flex items-center gap-1 ${
                            isSelected
                              ? 'bg-neutral-800 text-white border border-neutral-700'
                              : 'bg-white text-black hover:bg-neutral-200'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Selected
                            </>
                          ) : (
                            'Select'
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(q.id || q.quoteNumber);
                          }}
                          className="text-neutral-400 hover:text-white p-1"
                        >
                          {expandedQuoteId === (q.id || q.quoteNumber) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Breakdown Drawer */}
                  {expandedQuoteId === (q.id || q.quoteNumber) && (
                    <tr className="bg-[#0c0c0e] border-b border-[#27272a]">
                      <td colSpan={6} className="py-3 px-6 text-xs text-neutral-300 font-sans">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                          <div className="bg-[#121215] p-3 rounded-lg border border-neutral-800">
                            <div className="text-neutral-500 font-medium text-[11px]">Linehaul Base Rate</div>
                            <div className="text-white text-base font-mono font-bold mt-1">
                              ${(q.linehaulCostCents / 100).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-[#121215] p-3 rounded-lg border border-neutral-800">
                            <div className="text-neutral-500 font-medium text-[11px]">Fuel Surcharge (DOE)</div>
                            <div className="text-white text-base font-mono font-bold mt-1">
                              ${(q.fuelSurchargeCents / 100).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-[#121215] p-3 rounded-lg border border-neutral-800">
                            <div className="text-neutral-500 font-medium text-[11px]">Accessorial Charges</div>
                            <div className="text-white text-base font-mono font-bold mt-1">
                              ${(q.accessorialCostCents / 100).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-[#121215] p-3 rounded-lg border border-neutral-800">
                            <div className="text-neutral-500 font-medium text-[11px]">Net Broker Profit</div>
                            <div className="text-white text-base font-mono font-bold mt-1">
                              +${((q.pricing?.grossProfitCents || q.grossProfitCents || 0) / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
