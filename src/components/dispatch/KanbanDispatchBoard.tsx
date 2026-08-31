'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { KanbanBoardState, DispatchCard } from '../../lib/dispatch/dispatch-board-engine';
import { DISPATCH_BOARD_COLUMNS, DispatchBoardColumn } from '../../db/schema';

export const KanbanDispatchBoard: React.FC = () => {
  const [boardState, setBoardState] = useState<KanbanBoardState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchBoard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/dispatch/board');
      const data = await res.json();
      if (data.success) {
        setBoardState(data.board);
      }
    } catch (err) {
      console.error('Failed to fetch dispatch board:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, []);

  const handleAdvanceStatus = async (shipmentId: string, currentColumn: DispatchBoardColumn) => {
    const nextStatusMap: Record<DispatchBoardColumn, string> = {
      UNASSIGNED: 'TENDERED',
      TENDER_SENT: 'TENDER_ACCEPTED',
      TENDER_ACCEPTED: 'DISPATCHED',
      DISPATCHED: 'PICKED_UP',
      AT_PICKUP: 'IN_TRANSIT',
      IN_TRANSIT: 'OUT_FOR_DELIVERY',
      OUT_FOR_DELIVERY: 'DELIVERED',
      DELIVERED: 'INVOICED',
      INVOICED: 'SETTLED',
      SETTLED: 'SETTLED',
    };

    const nextStatus = nextStatusMap[currentColumn];
    if (!nextStatus || nextStatus === currentColumn) return;

    setUpdatingId(shipmentId);
    try {
      const res = await fetch('/api/v1/dispatch/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: '01916362-7901-7080-867c-9b8895092a01',
          shipmentId,
          newStatus: nextStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchBoard();
      }
    } catch (err) {
      console.error('Failed to advance shipment status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const columnsList = DISPATCH_BOARD_COLUMNS;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-5">
      {/* Board Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded font-bold uppercase font-mono border border-indigo-500/30">
              Real-Time Dispatch
            </span>
            <span className="text-xs text-slate-400">
              {boardState?.totalActiveShipments || 0} Active Loads
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-0.5 flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-400" />
            LTL Operations Kanban Board
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search load, city, ref..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={fetchBoard}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync
          </button>

          <a
            href="/api/v1/shipments/01916362-7901-7080-867c-9b8895092s01/ebol?format=pdf"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Open Sample eBOL PDF
          </a>
        </div>
      </div>

      {/* Empty State Banner if no cards */}
      {(!boardState || boardState.totalActiveShipments === 0) && !isLoading && (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 text-center space-y-3 shadow-xl">
          <Truck className="w-10 h-10 text-indigo-400 mx-auto animate-bounce" />
          <h2 className="text-lg font-bold text-white">No Active Shipments on Board</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click the button below to load 6 realistic test shipments across all dispatch stages (Dallas to Houston, LA to Chicago, etc.).
          </p>
          <button
            onClick={fetchBoard}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg inline-flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Populate Practice Loads Now
          </button>
        </div>
      )}

      {/* Kanban Columns Grid */}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {columnsList.map((colKey) => {
          const colData = boardState?.columns[colKey];
          const cards = (colData?.cards || []).filter((c) => {
            if (!searchFilter) return true;
            const q = searchFilter.toLowerCase();
            return (
              c.referenceNumber.toLowerCase().includes(q) ||
              c.originCity.toLowerCase().includes(q) ||
              c.destCity.toLowerCase().includes(q)
            );
          });

          return (
            <div
              key={colKey}
              className="min-w-[290px] max-w-[290px] bg-slate-900/80 border border-slate-800/80 rounded-2xl flex flex-col max-h-[calc(100vh-180px)] shadow-lg"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-800/80 flex justify-between items-center bg-slate-900 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                    {colData?.label || colKey}
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {((colData?.totalWeightLbs || 0) / 1000).toFixed(1)}k lbs
                  </div>
                </div>
                <span className="bg-slate-800 text-indigo-300 border border-slate-700 px-2 py-0.5 rounded-full text-xs font-bold font-mono">
                  {cards.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
                {cards.map((card) => (
                  <div
                    key={card.shipmentId}
                    className="bg-slate-950/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3 space-y-2 shadow-md transition"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {card.referenceNumber}
                      </span>
                      {card.isVolumeLtl && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded font-bold">
                          VOL-LTL
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <span>{card.originCity}, {card.originState}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span>{card.destCity}, {card.destState}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                      <span>{card.totalPallets} Plts ({card.totalWeightLbs.toLocaleString()}#)</span>
                      <span>Ready: {card.pickupDateReady}</span>
                    </div>

                    {/* Action Bar with direct eBOL download */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-xs">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/api/v1/shipments/${card.shipmentId}/ebol?format=pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded text-[10px] font-bold flex items-center gap-1 transition"
                          title="Download official VICS eBOL PDF"
                        >
                          <FileText className="w-3 h-3 text-indigo-400" />
                          PDF eBOL
                        </a>
                        <a
                          href={`/api/v1/shipments/${card.shipmentId}/ebol?format=html`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded text-[10px] font-mono transition"
                        >
                          HTML
                        </a>
                      </div>

                      {colKey !== 'SETTLED' && (
                        <button
                          onClick={() => handleAdvanceStatus(card.shipmentId, colKey)}
                          disabled={updatingId === card.shipmentId}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded text-[11px] font-bold transition flex items-center gap-1"
                        >
                          {updatingId === card.shipmentId ? (
                            '...'
                          ) : (
                            <>
                              Advance
                              <ChevronRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {cards.length === 0 && (
                  <div className="text-center py-8 text-slate-600 text-xs italic">
                    No loads in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
