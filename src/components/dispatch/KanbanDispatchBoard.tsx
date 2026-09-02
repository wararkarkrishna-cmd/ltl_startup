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
    <div className="space-y-5 font-sans">
      {/* Board Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#09090b] border border-[#27272a] p-4 md:p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-neutral-900 text-neutral-300 text-[10px] px-2.5 py-0.5 rounded font-mono font-medium border border-neutral-800 uppercase">
              Real-Time Dispatch
            </span>
            <span className="text-xs text-neutral-400 font-sans">
              <strong className="text-white font-mono">{boardState?.totalActiveShipments || 0}</strong> Active Loads
            </span>
          </div>
          <h1 className="text-2xl font-serif text-white mt-1 flex items-center gap-2">
            <Truck className="w-5 h-5 text-neutral-400" />
            LTL Operations Kanban Board
          </h1>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search load, city, ref..."
              className="w-full bg-[#121215] border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 font-sans focus:outline-none focus:border-neutral-600"
            />
          </div>

          <button
            onClick={fetchBoard}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[#121215] hover:bg-neutral-800 text-neutral-200 text-xs font-sans font-medium rounded-lg border border-neutral-800 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync
          </button>

          <a
            href="/api/v1/shipments/01916362-7901-7080-867c-9b8895092s01/ebol?format=pdf"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-sans font-bold rounded-lg shadow flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Sample eBOL PDF
          </a>
        </div>
      </div>

      {/* Empty State Banner if no cards */}
      {(!boardState || boardState.totalActiveShipments === 0) && !isLoading && (
        <div className="bg-[#09090b] border border-neutral-800 rounded-2xl p-6 text-center space-y-3 shadow-xl">
          <Truck className="w-10 h-10 text-neutral-400 mx-auto animate-bounce" />
          <h2 className="text-lg font-serif text-white">No Active Shipments on Board</h2>
          <p className="text-xs text-neutral-400 max-w-md mx-auto font-sans">
            Click the button below to load 6 realistic test shipments across all dispatch stages (Dallas to Houston, LA to Chicago, etc.).
          </p>
          <button
            onClick={fetchBoard}
            className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black text-xs font-sans font-bold rounded-xl shadow inline-flex items-center gap-2 transition"
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
              className="min-w-[290px] max-w-[290px] bg-[#09090b] border border-[#27272a] rounded-2xl flex flex-col max-h-[calc(100vh-180px)] shadow-lg"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-[#27272a] flex justify-between items-center bg-[#0c0c0e] rounded-t-2xl">
                <div>
                  <h3 className="font-sans font-semibold text-white text-xs uppercase tracking-wider">
                    {colData?.label || colKey}
                  </h3>
                  <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    {((colData?.totalWeightLbs || 0) / 1000).toFixed(1)}k lbs
                  </div>
                </div>
                <span className="bg-neutral-900 text-neutral-300 border border-neutral-700 px-2 py-0.5 rounded-full text-xs font-mono font-bold">
                  {cards.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
                {cards.map((card) => (
                  <div
                    key={card.shipmentId}
                    className="bg-[#121215] border border-neutral-800 hover:border-neutral-600 rounded-xl p-3 space-y-2 shadow-sm transition"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-bold text-white bg-[#09090b] px-2 py-0.5 rounded border border-neutral-800">
                        {card.referenceNumber}
                      </span>
                      {card.isVolumeLtl && (
                        <span className="bg-neutral-900 text-neutral-300 border border-neutral-700 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
                          VOL-LTL
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-sans font-medium text-neutral-200 flex items-center gap-1.5">
                      <span>{card.originCity}, {card.originState}</span>
                      <ArrowRight className="w-3 h-3 text-neutral-500" />
                      <span>{card.destCity}, {card.destState}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-neutral-400 font-mono pt-1 border-t border-neutral-800/80">
                      <span>{card.totalPallets} Plts ({card.totalWeightLbs.toLocaleString()}#)</span>
                      <span>Ready: {card.pickupDateReady}</span>
                    </div>

                    {/* Action Bar with direct eBOL download */}
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-xs font-sans">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/api/v1/shipments/${card.shipmentId}/ebol?format=pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded text-[10px] font-mono border border-neutral-800 flex items-center gap-1 transition"
                          title="Download official VICS eBOL PDF"
                        >
                          <FileText className="w-3 h-3 text-neutral-400" />
                          eBOL PDF
                        </a>
                      </div>

                      {colKey !== 'SETTLED' && (
                        <button
                          onClick={() => handleAdvanceStatus(card.shipmentId, colKey)}
                          disabled={updatingId === card.shipmentId}
                          className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black rounded text-[10px] font-sans font-bold transition flex items-center gap-1"
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
                  <div className="text-center py-8 text-neutral-600 text-xs italic font-sans">
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
