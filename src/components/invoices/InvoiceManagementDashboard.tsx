'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  Building2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin,
  Lock,
  Database,
  Layers,
  Award,
  Users,
  BarChart3,
  Calendar,
  Download,
  Check,
  AlertCircle,
  Copy,
  FolderLock,
  ArrowUpRight,
  HelpCircle,
  Scale,
  ShieldAlert,
  PlusCircle,
  Percent,
} from 'lucide-react';
import { Phase5DisputeWorkspace } from './Phase5DisputeWorkspace';

export const InvoiceManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'invoices'
    | 'rebill'
    | 'disputes'
    | 'claims_lifecycle'
    | 'supplemental'
    | 'recovery_billing'
    | 'scorecards'
    | 'pods'
    | 'exceptions'
    | 'accounting'
    | 'aging'
    | 'commissions'
    | 'worm'
  >('overview');

  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedPod, setSelectedPod] = useState<any | null>(null);
  const [selectedWormPackage, setSelectedWormPackage] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncingQbo, setIsSyncingQbo] = useState<string | null>(null);
  const [isDunningRunning, setIsDunningRunning] = useState(false);
  const [isSealingWorm, setIsSealingWorm] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // 1. Mock Invoices
  const [invoices, setInvoices] = useState<any[]>([
    {
      id: 'inv-01916362-0001',
      invoiceNumber: 'INV-2026-08842',
      customerPoNumber: 'PO-77492-AC',
      shipmentRef: 'LTL-2026-8941',
      shipperName: 'Acme Thermal Systems Inc',
      shipperEmail: 'ap@acmethermal.com',
      origin: 'Los Angeles, CA',
      destination: 'Chicago, IL',
      linehaulAmount: 580.0,
      fuelSurcharge: 138.5,
      accessorials: 75.0,
      totalAmount: 793.5,
      carrierCost: 615.0,
      grossProfit: 178.5,
      grossMarginPct: 22.5,
      invoiceDate: '2026-09-01',
      dueDate: '2026-10-01',
      paymentTermsDays: 30,
      status: 'ISSUED',
      qboSynced: true,
      qboDocNumber: 'QBO-9921',
      podVerified: true,
      podGeofenceDistance: '0.12 mi',
      emailSent: true,
      wormSealed: true,
    },
    {
      id: 'inv-01916362-0002',
      invoiceNumber: 'INV-2026-08843',
      customerPoNumber: 'PO-91024-DF',
      shipmentRef: 'LTL-2026-8942',
      shipperName: 'Delta Precision Machinery',
      shipperEmail: 'accounting@deltamachinery.com',
      origin: 'Dallas, TX',
      destination: 'Atlanta, GA',
      linehaulAmount: 720.0,
      fuelSurcharge: 165.6,
      accessorials: 150.0,
      totalAmount: 1035.6,
      carrierCost: 840.0,
      grossProfit: 195.6,
      grossMarginPct: 18.9,
      invoiceDate: '2026-08-31',
      dueDate: '2026-09-30',
      paymentTermsDays: 30,
      status: 'PAID',
      qboSynced: true,
      qboDocNumber: 'QBO-9922',
      podVerified: true,
      podGeofenceDistance: '0.08 mi',
      emailSent: true,
      wormSealed: true,
    },
    {
      id: 'inv-01916362-0003',
      invoiceNumber: 'INV-2026-08844',
      customerPoNumber: 'PO-33821-BL',
      shipmentRef: 'LTL-2026-8943',
      shipperName: 'BlueLine Consumer Goods',
      shipperEmail: 'invoicing@bluelinegoods.com',
      origin: 'Seattle, WA',
      destination: 'Denver, CO',
      linehaulAmount: 890.0,
      fuelSurcharge: 195.8,
      accessorials: 0.0,
      totalAmount: 1085.8,
      carrierCost: 910.0,
      grossProfit: 175.8,
      grossMarginPct: 16.2,
      invoiceDate: '2026-08-15',
      dueDate: '2026-09-14',
      paymentTermsDays: 30,
      status: 'ISSUED',
      qboSynced: true,
      qboDocNumber: 'QBO-9923',
      podVerified: true,
      podGeofenceDistance: '0.24 mi',
      emailSent: true,
      wormSealed: true,
    },
    {
      id: 'inv-01916362-0004',
      invoiceNumber: 'INV-2026-08845',
      customerPoNumber: 'PO-88120-TX',
      shipmentRef: 'LTL-2026-8945',
      shipperName: 'Titan Heavy Industries',
      shipperEmail: 'payables@titanheavy.com',
      origin: 'Houston, TX',
      destination: 'Phoenix, AZ',
      linehaulAmount: 1240.0,
      fuelSurcharge: 235.0,
      accessorials: 120.0,
      totalAmount: 1595.0,
      carrierCost: 1310.0,
      grossProfit: 285.0,
      grossMarginPct: 17.87,
      invoiceDate: '2026-07-20',
      dueDate: '2026-08-19',
      paymentTermsDays: 30,
      status: 'OVERDUE',
      qboSynced: true,
      qboDocNumber: 'QBO-9918',
      podVerified: true,
      podGeofenceDistance: '0.14 mi',
      emailSent: true,
      wormSealed: false,
    },
  ]);

  // 2. Mock POD Feed
  const [podRecords, setPodRecords] = useState<any[]>([
    {
      id: 'pod-001',
      shipmentRef: 'LTL-2026-8941',
      consigneeName: 'John Miller, Receiving Lead',
      receivedPieces: 4,
      expectedPieces: 4,
      geofenceDistance: '0.12 mi',
      isWithinGeofence: true,
      signatureDetected: true,
      stampedDate: '2026-09-01',
      status: 'VERIFIED',
      confidenceScore: 98.2,
      damageFlagged: false,
      gpsLat: 41.8781,
      gpsLng: -87.6298,
      device: 'Zebra TC57 Handheld',
      submittedAt: 'Just now',
    },
    {
      id: 'pod-002',
      shipmentRef: 'LTL-2026-8945',
      consigneeName: 'Marcus Vance, Dock Supervisor',
      receivedPieces: 3,
      expectedPieces: 4,
      geofenceDistance: '0.19 mi',
      isWithinGeofence: true,
      signatureDetected: true,
      stampedDate: '2026-09-01',
      status: 'FLAGGED_EXCEPTION',
      confidenceScore: 94.0,
      damageFlagged: true,
      damageKeywords: ['Shortage 1 Pallet', 'Carton Crushed'],
      gpsLat: 33.4484,
      gpsLng: -112.074,
      device: 'Honeywell CT40 Android',
      submittedAt: '12 mins ago',
    },
    {
      id: 'pod-003',
      shipmentRef: 'LTL-2026-8942',
      consigneeName: 'Sarah Jenkins, Dock Clerk',
      receivedPieces: 2,
      expectedPieces: 2,
      geofenceDistance: '0.08 mi',
      isWithinGeofence: true,
      signatureDetected: true,
      stampedDate: '2026-08-31',
      status: 'VERIFIED',
      confidenceScore: 99.1,
      damageFlagged: false,
      gpsLat: 33.749,
      gpsLng: -84.388,
      device: 'Zebra TC52 Scanner',
      submittedAt: 'Yesterday',
    },
  ]);

  // 3. Mock Damage Claims
  const [exceptions, setExceptions] = useState<any[]>([
    {
      id: 'exc-001',
      shipmentRef: 'LTL-2026-8945',
      carrierName: 'Estes Express Lines',
      severity: 'HIGH',
      keywords: ['1 Pallet Short', 'Crushed Box #3'],
      piecesShort: 1,
      claimEstimate: 1450.0,
      notationSnippet: '"Received 3 of 4 pallets only. Pallet #2 top cartons crushed and torn. Signed subject to inspection."',
      status: 'INVESTIGATING',
      reportedAt: '12 mins ago',
    },
  ]);

  // 4. Mock Accounting Sync Logs
  const [syncLogs, setSyncLogs] = useState<any[]>([
    {
      id: 'sync-001',
      platform: 'QUICKBOOKS_ONLINE',
      syncType: 'AR_INVOICE',
      referenceNumber: 'INV-2026-08842',
      amount: '$793.50',
      externalPlatformId: 'QBO-DOC-9841',
      status: 'SUCCESS',
      retryCount: 0,
      syncedAt: '2026-09-01 10:45 AM',
    },
    {
      id: 'sync-002',
      platform: 'QUICKBOOKS_ONLINE',
      syncType: 'AP_CARRIER_BILL',
      referenceNumber: 'CARRIER-EXLA-8841',
      amount: '$615.00',
      externalPlatformId: 'QBO-BILL-4412',
      status: 'SUCCESS',
      retryCount: 0,
      syncedAt: '2026-09-01 10:46 AM',
    },
    {
      id: 'sync-003',
      platform: 'QUICKBOOKS_ONLINE',
      syncType: 'AR_INVOICE',
      referenceNumber: 'INV-2026-08845',
      amount: '$1,595.00',
      externalPlatformId: null,
      status: 'PENDING',
      retryCount: 1,
      syncedAt: 'Pending Dispatch',
    },
  ]);

  // 5. Mock Sales Reps & Commissions
  const [salesReps, setSalesReps] = useState<any[]>([
    {
      id: 'rep-001',
      name: 'Alex Mercer (Senior Freight Broker)',
      email: 'alex.mercer@apexlogistics.com',
      monthlyQuota: 10000.0,
      totalInvoiced: 48500.0,
      carrierCost: 39200.0,
      realizedGp: 9300.0,
      marginPct: 19.18,
      appliedCommPct: 12.5,
      commissionEarned: 1162.5,
      status: 'ACCRUED',
    },
    {
      id: 'rep-002',
      name: 'Elena Rostova (Enterprise Account Exec)',
      email: 'elena.rostova@apexlogistics.com',
      monthlyQuota: 15000.0,
      totalInvoiced: 72400.0,
      carrierCost: 58800.0,
      realizedGp: 13600.0,
      marginPct: 18.78,
      appliedCommPct: 15.0,
      commissionEarned: 2040.0,
      status: 'APPROVED',
    },
  ]);

  // 6. Mock S3 WORM Compliance Packages
  const [wormPackages, setWormPackages] = useState<any[]>([
    {
      id: 'worm-001',
      packageReference: 'WORM-PKG-LTL-2026-8941-99201',
      shipmentRef: 'LTL-2026-8941',
      invoiceNumber: 'INV-2026-08842',
      merkleRootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      s3Bucket: 'apex-settlement-worm-vault-us-east-1',
      s3ObjectKey: 'tenants/apex/vault/shipments/8941/settlement-bundle.tar.gz',
      retentionMode: 'COMPLIANCE',
      retainUntilDate: '2033-09-01',
      isLegalHoldActive: false,
      sealedAt: '2026-09-01 10:48:12 UTC',
      bundleManifest: [
        { documentType: 'VICS_DIGITAL_BOL', documentName: 'VICS_EBOL_BOL-LTL-2026-8941.pdf', fileHashSha256: 'a1f89c02d7e4b901a88b77cc22dd44ee9901aa8877bb66cc55dd44ee33ff22aa', sizeBytes: 42100 },
        { documentType: 'GEOTAGGED_POD_EXIF', documentName: 'POD_GEOTAGGED_LTL-2026-8941.pdf', fileHashSha256: 'b2e78d13e8f5c012b99c88dd33ee55ff0012bb9988cc77dd66ee55ff44aa33bb', sizeBytes: 58400 },
        { documentType: 'CARRIER_RATE_CONFIRMATION', documentName: 'RATE_CONFIRMATION_LTL-2026-8941.pdf', fileHashSha256: 'c3d67e24f9a6d123c00d99ee44ff66aa1123cc0099dd88ee77ff66aa55bb44cc', sizeBytes: 31200 },
        { documentType: 'CUSTOMER_FREIGHT_INVOICE', documentName: 'CUSTOMER_INVOICE_INV-2026-08842.pdf', fileHashSha256: 'd4c56f35a0b7e234d11e00ff55aa77bb2234dd1100ee99ff88aa77bb66cc55dd', sizeBytes: 64500 },
        { documentType: 'FMCSA_SAFETY_INSURANCE_CERTIFICATE', documentName: 'FMCSA_INSURANCE_CERT_LTL-2026-8941.pdf', fileHashSha256: 'e5b45a46b1c8f345e22f11aa66bb88cc3345ee2211ff00aa99bb88cc77dd66ee', sizeBytes: 38900 },
      ],
    },
    {
      id: 'worm-002',
      packageReference: 'WORM-PKG-LTL-2026-8942-99202',
      shipmentRef: 'LTL-2026-8942',
      invoiceNumber: 'INV-2026-08843',
      merkleRootHash: 'f4a1d553090d2d250b0c05d90070c03538bf52f5750ca45db506002c8963c966',
      s3Bucket: 'apex-settlement-worm-vault-us-east-1',
      s3ObjectKey: 'tenants/apex/vault/shipments/8942/settlement-bundle.tar.gz',
      retentionMode: 'COMPLIANCE',
      retainUntilDate: '2033-08-31',
      isLegalHoldActive: false,
      sealedAt: '2026-08-31 16:12:05 UTC',
      bundleManifest: [
        { documentType: 'VICS_DIGITAL_BOL', documentName: 'VICS_EBOL_BOL-LTL-2026-8942.pdf', fileHashSha256: '77aa88bb99cc00dd11ee22ff33aa44bb55cc66dd77ee88ff99aa00bb11cc22dd', sizeBytes: 41800 },
        { documentType: 'GEOTAGGED_POD_EXIF', documentName: 'POD_GEOTAGGED_LTL-2026-8942.pdf', fileHashSha256: '88bb99cc00dd11ee22ff33aa44bb55cc66dd77ee88ff99aa00bb11cc22dd33ee', sizeBytes: 56200 },
        { documentType: 'CARRIER_RATE_CONFIRMATION', documentName: 'RATE_CONFIRMATION_LTL-2026-8942.pdf', fileHashSha256: '99cc00dd11ee22ff33aa44bb55cc66dd77ee88ff99aa00bb11cc22dd33ee44ff', sizeBytes: 30900 },
        { documentType: 'CUSTOMER_FREIGHT_INVOICE', documentName: 'CUSTOMER_INVOICE_INV-2026-08843.pdf', fileHashSha256: '00dd11ee22ff33aa44bb55cc66dd77ee88ff99aa00bb11cc22dd33ee44ff55aa', sizeBytes: 63100 },
        { documentType: 'FMCSA_SAFETY_INSURANCE_CERTIFICATE', documentName: 'FMCSA_INSURANCE_CERT_LTL-2026-8942.pdf', fileHashSha256: '11ee22ff33aa44bb55cc66dd77ee88ff99aa00bb11cc22dd33ee44ff55aa66bb', sizeBytes: 39400 },
      ],
    },
  ]);

  // Financial KPI totals
  const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalCarrierCost = invoices.reduce((s, i) => s + (i.carrierCost || 0), 0);
  const realizedGp = totalInvoiced - totalCarrierCost;
  const realizedMarginPct = totalInvoiced > 0 ? (realizedGp / totalInvoiced) * 100 : 0;
  const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE');
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.totalAmount, 0);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Instant Invoicing Simulation
  const handleSimulateInstantInvoice = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newInv = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-0884${invoices.length + 2}`,
        customerPoNumber: `PO-${Math.floor(10000 + Math.random() * 90000)}-AP`,
        shipmentRef: `LTL-2026-${Math.floor(8950 + Math.random() * 50)}`,
        shipperName: 'Vanguard Industrial Logistics',
        shipperEmail: 'billing@vanguardlogistic.com',
        origin: 'Phoenix, AZ',
        destination: 'Houston, TX',
        linehaulAmount: 640.0,
        fuelSurcharge: 145.0,
        accessorials: 75.0,
        totalAmount: 860.0,
        carrierCost: 690.0,
        grossProfit: 170.0,
        grossMarginPct: 19.76,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paymentTermsDays: 30,
        status: 'ISSUED',
        qboSynced: false,
        podVerified: true,
        podGeofenceDistance: '0.15 mi',
        emailSent: true,
        wormSealed: false,
      };

      setInvoices([newInv, ...invoices]);
      setIsGenerating(false);
    }, 600);
  };

  // QBO Sync Trigger
  const handleSyncQbo = (invId: string) => {
    setIsSyncingQbo(invId);
    setTimeout(() => {
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invId
            ? { ...i, qboSynced: true, qboDocNumber: `QBO-${Math.floor(1000 + Math.random() * 9000)}` }
            : i
        )
      );
      setSyncLogs((prev) => [
        {
          id: `sync-${Date.now()}`,
          platform: 'QUICKBOOKS_ONLINE',
          syncType: 'AR_INVOICE',
          referenceNumber: invoices.find((i) => i.id === invId)?.invoiceNumber || 'INV-REF',
          amount: `$${(invoices.find((i) => i.id === invId)?.totalAmount || 0).toFixed(2)}`,
          externalPlatformId: `QBO-DOC-${Math.floor(10000 + Math.random() * 90000)}`,
          status: 'SUCCESS',
          retryCount: 0,
          syncedAt: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setIsSyncingQbo(null);
    }, 800);
  };

  // Dunning Engine Run
  const handleRunDunning = () => {
    setIsDunningRunning(true);
    setTimeout(() => {
      setIsDunningRunning(false);
      alert('Automated Dunning Cadence complete! 3 Reminder & Past Due emails dispatched with direct ACH payment links.');
    }, 1000);
  };

  // Seal Load in WORM Vault
  const handleSealWormArchive = (inv: any) => {
    setIsSealingWorm(true);
    setTimeout(() => {
      const newPackage = {
        id: `worm-${Date.now()}`,
        packageReference: `WORM-PKG-${inv.shipmentRef}-${Math.floor(10000 + Math.random() * 90000)}`,
        shipmentRef: inv.shipmentRef,
        invoiceNumber: inv.invoiceNumber,
        merkleRootHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        s3Bucket: 'apex-settlement-worm-vault-us-east-1',
        s3ObjectKey: `tenants/apex/vault/shipments/${inv.shipmentRef}/settlement-bundle.tar.gz`,
        retentionMode: 'COMPLIANCE',
        retainUntilDate: '2033-09-01',
        isLegalHoldActive: false,
        sealedAt: new Date().toUTCString(),
        bundleManifest: [
          { documentType: 'VICS_DIGITAL_BOL', documentName: `VICS_EBOL_${inv.shipmentRef}.pdf`, fileHashSha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b', sizeBytes: 43200 },
          { documentType: 'GEOTAGGED_POD_EXIF', documentName: `POD_GEOTAGGED_${inv.shipmentRef}.pdf`, fileHashSha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', sizeBytes: 59100 },
          { documentType: 'CARRIER_RATE_CONFIRMATION', documentName: `RATE_CONFIRMATION_${inv.shipmentRef}.pdf`, fileHashSha256: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c', sizeBytes: 32400 },
          { documentType: 'CUSTOMER_FREIGHT_INVOICE', documentName: `CUSTOMER_INVOICE_${inv.invoiceNumber}.pdf`, fileHashSha256: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d', sizeBytes: 65200 },
          { documentType: 'FMCSA_SAFETY_INSURANCE_CERTIFICATE', documentName: `FMCSA_INSURANCE_CERT_${inv.shipmentRef}.pdf`, fileHashSha256: '4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e', sizeBytes: 39800 },
        ],
      };

      setWormPackages([newPackage, ...wormPackages]);
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, wormSealed: true } : i)));
      setIsSealingWorm(false);
    }, 750);
  };

  // Filtered Invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inv.shipperName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inv.customerPoNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inv.shipmentRef.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              PHASE 4.8: SUB-MINUTE DSO SETTLEMENT & S3 WORM COMPLIANCE VAULT
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Broker Invoicing & Settlement Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
              Unified financial operating desk: Sub-60s automated customer billing, verified POD streams, QBO/Xero ledger sync, AR dunning, gross margin commissions, and FMCSA § 379 S3 WORM compliance archiving.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleSimulateInstantInvoice}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating PDF Invoice...' : 'Instant POD Billing (<60s)'}
            </button>
            <button
              onClick={() => setActiveTab('worm')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition"
            >
              <Lock className="w-4 h-4 text-indigo-400" />
              WORM Vault ({wormPackages.length})
            </button>
          </div>
        </div>

        {/* Global Financial KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Total Invoiced
            </div>
            <div className="text-xl font-black text-white mt-1 font-mono">
              ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium mt-0.5">{invoices.length} Loads Active</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-teal-400" /> Realized GP %
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
              {realizedMarginPct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">${realizedGp.toFixed(2)} Gross Profit</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Days Sales Out (DSO)
            </div>
            <div className="text-xl font-black text-white mt-1 font-mono">21.4 Days</div>
            <div className="text-[10px] text-indigo-400 font-medium mt-0.5">-4.2d Target Achieved</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Active AR Overdue
            </div>
            <div className="text-xl font-black text-rose-400 mt-1 font-mono">
              ${overdueTotal.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{overdueInvoices.length} Account Alert</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Geofence Accuracy
            </div>
            <div className="text-xl font-black text-white mt-1 font-mono">100.0%</div>
            <div className="text-[10px] text-sky-300 font-medium mt-0.5">Avg Dist: 0.11 mi</div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> S3 WORM Compliance
            </div>
            <div className="text-xl font-black text-amber-400 mt-1 font-mono">100% Locked</div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">7-Yr FMCSA Lock</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex border-b border-slate-800 gap-1 sm:gap-2 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview & KPIs', icon: BarChart3 },
          { id: 'invoices', label: `Customer Invoices (${invoices.length})`, icon: FileText },
          { id: 'rebill', label: 'Carrier Re-Bill Audit (5.1/5.2)', icon: Scale },
          { id: 'disputes', label: 'Legal Dispute Desk (5.3/5.4)', icon: ShieldAlert },
          { id: 'claims_lifecycle', label: 'Claims Lifecycle & 30d SLA (5.5)', icon: Clock },
          { id: 'supplemental', label: 'Supplemental Invoices (5.6)', icon: PlusCircle },
          { id: 'recovery_billing', label: '20% Contingency Fees (5.7)', icon: Percent },
          { id: 'scorecards', label: 'Carrier Scorecards (5.8)', icon: Award },
          { id: 'pods', label: `Verified PODs (${podRecords.length})`, icon: CheckCircle2 },
          { id: 'exceptions', label: `Damage Claims (${exceptions.length})`, icon: AlertTriangle },
          { id: 'accounting', label: 'Accounting Sync (QBO)', icon: Database },
          { id: 'aging', label: 'AR Aging & Dunning', icon: Calendar },
          { id: 'commissions', label: 'Gross Margin & Sales Reps', icon: Award },
          { id: 'worm', label: `S3 WORM Vault (${wormPackages.length})`, icon: FolderLock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-emerald-400 text-emerald-400 bg-slate-900/90 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* PHASE 5: RE-BILL AUDIT, DISPUTES, CLAIMS, SUPPLEMENTAL, RECOVERY & SCORECARDS */}
      {/* ========================================================================= */}
      {(activeTab === 'rebill' ||
        activeTab === 'disputes' ||
        activeTab === 'claims_lifecycle' ||
        activeTab === 'supplemental' ||
        activeTab === 'recovery_billing' ||
        activeTab === 'scorecards') && (
        <Phase5DisputeWorkspace activeSubTab={activeTab} />
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & DSO KPIS */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cash Acceleration & Sub-Minute Billing Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                  Cash Flow Velocity
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Real-Time
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Sub-Minute Automated Billing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Invoices are generated, validated, cryptographically sealed, and dispatched to shipper Accounts Payable within 60 seconds of clean OCR geofenced delivery receipt capture.
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Average Billing Turnaround:</span>
                  <span className="font-mono font-bold text-emerald-400">42 seconds</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>DSO Reduction:</span>
                  <span className="font-mono font-bold text-indigo-400">21.4 days (vs 45d industry avg)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Floating-Point Rounding Error Rate:</span>
                  <span className="font-mono font-bold text-teal-400">0.00% (Strict Integer Cents)</span>
                </div>
              </div>
            </div>

            {/* Regulatory Compliance & S3 WORM Vault Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-wider">
                  Regulatory Compliance
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  FMCSA & DOT
                </span>
              </div>
              <h3 className="text-lg font-black text-white">FMCSA § 379 & S3 WORM Protection</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Complete 5-document load settlement archives (eBOL, signed POD, Rate Con, Freight Invoice, and $1M Insurance Cert) are sealed with Merkle Root SHA-256 hashes and locked with 7-year AWS S3 Object Lock in COMPLIANCE mode.
              </p>
              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Preservation Requirement:</span>
                  <span className="font-mono font-bold text-white">49 CFR § 379 (3-Year Min)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Statutory DOT Audit Lock:</span>
                  <span className="font-mono font-bold text-amber-400">7-Year Immutable WORM</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Tamper-Proof Audit Seals:</span>
                  <span className="font-mono font-bold text-emerald-400">100% Cryptographic Match</span>
                </div>
              </div>
            </div>

            {/* Quick Financial Operations Shortcuts */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">
                  Quick Actions
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Broker Operations
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Financial Automation Hub</h3>
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={() => setActiveTab('invoices')}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-between border border-slate-700 transition"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" /> Review Customer Invoices
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={handleRunDunning}
                  disabled={isDunningRunning}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-between border border-slate-700 transition"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" /> Trigger AR Dunning Cadence
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => setActiveTab('accounting')}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-between border border-slate-700 transition"
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-indigo-400" /> Sync QuickBooks Online Ledger
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Aging Summary & Margin Breakdown Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" /> Accounts Receivable Aging Breakdown
                </h4>
                <span className="text-xs font-mono text-emerald-400">95.4% Current</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 font-mono text-[11px] mb-1">
                    <span>Current (0-30 Days): $2,914.90</span>
                    <span className="text-emerald-400">64.6%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '64.6%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 font-mono text-[11px] mb-1">
                    <span>1-30 Days Past Due: $1,595.00</span>
                    <span className="text-amber-400">35.4%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '35.4%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" /> Realized Gross Margin Performance
                </h4>
                <span className="text-xs font-mono text-emerald-400 font-bold">18.62% GP Realized</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Total Invoiced</span>
                  <span className="text-white font-bold">${totalInvoiced.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Carrier Cost</span>
                  <span className="text-slate-400 font-bold">${totalCarrierCost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Gross Profit</span>
                  <span className="text-emerald-400 font-bold">${realizedGp.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CUSTOMER INVOICES */}
      {/* ========================================================================= */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by Shipper, Invoice #, PO #, Shipment..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">Issued</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/80 shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Invoice # / PO</th>
                  <th className="p-3.5">Shipper Client</th>
                  <th className="p-3.5">Freight Lane</th>
                  <th className="p-3.5 text-right">Linehaul</th>
                  <th className="p-3.5 text-right">Fuel + Acc</th>
                  <th className="p-3.5 text-right">Total Invoiced</th>
                  <th className="p-3.5 text-center">Due Date</th>
                  <th className="p-3.5 text-center">QBO Sync</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-900/60 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-indigo-300 font-medium">{inv.customerPoNumber}</div>
                    </td>
                    <td className="p-3.5 font-sans">
                      <div className="font-bold text-slate-200">{inv.shipperName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{inv.shipperEmail}</div>
                    </td>
                    <td className="p-3.5 font-sans">
                      <div className="text-slate-300 font-medium">{inv.origin} $\rightarrow$ {inv.destination}</div>
                      <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified POD Attached ({inv.podGeofenceDistance})
                      </div>
                    </td>
                    <td className="p-3.5 text-right text-slate-300">${inv.linehaulAmount.toFixed(2)}</td>
                    <td className="p-3.5 text-right text-slate-400">
                      +${(inv.fuelSurcharge + inv.accessorials).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-white text-sm font-sans">
                      ${inv.totalAmount.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center font-sans text-slate-300">
                      <div>{inv.dueDate}</div>
                      <div className="text-[10px] text-slate-500">{inv.paymentTermsDays} Days Term</div>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      {inv.qboSynced ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" /> Synced ({inv.qboDocNumber})
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSyncQbo(inv.id)}
                          disabled={isSyncingQbo === inv.id}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 flex items-center justify-center gap-1 transition"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSyncingQbo === inv.id ? 'animate-spin' : ''}`} />
                          {isSyncingQbo === inv.id ? 'Syncing...' : 'Push QBO'}
                        </button>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : inv.status === 'OVERDUE'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold border border-slate-700 flex items-center gap-1 transition"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" /> View
                        </button>
                        <a
                          href={`/api/v1/invoices/${inv.id}/pdf`}
                          target="_blank"
                          className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded-lg text-[11px] font-bold border border-indigo-500/30 flex items-center gap-1 transition"
                        >
                          <FileText className="w-3 h-3" /> PDF
                        </a>
                        {!inv.wormSealed && (
                          <button
                            onClick={() => handleSealWormArchive(inv)}
                            disabled={isSealingWorm}
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-lg text-[11px] font-bold border border-amber-500/30 flex items-center gap-1 transition"
                          >
                            <Lock className="w-3 h-3" /> Seal WORM
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VERIFIED PODS FEED */}
      {/* ========================================================================= */}
      {activeTab === 'pods' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {podRecords.map((pod) => (
              <div
                key={pod.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-lg hover:border-slate-700 transition"
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {pod.shipmentRef}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      pod.status === 'VERIFIED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {pod.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="text-slate-300 font-bold">{pod.consigneeName}</div>
                  <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-slate-500" /> Delivered: {pod.submittedAt}
                  </div>
                  <div className="text-slate-500 text-[10px] font-mono">Device: {pod.device}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Geofence (Haversine)</span>
                    <span className="text-emerald-400 font-bold">{pod.geofenceDistance} (PASS)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">OCR Signature</span>
                    <span className="text-emerald-400 font-bold">DETECTED ({pod.confidenceScore}%)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Pieces</span>
                    <span className="text-white font-bold">{pod.receivedPieces}/{pod.expectedPieces} Plts</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase font-sans">Damage Notation</span>
                    <span className={pod.damageFlagged ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      {pod.damageFlagged ? 'FLAGGED (HIGH)' : 'NONE (CLEAN)'}
                    </span>
                  </div>
                </div>

                {pod.damageFlagged && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-[11px] text-rose-300 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Exception Keywords:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pod.damageKeywords?.map((kw: string) => (
                        <span key={kw} className="bg-rose-500/20 px-1.5 py-0.2 rounded text-[10px] font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedPod(pod)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" /> Inspect Geotag & EXIF Data
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CLAIMS & DELIVERY EXCEPTIONS DESK */}
      {/* ========================================================================= */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          {exceptions.map((exc) => (
            <div
              key={exc.id}
              className="bg-slate-900 border border-rose-500/40 rounded-2xl p-5 space-y-4 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded text-xs font-mono font-bold">
                    SEVERITY: {exc.severity}
                  </span>
                  <span className="text-sm font-bold text-white">Shipment: {exc.shipmentRef}</span>
                  <span className="text-xs text-slate-400 font-mono">Carrier: {exc.carrierName}</span>
                </div>

                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  STATUS: {exc.status}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  OCR Delivery Receipt Handwriting Transcription:
                </div>
                <div className="text-xs font-mono text-amber-300 italic bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  {exc.notationSnippet}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                  <div>Shortage: <span className="text-rose-400 font-bold">{exc.piecesShort} Pallet Short</span></div>
                  <div>Estimated Claim: <span className="text-emerald-400 font-bold">${exc.claimEstimate.toFixed(2)}</span></div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition">
                    View POD Proof
                  </button>
                  <button className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl border border-rose-500/30 transition">
                    File Carrier Claim (1-Click)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ACCOUNTING SYNC (QBO / XERO) */}
      {/* ========================================================================= */}
      {activeTab === 'accounting' && (
        <div className="space-y-6">
          {/* Connection Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                  QB
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    QuickBooks Online (Production Connection)
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE & HEALTHY
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Realm ID: 91303492810 • OAuth2 Token Active (Refreshes automatically)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Force Full Reconciliation
                </button>
              </div>
            </div>

            {/* GL Mappings */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Revenue GL</span>
                <span className="font-mono font-bold text-emerald-400">4000 - Freight Revenue</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Carrier Expense GL</span>
                <span className="font-mono font-bold text-rose-400">5000 - Carrier COGS</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Accounts Receivable</span>
                <span className="font-mono font-bold text-indigo-400">1200 - Customer AR</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Accounts Payable</span>
                <span className="font-mono font-bold text-amber-400">2000 - Carrier AP</span>
              </div>
            </div>
          </div>

          {/* Sync Transaction Logs Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/80 shadow-xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Idempotent Accounting Sync Ledger
              </h4>
              <span className="text-xs text-slate-400 font-mono">Auto-Sync on Verified Settlement</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Sync Type</th>
                  <th className="p-3.5">Reference #</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5">QBO Doc ID</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Synced At</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/60 transition">
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {log.syncType}
                      </span>
                    </td>
                    <td className="p-3.5 text-white font-bold">{log.referenceNumber}</td>
                    <td className="p-3.5 text-right text-emerald-400 font-bold">{log.amount}</td>
                    <td className="p-3.5 text-slate-400">{log.externalPlatformId || 'Pending'}</td>
                    <td className="p-3.5 text-center font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px] font-sans">{log.syncedAt}</td>
                    <td className="p-3.5 text-center font-sans">
                      {log.status !== 'SUCCESS' && (
                        <button className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded-lg text-[10px] font-bold border border-indigo-500/30 transition">
                          Retry Sync
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AR AGING & AUTOMATED DUNNING DESK */}
      {/* ========================================================================= */}
      {activeTab === 'aging' && (
        <div className="space-y-6">
          {/* Dunning Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-black text-white">Automated Accounts Receivable & Dunning Engine</h3>
                <p className="text-xs text-slate-400">
                  Cadence triggers: T-5 (Friendly reminder), T-0 (Due today), T+7 (Past due notice), T+14 (Urgent), T+30 (Credit hold & final demand).
                </p>
              </div>
              <button
                onClick={handleRunDunning}
                disabled={isDunningRunning}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isDunningRunning ? 'Dispatching Dunning Batch...' : 'Run Automated Dunning Cadence'}
              </button>
            </div>

            {/* Visual Aging Bar Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-800 font-mono text-center">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-emerald-400 text-[10px] block uppercase font-bold font-sans">Current (0-30d)</span>
                <span className="text-lg font-black text-white mt-1 block">$2,914.90</span>
                <span className="text-[10px] text-slate-500 font-sans">3 Invoices (64.6%)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-amber-400 text-[10px] block uppercase font-bold font-sans">1-30 Days Past Due</span>
                <span className="text-lg font-black text-amber-400 mt-1 block">$1,595.00</span>
                <span className="text-[10px] text-slate-500 font-sans">1 Invoice (35.4%)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase font-bold font-sans">31-60 Days Past Due</span>
                <span className="text-lg font-black text-slate-400 mt-1 block">$0.00</span>
                <span className="text-[10px] text-slate-500 font-sans">0 Invoices (0%)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase font-bold font-sans">61-90 Days Past Due</span>
                <span className="text-lg font-black text-slate-400 mt-1 block">$0.00</span>
                <span className="text-[10px] text-slate-500 font-sans">0 Invoices (0%)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-rose-400 text-[10px] block uppercase font-bold font-sans">90+ Days (Credit Hold)</span>
                <span className="text-lg font-black text-rose-400 mt-1 block">$0.00</span>
                <span className="text-[10px] text-slate-500 font-sans">0 Invoices (0%)</span>
              </div>
            </div>
          </div>

          {/* Dunning Stage Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Active Dunning Communications & Cadence Dispatch
            </h4>
            <div className="space-y-2">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                      PAST_DUE_T_PLUS_7
                    </span>
                    Titan Heavy Industries • INV-2026-08845 ($1,595.00)
                  </div>
                  <div className="text-slate-400 text-[11px]">Recipient: payables@titanheavy.com • Days Past Due: 13 Days</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-[11px] font-bold">Email Dispatched</span>
                  <button className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold border border-slate-700">
                    Resend Notice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: GROSS MARGIN & SALES COMMISSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'commissions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-slate-400 text-xs font-semibold">Total Realized GP (MTD)</span>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">${realizedGp.toFixed(2)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Average Margin: {realizedMarginPct.toFixed(2)}%</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-slate-400 text-xs font-semibold">Total Commissions Accrued</span>
              <div className="text-2xl font-black text-white font-mono mt-1">
                ${salesReps.reduce((s, r) => s + r.commissionEarned, 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-indigo-400 mt-0.5">Across {salesReps.length} Freight Brokers</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-slate-400 text-xs font-semibold">Brokerage Net Retained Profit</span>
              <div className="text-2xl font-black text-teal-300 font-mono mt-1">
                ${(realizedGp - salesReps.reduce((s, r) => s + r.commissionEarned, 0)).toFixed(2)}
              </div>
              <div className="text-[11px] text-teal-400 mt-0.5">Net Broker Margin Retained</div>
            </div>
          </div>

          {/* Sales Reps Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/80 shadow-xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Broker Sales Rep Quotas & Commission Ledger
              </h4>
              <button className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 rounded-xl text-xs font-bold border border-emerald-500/30 transition">
                Approve All Accrued Payouts
              </button>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Sales Representative</th>
                  <th className="p-3.5 text-right">Invoiced Volume</th>
                  <th className="p-3.5 text-right">Carrier Payout</th>
                  <th className="p-3.5 text-right">Realized GP</th>
                  <th className="p-3.5 text-center">GP Margin %</th>
                  <th className="p-3.5 text-center">Comm Tier %</th>
                  <th className="p-3.5 text-right">Commission Earned</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {salesReps.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-900/60 transition">
                    <td className="p-3.5 font-sans">
                      <div className="font-bold text-white text-xs">{rep.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{rep.email}</div>
                    </td>
                    <td className="p-3.5 text-right text-slate-300">${rep.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3.5 text-right text-slate-400">${rep.carrierCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-400">${rep.realizedGp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3.5 text-center text-slate-300">{rep.marginPct.toFixed(2)}%</td>
                    <td className="p-3.5 text-center font-bold text-indigo-300">{rep.appliedCommPct.toFixed(1)}%</td>
                    <td className="p-3.5 text-right font-black text-white text-sm font-sans">
                      ${rep.commissionEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rep.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <button className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold border border-slate-700 transition">
                        Approve Payout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: S3 WORM VAULT EXPLORER */}
      {/* ========================================================================= */}
      {activeTab === 'worm' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold mb-1">
                  <Lock className="w-3.5 h-3.5" /> S3 OBJECT LOCK (COMPLIANCE MODE)
                </div>
                <h3 className="text-xl font-black text-white">Settlement Document Vault & Merkle Root Registry</h3>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Immutable WORM storage sealed pursuant to FMCSA 49 CFR § 379 and DOT 7-Year Statutory Audit regulations. Once locked in COMPLIANCE mode, archives cannot be overwritten or deleted by any AWS user or root account.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  100% Cryptographic Integrity
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Retention Mode</span>
                <span className="font-mono font-bold text-emerald-400">COMPLIANCE (Immutable)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Mandatory Duration</span>
                <span className="font-mono font-bold text-white">7 Years (DOT Statutory)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Hashing Standard</span>
                <span className="font-mono font-bold text-indigo-400">SHA-256 (FIPS PUB 180-4)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Total Vault Packages</span>
                <span className="font-mono font-bold text-amber-400">{wormPackages.length} Archived</span>
              </div>
            </div>
          </div>

          {/* WORM Packages Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/80 shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Package Reference / Load</th>
                  <th className="p-3.5">Merkle Root SHA-256 Seal</th>
                  <th className="p-3.5">S3 Vault Target</th>
                  <th className="p-3.5 text-center">Retention Mode</th>
                  <th className="p-3.5 text-center">Retain Until</th>
                  <th className="p-3.5 text-center">Legal Hold</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {wormPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-900/60 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{pkg.packageReference}</div>
                      <div className="text-[10px] text-indigo-300 font-medium font-sans">
                        Shipment: {pkg.shipmentRef} | Invoice: {pkg.invoiceNumber}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-teal-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {pkg.merkleRootHash.substring(0, 16)}...{pkg.merkleRootHash.substring(48)}
                        </span>
                        <button
                          onClick={() => handleCopy(pkg.merkleRootHash, pkg.id)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                          title="Copy Full SHA-256 Hash"
                        >
                          {copiedHash === pkg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">
                      <div>{pkg.s3Bucket}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">{pkg.s3ObjectKey}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {pkg.retentionMode}
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-amber-300 font-bold">
                      {pkg.retainUntilDate} (7 Yrs)
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pkg.isLegalHoldActive
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {pkg.isLegalHoldActive ? 'ACTIVE' : 'OFF'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedWormPackage(pkg)}
                          className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded-lg text-[11px] font-bold border border-indigo-500/30 flex items-center gap-1 transition"
                        >
                          <Layers className="w-3 h-3" /> Inspect Bundle (5 Docs)
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ITEMIZE INVOICE DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">
                  VERIFIED AUDITED INVOICE
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">{selectedInvoice.invoiceNumber}</h3>
                <div className="text-xs text-slate-400">PO: {selectedInvoice.customerPoNumber}</div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-950 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Shipper Billing Contact</span>
                <div className="text-white font-bold">{selectedInvoice.shipperName}</div>
                <div className="text-slate-400 font-mono">{selectedInvoice.shipperEmail}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Itemized Billing Summary</span>
                <div className="flex justify-between text-slate-300 font-mono">
                  <span>Line-Haul Freight Charge:</span>
                  <span>${selectedInvoice.linehaulAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300 font-mono">
                  <span>Fuel Surcharge:</span>
                  <span>${selectedInvoice.fuelSurcharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300 font-mono">
                  <span>Approved Accessorials:</span>
                  <span>${selectedInvoice.accessorials.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold font-mono pt-2 border-t border-slate-800 text-sm">
                  <span>Net Total Amount:</span>
                  <span className="text-emerald-400">${selectedInvoice.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                <div className="font-sans font-bold text-slate-300">Remittance Instructions (ACH / Wire):</div>
                <div>Bank: JPMorgan Chase Bank, N.A.</div>
                <div>Routing: 122000496 | Account: 8849102941</div>
                <div>Remit Email: payments@apexltlos.com</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
              <a
                href={`/api/v1/invoices/${selectedInvoice.id}/pdf`}
                target="_blank"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <FileText className="w-3.5 h-3.5" /> Download PDF Invoice
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: POD EXIF & GEOFENCE INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {selectedPod && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">
                  GEOTAGGED PROOF OF DELIVERY AUDIT
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">{selectedPod.shipmentRef}</h3>
                <div className="text-xs text-slate-400">{selectedPod.consigneeName}</div>
              </div>
              <button
                onClick={() => setSelectedPod(null)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-950 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-slate-400 text-[10px] uppercase font-bold">GPS & EXIF Metadata</div>
                <div className="grid grid-cols-2 gap-2 font-mono text-slate-300">
                  <div>Latitude: <span className="text-white font-bold">{selectedPod.gpsLat}° N</span></div>
                  <div>Longitude: <span className="text-white font-bold">{selectedPod.gpsLng}° W</span></div>
                  <div>Haversine Distance: <span className="text-emerald-400 font-bold">{selectedPod.geofenceDistance}</span></div>
                  <div>Scanner Device: <span className="text-indigo-300 font-bold">{selectedPod.device}</span></div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-slate-400 text-[10px] uppercase font-bold">OCR Transcription & Signature Attestation</div>
                <div className="font-mono text-emerald-400 text-xs">Signature Confidence: {selectedPod.confidenceScore}% (VERIFIED)</div>
                <div className="text-slate-400 text-[11px]">
                  Piece count matched: {selectedPod.receivedPieces} of {selectedPod.expectedPieces} pallets delivered exception-free.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedPod(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: S3 WORM 5-DOCUMENT BUNDLE INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {selectedWormPackage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-amber-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> FMCSA § 379 & DOT 7-YEAR WORM SETTLEMENT ARCHIVE
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">{selectedWormPackage.packageReference}</h3>
                <div className="text-xs text-slate-400 font-mono">
                  Shipment: {selectedWormPackage.shipmentRef} | Retention Mode: {selectedWormPackage.retentionMode}
                </div>
              </div>
              <button
                onClick={() => setSelectedWormPackage(null)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-950 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 font-mono">
                <div className="text-indigo-400 text-[10px] uppercase font-bold font-sans">
                  Merkle Root Cryptographic Seal (SHA-256)
                </div>
                <div className="text-white text-[11px] font-bold break-all bg-slate-900 p-2 rounded-xl border border-slate-800">
                  {selectedWormPackage.merkleRootHash}
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  Immutable S3 Object Lock expires: <strong>{selectedWormPackage.retainUntilDate}</strong> (7-Year Mandatory Lock)
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  5 Sealed Regulatory Documents in Bundle:
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {selectedWormPackage.bundleManifest?.map((doc: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-slate-200 text-[11px] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          {idx + 1}. {doc.documentType}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-sm">{doc.documentName}</div>
                        <div className="text-[9px] text-sky-400">
                          SHA-256: {doc.fileHashSha256.substring(0, 16)}...{doc.fileHashSha256.substring(48)}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedWormPackage(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([
                    `FMCSA 49 CFR § 379 COMPLIANCE AUDIT CERTIFICATE\n\n` +
                    `Package Reference: ${selectedWormPackage.packageReference}\n` +
                    `Shipment Reference: ${selectedWormPackage.shipmentRef}\n` +
                    `Invoice Number: ${selectedWormPackage.invoiceNumber}\n` +
                    `Merkle Root Hash: ${selectedWormPackage.merkleRootHash}\n` +
                    `Retention Mode: ${selectedWormPackage.retentionMode}\n` +
                    `Retain Until: ${selectedWormPackage.retainUntilDate}\n` +
                    `Sealed Timestamp: ${selectedWormPackage.sealedAt}\n` +
                    `S3 Target: s3://${selectedWormPackage.s3Bucket}/${selectedWormPackage.s3ObjectKey}\n\n` +
                    `MANIFEST OF 5 SEALED DOCUMENTS:\n` +
                    selectedWormPackage.bundleManifest?.map((d: any, i: number) => `${i + 1}. [${d.documentType}] ${d.documentName} | SHA256: ${d.fileHashSha256} | ${d.sizeBytes} bytes`).join('\n')
                  ], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Compliance_Certificate_${selectedWormPackage.packageReference}.txt`;
                  a.click();
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download Compliance Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
