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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Carrier Rate Comparison Matrix
          </h2>
          <p className="text-xs text-slate-400">
            {quotes.length} Real-time rates generated across Direct BYOC & Platform Wholesale Tiers
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Account Filter */}
          <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setFilterAccountType('ALL')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                filterAccountType === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({quotes.length})
            </button>
            <button
              onClick={() => setFilterAccountType('WHOLESALE')}
              className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1 ${
                filterAccountType === 'WHOLESALE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              Wholesale
            </button>
            <button
              onClick={() => setFilterAccountType('DIRECT')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                filterAccountType === 'DIRECT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Direct BYOC
            </button>
          </div>

          {/* Sort Control */}
          <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setSortField('price')}
              className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1 ${
                sortField === 'price' ? 'bg-slate-700 text-emerald-400 font-semibold' : 'text-slate-400'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              Best Price
            </button>
            <button
              onClick={() => setSortField('transit')}
              className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1 ${
                sortField === 'transit' ? 'bg-slate-700 text-blue-400 font-semibold' : 'text-slate-400'
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
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 font-semibold tracking-wider">
            <tr>
              <th className="py-3 px-4">Carrier / Account</th>
              <th className="py-3 px-4">Transit</th>
              <th className="py-3 px-4">Carrier Cost</th>
              <th className="py-3 px-4">Broker Margin</th>
              <th className="py-3 px-4">Customer Quote</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sortedQuotes.map((q, idx) => {
              const isSelected = selectedQuoteId === q.id || selectedQuoteId === q.quoteNumber;
              const isBestPrice = idx === 0 && sortField === 'price';
              const isWholesale = q.accountType === 'PLATFORM_WHOLESALE';

              return (
                <React.Fragment key={q.id || q.quoteNumber || idx}>
                  <tr
                    className={`transition hover:bg-slate-800/40 cursor-pointer ${
                      isSelected ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : ''
                    }`}
                    onClick={() => toggleExpand(q.id || q.quoteNumber)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-white text-base">{q.carrierName}</div>
                        {isBestPrice && (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Best Value
                          </span>
                        )}
                        {q.transitDays <= 2 && (
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            Fastest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-400 font-mono">{q.carrierScac}</span>
                        <span
                          className={`text-[11px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            isWholesale
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {q.sourceTag}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-200 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {q.transitDays} {q.transitDays === 1 ? 'Day' : 'Days'}
                      </div>
                      <div className="text-[11px] text-slate-400">Est. Delivery ETA</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      ${(q.totalCarrierCostCents / 100).toFixed(2)}
                      <div className="text-[10px] text-slate-500">
                        LH: ${(q.linehaulCostCents / 100).toFixed(0)} | Fuel: ${(q.fuelSurchargeCents / 100).toFixed(0)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-medium">
                      +${((q.pricing?.grossProfitCents || q.grossProfitCents || 0) / 100).toFixed(2)}
                      <span className="text-xs text-slate-400 ml-1">
                        ({q.pricing?.appliedMarginPercent || q.appliedMarginPercent || 15}%)
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-lg text-white">
                      ${(q.quotedCustomerPriceCents / 100).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectQuote(q);
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-md flex items-center gap-1 ${
                            isSelected
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-indigo-600 text-white hover:bg-indigo-500'
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
                          className="text-slate-400 hover:text-white p-1"
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
                    <tr className="bg-slate-950/70 border-b border-slate-800">
                      <td colSpan={6} className="py-3 px-6 text-xs text-slate-300">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                            <div className="text-slate-400 font-semibold">Linehaul Base Rate</div>
                            <div className="text-white text-base font-mono font-bold mt-1">
                              ${(q.linehaulCostCents / 100).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                            <div className="text-slate-400 font-semibold">Fuel Surcharge (DOE)</div>
                            <div className="text-white text-base font-mono font-bold mt-1">
                              ${(q.fuelSurchargeCents / 100).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                            <div className="text-slate-400 font-semibold">Accessorial Charges</div>
                            <div className="text-white text-base font-mono font-bold mt-1">
                              ${(q.accessorialCostCents / 100).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                            <div className="text-slate-400 font-semibold">Net Broker Profit</div>
                            <div className="text-emerald-400 text-base font-mono font-bold mt-1">
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
