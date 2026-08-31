'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Building2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { QuoteComparisonMatrix } from './QuoteComparisonMatrix';
import { SplitSavingsHighlightCard } from './SplitSavingsHighlightCard';
import { VolumeLtlWarningCard } from './VolumeLtlWarningCard';
import { SplitOptimizationResult } from '../../lib/optimization/split-optimizer';
import { VolumeLtlEvaluation } from '../../lib/classification/volume-ltl-engine';

export interface Phase2QuotingWorkspaceProps {
  shipmentId?: string;
  initialLane?: {
    originZip: string;
    originCity: string;
    originState: string;
    destZip: string;
    destCity: string;
    destState: string;
    pickupDate: string;
    items: Array<{
      lengthIn: number;
      widthIn: number;
      heightIn: number;
      weightLbs: number;
      quantity: number;
      nmfcClass: string;
    }>;
    accessorials: string[];
  };
}

export const Phase2QuotingWorkspace: React.FC<Phase2QuotingWorkspaceProps> = ({
  shipmentId = 'SHP-001928',
  initialLane = {
    originZip: '90001',
    originCity: 'Los Angeles',
    originState: 'CA',
    destZip: '60601',
    destCity: 'Chicago',
    destState: 'IL',
    pickupDate: new Date().toISOString().split('T')[0],
    items: [
      {
        lengthIn: 48,
        widthIn: 40,
        heightIn: 48,
        weightLbs: 1200,
        quantity: 4,
        nmfcClass: '70',
      },
      {
        lengthIn: 48,
        widthIn: 40,
        heightIn: 60,
        weightLbs: 900,
        quantity: 3,
        nmfcClass: '85',
      },
    ],
    accessorials: ['LIFTGATE_DELIVERY'],
  },
}) => {
  const [lane, setLane] = useState(initialLane);
  const [isLoading, setIsLoading] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [splitResult, setSplitResult] = useState<SplitOptimizationResult | null>(null);
  const [volumeLtl, setVolumeLtl] = useState<VolumeLtlEvaluation | null>(null);
  const [wholesaleSavingsDollars, setWholesaleSavingsDollars] = useState(0);
  const [isBooked, setIsBooked] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const fetchRatesProgressive = async () => {
    setIsLoading(true);
    setIsStreaming(true);
    setQuotes([]);
    setSelectedQuote(null);
    setSplitResult(null);

    const payload = {
      tenantId: '01916362-7901-7080-867c-9b8895092a01',
      shipmentId,
      originZip: lane.originZip,
      originCity: lane.originCity,
      originState: lane.originState,
      destZip: lane.destZip,
      destCity: lane.destCity,
      destState: lane.destState,
      pickupDate: lane.pickupDate,
      items: lane.items,
      accessorials: lane.accessorials,
    };

    try {
      const response = await fetch('/api/v1/quotes/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const matchEvent = line.match(/^event: (.*)$/m);
          const matchData = line.match(/^data: (.*)$/m);

          if (matchEvent && matchData) {
            const eventType = matchEvent[1].trim();
            const eventData = JSON.parse(matchData[1].trim());

            if (eventType === 'VOLUME_LTL') {
              setVolumeLtl(eventData);
            } else if (eventType === 'QUOTE_RECEIVED') {
              setQuotes((prev) => {
                const next = [...prev, eventData];
                // Auto-select lowest customer price
                next.sort((a, b) => a.quotedCustomerPriceCents - b.quotedCustomerPriceCents);
                if (!selectedQuote || eventData.quotedCustomerPriceCents < selectedQuote.quotedCustomerPriceCents) {
                  setSelectedQuote(next[0]);
                }
                return next;
              });
            } else if (eventType === 'SPLIT_OPTIMIZATION') {
              setSplitResult(eventData);
            } else if (eventType === 'COMPLETE') {
              setIsStreaming(false);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Falling back to synchronous rating endpoint...', err);
      // Fallback to synchronous endpoint
      const rateRes = await fetch('/api/v1/quotes/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const rateData = await rateRes.json();
      if (rateData.success) {
        setQuotes(rateData.quotes);
        setWholesaleSavingsDollars(rateData.wholesaleSavingsDollars || 0);
        if (rateData.bestPriceQuote) {
          setSelectedQuote(rateData.bestPriceQuote);
        }
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    fetchRatesProgressive();
  }, []);

  const totalPallets = lane.items.reduce((s, it) => s + (it.quantity || 1), 0);
  const totalWeight = lane.items.reduce((s, it) => s + (it.weightLbs || 500) * (it.quantity || 1), 0);

  const handleBookSelected = () => {
    if (!selectedQuote) return;
    setIsBooked(true);
    setBookingMessage(
      `Shipment booked successfully with ${selectedQuote.carrierName} (${selectedQuote.carrierScac}) at $${(
        selectedQuote.quotedCustomerPriceCents / 100
      ).toFixed(2)}.`
    );
  };

  const handleAcceptSplit = (split: SplitOptimizationResult) => {
    setIsBooked(true);
    setBookingMessage(
      `Split Plan Booked! Sub-Shipment A routed via ${split.subShipmentA?.selectedCarrier.carrierName} + Sub-Shipment B via ${split.subShipmentB?.selectedCarrier.carrierName}. Net savings captured: $${(
        split.netSplitBenefitCents / 100
      ).toFixed(2)}.`
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600/20 text-indigo-400 p-3 rounded-xl border border-indigo-500/30">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                {shipmentId}
              </span>
              <span className="text-xs text-slate-400">Ready: {lane.pickupDate}</span>
              {isStreaming && (
                <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  <Radio className="w-3 h-3 text-emerald-400" />
                  Live SSE Streaming
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2 mt-0.5">
              {lane.originCity}, {lane.originState} ({lane.originZip})
              <ArrowRight className="w-5 h-5 text-slate-400" />
              {lane.destCity}, {lane.destState} ({lane.destZip})
            </h1>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
              <span>{totalPallets} Pallets</span>
              <span>•</span>
              <span>{totalWeight.toLocaleString()} lbs</span>
              <span>•</span>
              <span>Accessorials: {lane.accessorials.join(', ') || 'Standard Dock'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRatesProgressive}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Re-Calculate Rates
          </button>
          <button
            onClick={handleBookSelected}
            disabled={!selectedQuote || isBooked}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            Book Quote (${selectedQuote ? (selectedQuote.quotedCustomerPriceCents / 100).toFixed(2) : '0.00'})
          </button>
        </div>
      </div>

      {/* Booking Notification Banner */}
      {isBooked && bookingMessage && (
        <div className="bg-emerald-950/80 border-2 border-emerald-500 text-emerald-200 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="font-bold text-sm">{bookingMessage}</div>
        </div>
      )}

      {/* Volume LTL Warning Card */}
      <VolumeLtlWarningCard evaluation={volumeLtl} />

      {/* Combinatorial Split Savings Highlight Card */}
      <SplitSavingsHighlightCard splitResult={splitResult} onAcceptSplit={handleAcceptSplit} />

      {/* Multi-Carrier Rate Comparison Matrix */}
      <QuoteComparisonMatrix
        quotes={quotes}
        selectedQuoteId={selectedQuote?.id || selectedQuote?.quoteNumber}
        onSelectQuote={setSelectedQuote}
        wholesaleSavingsDollars={wholesaleSavingsDollars}
      />
    </div>
  );
};
