'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Truck,
  Plus,
  Upload,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  X,
  Phone,
  MapPin,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface TruckRecord {
  id: string;
  tenant_id: string;
  carrier_account_id: string | null;
  unit_number: string;
  equipment_type: 'DRY_VAN_53' | 'REEFER_53' | 'FLATBED_48' | 'BOX_TRUCK_26' | 'POWER_ONLY';
  max_weight_lbs: number;
  max_pallets: number;
  has_liftgate: boolean;
  status: 'AVAILABLE' | 'ASSIGNED' | 'IN_TRANSIT' | 'OUT_OF_SERVICE';
  current_location_zip: string | null;
  current_city: string | null;
  current_state: string | null;
  assigned_driver_name: string | null;
  assigned_driver_phone: string | null;
  account?: {
    id: string;
    name: string;
    mc_number: string;
  } | null;
  created_at?: string;
}

function FleetPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [trucks, setTrucks] = useState<TruckRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'DISPATCHED' | 'OUT_OF_SERVICE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State for Add Truck Unit
  const [formData, setFormData] = useState({
    unit_number: '',
    equipment_type: 'DRY_VAN_53',
    max_weight_lbs: '45000',
    max_pallets: '26',
    has_liftgate: false,
    status: 'AVAILABLE',
    current_city: 'Chicago',
    current_state: 'IL',
    current_location_zip: '60601',
    assigned_driver_name: '',
    assigned_driver_phone: '',
  });

  const fetchTrucks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/fleet/trucks');
      const data = await res.json();
      if (data.success && Array.isArray(data.trucks)) {
        setTrucks(data.trucks);
      }
    } catch (err) {
      console.error('Failed to fetch fleet trucks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrucks();

    const action = searchParams.get('action');
    if (action === 'add') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const handleSeedPracticeFleet = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/v1/fleet/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchTrucks();
      }
    } catch (err) {
      console.error('Failed to seed fleet:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCreateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit_number.trim()) {
      setErrorMessage('Unit number is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/fleet/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to add truck unit.');
      } else {
        setIsModalOpen(false);
        setFormData({
          unit_number: '',
          equipment_type: 'DRY_VAN_53',
          max_weight_lbs: '45000',
          max_pallets: '26',
          has_liftgate: false,
          status: 'AVAILABLE',
          current_city: 'Chicago',
          current_state: 'IL',
          current_location_zip: '60601',
          assigned_driver_name: '',
          assigned_driver_phone: '',
        });
        await fetchTrucks();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unexpected network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // KPI Calculations
  const totalTrucks = trucks.length;
  const availableUnits = trucks.filter((t) => t.status === 'AVAILABLE').length;
  const dispatchedUnits = trucks.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_TRANSIT').length;
  const outOfService = trucks.filter((t) => t.status === 'OUT_OF_SERVICE').length;
  const liftgateEquipped = trucks.filter((t) => t.has_liftgate).length;

  // Filtered List
  const filteredTrucks = trucks.filter((trk) => {
    // Status Filter
    if (statusFilter === 'AVAILABLE' && trk.status !== 'AVAILABLE') return false;
    if (statusFilter === 'DISPATCHED' && trk.status !== 'ASSIGNED' && trk.status !== 'IN_TRANSIT') return false;
    if (statusFilter === 'OUT_OF_SERVICE' && trk.status !== 'OUT_OF_SERVICE') return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const unitMatch = trk.unit_number.toLowerCase().includes(q);
      const driverMatch = (trk.assigned_driver_name || '').toLowerCase().includes(q);
      const carrierMatch = (trk.account?.name || '').toLowerCase().includes(q);
      const cityMatch = (trk.current_city || '').toLowerCase().includes(q);
      const stateMatch = (trk.current_state || '').toLowerCase().includes(q);
      const zipMatch = (trk.current_location_zip || '').toLowerCase().includes(q);
      return unitMatch || driverMatch || carrierMatch || cityMatch || stateMatch || zipMatch;
    }
    return true;
  });

  const renderEquipmentBadge = (type: string) => {
    switch (type) {
      case 'DRY_VAN_53':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-200 border border-neutral-700 text-xs font-mono">
            53&apos; Dry Van
          </span>
        );
      case 'REEFER_53':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/80 text-xs font-mono">
            53&apos; Reefer
          </span>
        );
      case 'FLATBED_48':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/80 text-xs font-mono">
            48&apos; Flatbed
          </span>
        );
      case 'BOX_TRUCK_26':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700/80 text-xs font-mono">
            26&apos; Box Truck
          </span>
        );
      case 'POWER_ONLY':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 text-xs font-mono">
            Power Only
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800 text-xs font-mono">
            {type}
          </span>
        );
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AVAILABLE
          </span>
        );
      case 'ASSIGNED':
      case 'IN_TRANSIT':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-mono font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {status}
          </span>
        );
      case 'OUT_OF_SERVICE':
        return (
          <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-mono font-semibold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            OUT OF SERVICE
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800 text-xs font-mono">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Top Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-[#09090b] border border-[#27272a] p-6 sm:p-8 lg:p-10 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700/80 text-neutral-300 text-[11px] font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                DEDICATED CARRIER &amp; FLEET PORTAL
              </span>
              <span className="text-xs font-mono text-neutral-500">REAL-TIME SUPABASE EQUIPMENT ROSTER</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white tracking-tight font-normal">
              Carrier Fleet &amp; Equipment Management
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 font-sans leading-relaxed">
              Manage truck equipment units, driver capacity, equipment types, liftgate capabilities, and real-time dispatch availability across dedicated carrier fleets.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-black" />
              <span>Add Truck Unit</span>
            </button>
            <Link
              href="/integration?step=3"
              className="px-5 py-3 rounded-xl bg-[#121215] hover:bg-neutral-800 text-white font-sans font-medium text-xs border border-neutral-800 transition flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 text-neutral-300" />
              <span>Import Fleet CSV</span>
            </Link>
          </div>
        </div>

        {/* Top Executive KPI Bar */}
        <div id="fleet-kpis" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-8 pt-6 border-t border-[#27272a]/80">
          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-4 space-y-1 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-neutral-300" />
              <span>Total Fleet Units</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              {totalTrucks}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">Registered Equipment</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-4 space-y-1 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Available Units</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400 tracking-tight">
              {availableUnits}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">Ready for Dispatch</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-4 space-y-1 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Dispatched Units</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-blue-400 tracking-tight">
              {dispatchedUnits}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">Assigned / In Transit</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-4 space-y-1 shadow-md">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Out of Service</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-red-400 tracking-tight">
              {outOfService}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">Maintenance / Offline</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-2xl p-4 space-y-1 shadow-md col-span-2 sm:col-span-1">
            <div className="text-xs text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span>Liftgate Equipped</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
              {liftgateEquipped}
            </div>
            <div className="text-[10px] font-mono text-neutral-500">Liftgate Accessorial Ready</div>
          </div>
        </div>
      </section>

      {/* Action Bar & Search / Filter controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#09090b] border border-neutral-800 p-4 rounded-2xl shadow-xl">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          {(
            [
              { id: 'ALL', label: `All Units (${totalTrucks})` },
              { id: 'AVAILABLE', label: `Available (${availableUnits})` },
              { id: 'DISPATCHED', label: `Assigned / In-Transit (${dispatchedUnits})` },
              { id: 'OUT_OF_SERVICE', label: `Out of Service (${outOfService})` },
            ] as const
          ).map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-sans font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-black font-bold shadow-md'
                    : 'bg-[#121215] text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search unit #, driver, city..."
              className="w-full bg-[#121215] border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 font-sans focus:outline-none focus:border-neutral-600"
            />
          </div>

          {totalTrucks === 0 && !isLoading && (
            <button
              onClick={handleSeedPracticeFleet}
              disabled={isSeeding}
              className="px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-sans font-bold rounded-xl shadow flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>{isSeeding ? 'Seeding...' : 'Seed Practice Fleet'}</span>
            </button>
          )}

          <button
            onClick={fetchTrucks}
            disabled={isLoading}
            className="p-2 bg-[#121215] hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-800 transition"
            title="Refresh Fleet List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fleet Roster Table */}
      <div className="bg-[#09090b] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#0c0c0e] text-neutral-400 font-mono text-[10px] uppercase border-b border-neutral-800">
              <tr>
                <th className="p-4">Unit #</th>
                <th className="p-4">Equipment Type</th>
                <th className="p-4">Max Capacity</th>
                <th className="p-4">Liftgate</th>
                <th className="p-4">Carrier Account</th>
                <th className="p-4">Driver Name &amp; Phone</th>
                <th className="p-4">Location (Zip / City / State)</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-neutral-300 font-sans">
              {filteredTrucks.map((trk) => (
                <tr key={trk.id} className="hover:bg-[#121215]/80 transition">
                  {/* Unit # */}
                  <td className="p-4 font-mono font-bold text-white text-sm">
                    {trk.unit_number}
                  </td>

                  {/* Equipment Type */}
                  <td className="p-4">{renderEquipmentBadge(trk.equipment_type)}</td>

                  {/* Capacity */}
                  <td className="p-4 font-mono text-neutral-300">
                    <div>
                      <strong className="text-white font-bold">{trk.max_weight_lbs.toLocaleString()}</strong> lbs
                    </div>
                    <div className="text-[11px] text-neutral-500">{trk.max_pallets} Max Pallets</div>
                  </td>

                  {/* Liftgate */}
                  <td className="p-4 font-mono">
                    {trk.has_liftgate ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">
                        LIFTGATE
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500">No Liftgate</span>
                    )}
                  </td>

                  {/* Carrier Account */}
                  <td className="p-4 font-sans">
                    <div className="font-bold text-white">{trk.account?.name || 'Apex Dedicated Fleet'}</div>
                    <div className="text-[10px] font-mono text-neutral-500">{trk.account?.mc_number || 'MC-987654'}</div>
                  </td>

                  {/* Driver */}
                  <td className="p-4 font-sans">
                    <div className="font-bold text-white">{trk.assigned_driver_name || 'Unassigned Driver'}</div>
                    {trk.assigned_driver_phone && (
                      <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-neutral-500" />
                        <span>{trk.assigned_driver_phone}</span>
                      </div>
                    )}
                  </td>

                  {/* Location */}
                  <td className="p-4 font-mono">
                    <div className="text-white font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-neutral-400" />
                      <span>
                        {trk.current_city || 'Chicago'}, {trk.current_state || 'IL'}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 pl-4">{trk.current_location_zip || '60601'}</div>
                  </td>

                  {/* Status */}
                  <td className="p-4">{renderStatusBadge(trk.status)}</td>
                </tr>
              ))}

              {filteredTrucks.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="p-12 text-center space-y-3">
                    <Truck className="w-10 h-10 text-neutral-600 mx-auto" />
                    <div className="text-sm font-bold text-white font-sans">No Fleet Truck Units Found</div>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto">
                      Click &quot;Add Truck Unit&quot; or &quot;Import Fleet CSV&quot; above to register active trucks into your Supabase database.
                    </p>
                    <button
                      onClick={handleSeedPracticeFleet}
                      disabled={isSeeding}
                      className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-sans font-bold rounded-xl shadow inline-flex items-center gap-1.5 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>{isSeeding ? 'Seeding Fleet...' : 'Seed Practice Fleet Now'}</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Truck Unit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-[#121215] text-neutral-400 hover:text-white border border-neutral-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] font-mono">
                <Truck className="w-3 h-3 text-white" />
                <span>Supabase Fleet Equipment Registry</span>
              </div>
              <h2 className="text-2xl font-serif text-white font-normal">Add Carrier Truck Unit</h2>
            </div>

            <form onSubmit={handleCreateTruck} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Unit Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.unit_number}
                    onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                    placeholder="e.g. TRK-105"
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Equipment Type</label>
                  <select
                    value={formData.equipment_type}
                    onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value as any })}
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-sans text-white focus:outline-none focus:border-white"
                  >
                    <option value="DRY_VAN_53">53&apos; Dry Van</option>
                    <option value="REEFER_53">53&apos; Reefer</option>
                    <option value="FLATBED_48">48&apos; Flatbed</option>
                    <option value="BOX_TRUCK_26">26&apos; Box Truck</option>
                    <option value="POWER_ONLY">Power Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Max Weight (Lbs)</label>
                  <input
                    type="number"
                    value={formData.max_weight_lbs}
                    onChange={(e) => setFormData({ ...formData, max_weight_lbs: e.target.value })}
                    placeholder="45000"
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Max Pallet Capacity</label>
                  <input
                    type="number"
                    value={formData.max_pallets}
                    onChange={(e) => setFormData({ ...formData, max_pallets: e.target.value })}
                    placeholder="26"
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Assigned Driver Name</label>
                  <input
                    type="text"
                    value={formData.assigned_driver_name}
                    onChange={(e) => setFormData({ ...formData, assigned_driver_name: e.target.value })}
                    placeholder="e.g. Marcus Vance"
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-sans text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Driver Phone Number</label>
                  <input
                    type="text"
                    value={formData.assigned_driver_phone}
                    onChange={(e) => setFormData({ ...formData, assigned_driver_phone: e.target.value })}
                    placeholder="e.g. (312) 555-0144"
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Current City</label>
                  <input
                    type="text"
                    value={formData.current_city}
                    onChange={(e) => setFormData({ ...formData, current_city: e.target.value })}
                    placeholder="Chicago"
                    className="w-full bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-sans text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Current State &amp; Zip</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.current_state}
                      onChange={(e) => setFormData({ ...formData, current_state: e.target.value.toUpperCase() })}
                      placeholder="IL"
                      className="w-16 bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-white uppercase"
                    />
                    <input
                      type="text"
                      value={formData.current_location_zip}
                      onChange={(e) => setFormData({ ...formData, current_location_zip: e.target.value })}
                      placeholder="60601"
                      className="flex-1 bg-[#050507] border border-neutral-800 rounded-xl py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-neutral-300">
                  <input
                    type="checkbox"
                    checked={formData.has_liftgate}
                    onChange={(e) => setFormData({ ...formData, has_liftgate: e.target.checked })}
                    className="accent-white rounded"
                  />
                  <span>Equipment has Hydraulic Liftgate</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Initial Status:</span>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="bg-[#050507] border border-neutral-800 rounded-xl py-1 px-2.5 text-xs font-mono text-white"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="IN_TRANSIT">IN_TRANSIT</option>
                    <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                  </select>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-sans">
                  {errorMessage}
                </div>
              )}

              <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#121215] text-neutral-300 hover:text-white border border-neutral-800 text-xs font-sans font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                      <span>Saving to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 text-black" />
                      <span>Save Truck Unit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FleetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 font-mono text-xs">Loading Carrier Fleet Portal...</div>}>
      <FleetPageContent />
    </Suspense>
  );
}
