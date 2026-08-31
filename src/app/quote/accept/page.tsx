'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Truck,
  Building2,
  Calendar,
  DollarSign,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

function QuoteAcceptPortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<any | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<any | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No quote action token found. Please check your link.');
      setLoading(false);
      return;
    }

    fetch(`/api/v1/quotes/accept?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTokenData(data);
          if (data.isUsed) {
            setError('This quote has already been accepted and booked.');
          }
        } else {
          setError(data.error || 'Failed to verify quote token.');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !agreed) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/quotes/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          poNumber,
          signerName: signerName || 'Authorized Shipper Representative',
          signerEmail: signerEmail || 'shipper@customer.com',
          specialInstructions,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setConfirmation(json);
      } else {
        setError(json.error || 'Booking submission failed.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-medium">Verifying secure quote token...</p>
        </div>
      </div>
    );
  }

  if (error && !confirmation) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center mx-auto border border-rose-500/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Quote Link Unavailable</h2>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-emerald-500/40 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/30 shadow-inner">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          <div>
            <span className="bg-emerald-500/20 text-emerald-300 font-mono text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-emerald-500/30">
              Booking Confirmed
            </span>
            <h1 className="text-2xl font-black text-white mt-2">Shipment Booked Successfully!</h1>
            <p className="text-sm text-slate-400 mt-1">
              Confirmation #{confirmation.bookingConfirmationNumber}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-left font-mono text-xs space-y-2">
            <div className="flex justify-between text-slate-300">
              <span>Guaranteed Rate:</span>
              <span className="text-emerald-400 font-bold">${confirmation.bookedPriceDollars?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Timestamp:</span>
              <span>{new Date(confirmation.bookedAt).toLocaleString()}</span>
            </div>
            {poNumber && (
              <div className="flex justify-between text-slate-300">
                <span>PO Reference:</span>
                <span className="text-white font-bold">{poNumber}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            A digital bill of lading (eBOL) and carrier dispatch confirmation packet have been generated. You will receive real-time milestone updates.
          </p>
        </div>
      </div>
    );
  }

  const quote = tokenData?.quote;
  const priceDollars = tokenData?.payload ? (tokenData.payload.quotedPriceCents / 100).toFixed(2) : '0.00';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 p-6 md:p-8 border-b border-indigo-500/30">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs px-2.5 py-0.5 rounded font-bold font-mono">
                  1-Click Direct Booking
                </span>
                <span className="text-xs text-slate-400">Quote #{quote?.quoteNumber || 'Q-ONLINE'}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">Review & Confirm Shipment</h1>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-semibold uppercase">Guaranteed Price</div>
              <div className="text-3xl font-black text-emerald-400 font-mono">${priceDollars}</div>
            </div>
          </div>
        </div>

        {/* Carrier & Transit Specs */}
        <div className="px-6 md:px-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-semibold uppercase flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                Assigned Carrier Tier
              </div>
              <div className="text-white font-bold text-base">
                {quote?.carrierName || 'Tier-1 Guaranteed Carrier'}
              </div>
              <div className="text-xs text-slate-400 font-mono">{quote?.carrierScac} • {quote?.sourceTag}</div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-semibold uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Transit Commitment
              </div>
              <div className="text-white font-bold text-base">
                {quote?.transitDays || 3} Business Days
              </div>
              <div className="text-xs text-slate-400">Guaranteed standard freight service</div>
            </div>
          </div>

          {/* Booking Form */}
          <form onSubmit={handleSubmitBooking} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Customer PO Number (Optional)
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-984201"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Authorized Signer Name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Your Full Name"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Special Dock / Delivery Instructions
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Call 24h prior to delivery; check-in at security gate 3."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Click-wrap Approval Checkbox */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
              <input
                type="checkbox"
                id="agree-terms"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500"
                required
              />
              <label htmlFor="agree-terms" className="text-xs text-slate-300 leading-relaxed">
                I acknowledge and approve the booking of this shipment at the guaranteed rate of{' '}
                <strong className="text-emerald-400">${priceDollars}</strong>. I certify that declared dimensions, weights, and NMFC classifications are accurate, and agree to standard commercial freight terms.
              </label>
            </div>

            <button
              type="submit"
              disabled={!agreed || submitting}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base rounded-xl shadow-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm & Dispatch Shipment (${priceDollars})
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/60 p-4 text-center text-xs text-slate-500 border-t border-slate-800">
          Secured with AES-256-GCM and SHA-256 HMAC action verification.
        </div>
      </div>
    </div>
  );
}

export default function QuoteAcceptPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm font-medium">Loading booking portal...</p>
          </div>
        </div>
      }
    >
      <QuoteAcceptPortalContent />
    </Suspense>
  );
}
