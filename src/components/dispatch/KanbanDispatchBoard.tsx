'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Truck,
  ArrowRight,
  RefreshCw,
  Search,
  FileText,
  ChevronRight,
  KanbanSquare,
  Radio,
  Send,
  X,
  Phone,
  MapPin,
  Plus,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { KanbanBoardState } from '../../lib/dispatch/dispatch-board-engine';
import { DISPATCH_BOARD_COLUMNS, DispatchBoardColumn } from '../../db/schema';

interface TruckRecord {
  id: string;
  unit_number: string;
  equipment_type: string;
  max_weight_lbs: number;
  max_pallets: number;
  has_liftgate: boolean;
  status: string;
  current_city: string | null;
  current_state: string | null;
  assigned_driver_name: string | null;
  assigned_driver_phone: string | null;
}

function KanbanDispatchBoardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeView, setActiveView] = useState<'kanban' | 'tender' | 'milestones'>('kanban');
  const [boardState, setBoardState] = useState<KanbanBoardState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fleet Equipment Drawer State
  const [isFleetDrawerOpen, setIsFleetDrawerOpen] = useState(false);
  const [availableTrucks, setAvailableTrucks] = useState<TruckRecord[]>([]);
  const [selectedTruckUnits, setSelectedTruckUnits] = useState<Record<string, string>>({});
  const [isAddingTruck, setIsAddingTruck] = useState(false);
  const [newTruckNumber, setNewTruckNumber] = useState('');
  const [newTruckDriver, setNewTruckDriver] = useState('');
  const [newTruckType, setNewTruckType] = useState('DRY_VAN_53');

  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'tender') setActiveView('tender');
    else if (v === 'milestones') setActiveView('milestones');
    else setActiveView('kanban');

    const drawer = searchParams.get('drawer');
    if (drawer === 'fleet') {
      setIsFleetDrawerOpen(true);
    }
  }, [searchParams]);

  const handleViewChange = (v: 'kanban' | 'tender' | 'milestones') => {
    setActiveView(v);
    const drawerParam = isFleetDrawerOpen ? '&drawer=fleet' : '';
    const url = v === 'kanban' ? `/dispatch${isFleetDrawerOpen ? '?drawer=fleet' : ''}` : `/dispatch?view=${v}${drawerParam}`;
    window.history.pushState(null, '', url);
  };

  const toggleFleetDrawer = () => {
    const nextState = !isFleetDrawerOpen;
    setIsFleetDrawerOpen(nextState);
    const viewParam = activeView !== 'kanban' ? `view=${activeView}&` : '';
    const url = nextState ? `/dispatch?${viewParam}drawer=fleet` : `/dispatch${activeView !== 'kanban' ? `?view=${activeView}` : ''}`;
    window.history.pushState(null, '', url);
  };

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

  const fetchAvailableTrucks = async () => {
    try {
      const res = await fetch('/api/v1/fleet/trucks');
      const data = await res.json();
      if (data.success && Array.isArray(data.trucks)) {
        setAvailableTrucks(data.trucks);
      }
    } catch (err) {
      console.error('Failed to fetch fleet trucks:', err);
    }
  };

  useEffect(() => {
    fetchBoard();
    fetchAvailableTrucks();
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
          truckUnit: selectedTruckUnits[shipmentId] || null,
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

  const handleQuickAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTruckNumber.trim()) return;

    try {
      const res = await fetch('/api/v1/fleet/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: newTruckNumber.trim(),
          equipment_type: newTruckType,
          assigned_driver_name: newTruckDriver.trim() || 'Marcus Vance',
          status: 'AVAILABLE',
          current_city: 'Chicago',
          current_state: 'IL',
          max_weight_lbs: 45000,
          max_pallets: 26,
          has_liftgate: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewTruckNumber('');
        setNewTruckDriver('');
        setIsAddingTruck(false);
        await fetchAvailableTrucks();
      }
    } catch (err) {
      console.error('Failed to create truck unit:', err);
    }
  };

  const columnsList = DISPATCH_BOARD_COLUMNS;

  return (
    <div className="space-y-5 font-sans relative text-white">
      {/* Board Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#09090b] border border-[#27272a] p-4 md:p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-neutral-900 text-neutral-300 text-[10px] px-2.5 py-0.5 rounded font-mono font-medium border border-neutral-800 uppercase">
              Real-Time Dispatch Desk
            </span>
            <span className="text-xs text-neutral-400 font-sans">
              <strong className="text-white font-mono">{boardState?.totalActiveShipments || 0}</strong> Active Loads
            </span>
          </div>
          <h1 className="text-2xl font-serif text-white mt-1 flex items-center gap-2">
            <Truck className="w-5 h-5 text-neutral-400" />
            LTL Operations &amp; Capacity Board
          </h1>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-56 min-w-[180px]">
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
            onClick={toggleFleetDrawer}
            className={`px-3.5 py-1.5 text-xs font-sans font-medium rounded-lg border flex items-center gap-1.5 transition ${
              isFleetDrawerOpen
                ? 'bg-white text-black border-white font-bold shadow-md'
                : 'bg-[#121215] hover:bg-neutral-800 text-white border-neutral-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Available Fleet Trucks &amp; Drivers</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-200 text-[10px] font-mono">
              {availableTrucks.filter((t) => t.status === 'AVAILABLE').length}
            </span>
          </button>

          <button
            onClick={fetchBoard}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[#121215] hover:bg-neutral-800 text-neutral-200 text-xs font-sans font-medium rounded-lg border border-neutral-800 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      </div>

      {/* Sub-Feature View Tabs */}
      <div className="flex border-b border-[#27272a] gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'kanban', label: `10-Stage Kanban Board (${boardState?.totalActiveShipments || 0})`, icon: KanbanSquare },
          { id: 'tender', label: 'Carrier Tender Desk (EDI 204/990)', icon: Send },
          { id: 'milestones', label: 'Milestone Tracking & EDI 214', icon: Radio },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleViewChange(tab.id as any)}
              className={`px-3.5 py-2 text-xs font-sans font-medium rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-white text-white bg-[#121215] font-semibold'
                  : 'border-transparent text-neutral-400 hover:text-white hover:bg-[#0c0c0e]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TOGGLEABLE FLEET TRUCKS & DRIVERS DRAWER */}
      {isFleetDrawerOpen && (
        <div className="bg-[#09090b] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-white" />
              <h3 className="font-serif text-base text-white">Available Fleet Trucks &amp; Driver Roster</h3>
              <span className="text-xs font-mono text-neutral-400">
                ({availableTrucks.filter((t) => t.status === 'AVAILABLE').length} Ready for Load Assignment)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingTruck(!isAddingTruck)}
                className="px-3 py-1 bg-white hover:bg-neutral-200 text-black rounded-lg text-xs font-sans font-bold transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Quick Add Unit</span>
              </button>

              <button
                onClick={toggleFleetDrawer}
                className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition"
                title="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Add Truck Form */}
          {isAddingTruck && (
            <form onSubmit={handleQuickAddTruck} className="p-4 rounded-xl bg-[#121215] border border-neutral-800 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Unit #</label>
                <input
                  type="text"
                  required
                  value={newTruckNumber}
                  onChange={(e) => setNewTruckNumber(e.target.value)}
                  placeholder="e.g. TRK-105"
                  className="w-full bg-[#050507] border border-neutral-800 rounded-lg p-1.5 font-mono text-white focus:outline-none"
                />
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Driver Name</label>
                <input
                  type="text"
                  value={newTruckDriver}
                  onChange={(e) => setNewTruckDriver(e.target.value)}
                  placeholder="Driver name..."
                  className="w-full bg-[#050507] border border-neutral-800 rounded-lg p-1.5 font-sans text-white focus:outline-none"
                />
              </div>

              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Equipment</label>
                <select
                  value={newTruckType}
                  onChange={(e) => setNewTruckType(e.target.value)}
                  className="w-full bg-[#050507] border border-neutral-800 rounded-lg p-1.5 font-sans text-white focus:outline-none"
                >
                  <option value="DRY_VAN_53">53&apos; Dry Van</option>
                  <option value="REEFER_53">53&apos; Reefer</option>
                  <option value="FLATBED_48">48&apos; Flatbed</option>
                  <option value="BOX_TRUCK_26">26&apos; Box Truck</option>
                </select>
              </div>

              <div className="flex items-end gap-2 pt-4">
                <button type="submit" className="px-3 py-1.5 bg-white text-black font-bold rounded-lg hover:bg-neutral-200 transition">
                  Save Unit
                </button>
                <button type="button" onClick={() => setIsAddingTruck(false)} className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded-lg hover:text-white transition">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Roster Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {availableTrucks.map((trk) => (
              <div key={trk.id} className="bg-[#121215] border border-neutral-800 rounded-xl p-3 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{trk.unit_number}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${trk.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400'}`}>
                    {trk.status}
                  </span>
                </div>
                <div className="text-neutral-300 font-sans font-medium">{trk.assigned_driver_name || 'Marcus Vance'}</div>
                <div className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
                  <MapPin className="w-3 h-3 text-neutral-500" />
                  <span>{trk.current_city || 'Chicago'}, {trk.current_state || 'IL'}</span>
                </div>
                <div className="text-[10px] text-neutral-500 flex justify-between pt-1 border-t border-neutral-800/80">
                  <span>{trk.equipment_type}</span>
                  <span>{trk.max_weight_lbs ? `${(trk.max_weight_lbs / 1000).toFixed(0)}k#` : '45k#'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: CARRIER TENDER DESK */}
      {activeView === 'tender' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-serif text-base text-white">Electronic Carrier Tender Desk</h3>
              <p className="text-xs text-neutral-400 font-sans">Automated EDI 204 Load Tender generation and EDI 990 carrier response intake.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
            <div className="bg-[#121215] border border-neutral-800 p-4 rounded-xl space-y-2">
              <span className="font-semibold text-white">Active Tender Protocol</span>
              <div className="text-neutral-400 font-mono text-[11px]">ANSI X12 EDI 204 v4010 + Direct REST Webhook</div>
              <div className="flex items-center gap-2 pt-2">
                <span className="w-2 h-2 rounded-full bg-white" />
                <span className="text-neutral-200">5 Carriers Configured for Automated Acceptance</span>
              </div>
            </div>
            <div className="bg-[#121215] border border-neutral-800 p-4 rounded-xl space-y-2">
              <span className="font-semibold text-white">EDI 990 Response Webhook</span>
              <div className="text-neutral-400 font-mono text-[11px]">POST /api/v1/tender/edi990-webhook</div>
              <div className="text-neutral-300">Average carrier response time: <strong className="font-mono text-white">4.2 mins</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: MILESTONE TRACKING */}
      {activeView === 'milestones' && (
        <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-serif text-base text-white">Milestone Tracking &amp; EDI 214 Ingestion</h3>
            <p className="text-xs text-neutral-400 font-sans">Real-time status updates from carrier telemetry nodes, geofenced checkpoints, and EDI 214 status messages.</p>
          </div>
          <div className="bg-[#121215] border border-neutral-800 rounded-xl p-4 font-mono text-xs text-neutral-300 space-y-2">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span>LTL-2026-8941 (SAIA)</span>
              <span className="text-white font-bold">OUT_FOR_DELIVERY (99.8% On-Time)</span>
            </div>
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span>LTL-2026-8942 (XPO)</span>
              <span className="text-white font-bold">IN_TRANSIT (Chicago Terminal Node)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>LTL-2026-8945 (Estes)</span>
              <span className="text-white font-bold">DISPATCHED (Driver Assigned)</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1 / DEFAULT: 10-STAGE KANBAN BOARD */}
      {activeView === 'kanban' && (
        <>
          {/* Empty State Banner if no cards */}
          {(!boardState || boardState.totalActiveShipments === 0) && !isLoading && (
            <div className="bg-[#09090b] border border-neutral-800 rounded-2xl p-6 text-center space-y-3 shadow-xl">
              <Truck className="w-10 h-10 text-neutral-400 mx-auto animate-bounce" />
              <h2 className="text-lg font-serif text-white">No Active Shipments on Board</h2>
              <p className="text-xs text-neutral-400 max-w-md mx-auto font-sans">
                Click the button below to load realistic test shipments across all dispatch stages.
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

                        {/* Inline Available Truck Unit Selection Dropdown */}
                        <div className="pt-2 border-t border-neutral-800/80 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                            <span>Dispatch Truck Unit:</span>
                            {selectedTruckUnits[card.shipmentId] && (
                              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> #{selectedTruckUnits[card.shipmentId]}
                              </span>
                            )}
                          </div>
                          <select
                            value={selectedTruckUnits[card.shipmentId] || ''}
                            onChange={(e) =>
                              setSelectedTruckUnits((prev) => ({
                                ...prev,
                                [card.shipmentId]: e.target.value,
                              }))
                            }
                            className="w-full bg-[#050507] border border-neutral-800 rounded-lg py-1.5 px-2 text-[10px] font-mono text-white focus:outline-none focus:border-white"
                          >
                            <option value="">Select Truck (TRK-101, REF-204...)</option>
                            <option value="TRK-101">TRK-101 (53&apos; Dry Van) — Marcus Vance</option>
                            <option value="REF-204">REF-204 (53&apos; Reefer) — Elena Rostova</option>
                            <option value="BOX-308">BOX-308 (26&apos; Box Truck) — David Miller</option>
                            <option value="FLT-402">FLT-402 (48&apos; Flatbed) — Robert Hayes</option>
                            {availableTrucks.map((trk) => (
                              <option key={trk.id} value={trk.unit_number}>
                                {trk.unit_number} ({trk.equipment_type}) — {trk.assigned_driver_name || 'Driver'}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Action Bar */}
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-xs font-sans">
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
        </>
      )}
    </div>
  );
}

export const KanbanDispatchBoard: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 font-mono text-xs">Loading Dispatch Desk...</div>}>
      <KanbanDispatchBoardContent />
    </Suspense>
  );
};
