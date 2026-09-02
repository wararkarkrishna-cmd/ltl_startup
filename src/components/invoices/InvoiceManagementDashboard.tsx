'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  X,
  Info,
} from 'lucide-react';
import { Phase5DisputeWorkspace } from './Phase5DisputeWorkspace';

function InvoiceManagementDashboardContent() {
  const searchParams = useSearchParams();
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

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (
      tab &&
      [
        'overview',
        'invoices',
        'rebill',
        'disputes',
        'claims_lifecycle',
        'supplemental',
        'recovery_billing',
        'scorecards',
        'pods',
        'exceptions',
        'accounting',
        'aging',
        'commissions',
        'worm',
      ].includes(tab)
    ) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId as any);
    const newUrl = tabId === 'overview' ? '/invoices' : `/invoices?tab=${tabId}`;
    window.history.pushState(null, '', newUrl);
  };

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
  const [showUseCaseModal, setShowUseCaseModal] = useState(false);

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
    <div className="space-y-6 font-sans text-white">
      {/* Header Banner */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700/80 text-neutral-300 text-[10px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              SUB-MINUTE DSO SETTLEMENT &amp; S3 WORM COMPLIANCE VAULT
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-serif text-white tracking-tight font-normal">
                Broker Invoicing &amp; Settlement Dashboard
              </h1>
              <button
                onClick={() => setShowUseCaseModal(true)}
                className="px-3 py-1 rounded-full bg-[#121215] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-sans transition flex items-center gap-1.5"
                title="View Invoicing Desk Use Case"
              >
                <Eye className="w-3.5 h-3.5 text-white" />
                <span>Use Case</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleSimulateInstantInvoice}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-white text-black hover:bg-neutral-200 font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating PDF Invoice...' : 'Instant POD Billing (<60s)'}
            </button>
            <button
              onClick={() => setActiveTab('worm')}
              className="px-4 py-2.5 bg-[#121215] hover:bg-[#1c1c21] text-white font-sans font-medium text-xs rounded-xl border border-neutral-800 flex items-center gap-2 transition"
            >
              <Lock className="w-4 h-4 text-neutral-400" />
              WORM Vault ({wormPackages.length})
            </button>
          </div>
        </div>

        {/* Global Financial KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-4 border-t border-[#27272a]">
          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-3.5">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-neutral-300" /> Total Invoiced
            </div>
            <div className="text-xl font-mono font-bold text-white mt-1">
              ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{invoices.length} Loads Active</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-3.5">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-neutral-300" /> Realized GP %
            </div>
            <div className="text-xl font-mono font-bold text-white mt-1">
              {realizedMarginPct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">${realizedGp.toFixed(2)} GP</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-3.5">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-300" /> DSO
            </div>
            <div className="text-xl font-mono font-bold text-white mt-1">21.4 Days</div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">-4.2d Target Achieved</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-3.5">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-neutral-300" /> Active AR Overdue
            </div>
            <div className="text-xl font-mono font-bold text-white mt-1">
              ${overdueTotal.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{overdueInvoices.length} Account Alert</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-3.5">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-300" /> Geofence Accuracy
            </div>
            <div className="text-xl font-mono font-bold text-white mt-1">100.0%</div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">Avg: 0.11 mi</div>
          </div>

          <div className="bg-[#121215] border border-neutral-800/80 rounded-xl p-3.5">
            <div className="text-[11px] text-neutral-400 font-sans font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-neutral-300" /> S3 WORM Compliance
            </div>
            <div className="text-xl font-mono font-bold text-white mt-1">100% Locked</div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">7-Yr FMCSA Lock</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex border-b border-[#27272a] gap-1 sm:gap-2 overflow-x-auto pb-1 custom-scrollbar font-sans">
        {[
          { id: 'overview', label: 'Overview & KPIs', icon: BarChart3 },
          { id: 'invoices', label: `Invoices (${invoices.length})`, icon: FileText },
          { id: 'rebill', label: 'Re-Bill Audit', icon: Scale },
          { id: 'disputes', label: 'Dispute Desk', icon: ShieldAlert },
          { id: 'claims_lifecycle', label: 'Claims (30d SLA)', icon: Clock },
          { id: 'supplemental', label: 'Supplemental', icon: PlusCircle },
          { id: 'recovery_billing', label: '20% Recovery Fees', icon: Percent },
          { id: 'scorecards', label: 'Scorecards', icon: Award },
          { id: 'pods', label: `PODs (${podRecords.length})`, icon: CheckCircle2 },
          { id: 'exceptions', label: `Claims (${exceptions.length})`, icon: AlertTriangle },
          { id: 'accounting', label: 'QBO Sync', icon: Database },
          { id: 'aging', label: 'AR Aging', icon: Calendar },
          { id: 'commissions', label: 'Commissions', icon: Award },
          { id: 'worm', label: `WORM Vault (${wormPackages.length})`, icon: FolderLock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id as any)}
              className={`px-3 py-2 text-xs font-sans rounded-t-xl transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-white text-white bg-[#121215] font-bold'
                  : 'border-transparent text-neutral-400 hover:text-white hover:bg-[#0c0c0e]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Phase 5 Subtabs */}
      {(activeTab === 'rebill' ||
        activeTab === 'disputes' ||
        activeTab === 'claims_lifecycle' ||
        activeTab === 'supplemental' ||
        activeTab === 'recovery_billing' ||
        activeTab === 'scorecards') && (
        <Phase5DisputeWorkspace activeSubTab={activeTab} />
      )}

      {/* TAB 1: OVERVIEW & DSO KPIS */}
      {activeTab === 'overview' && (
        <div className="space-y-6 font-sans">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cash Acceleration & Sub-Minute Billing Card */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">
                  Cash Flow Velocity
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-900 text-white border border-neutral-700">
                  Real-Time
                </span>
              </div>
              <h3 className="text-lg font-serif text-white font-normal">Sub-Minute Automated Billing</h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                Invoices are generated, validated, cryptographically sealed, and dispatched to shipper Accounts Payable within 60 seconds of clean OCR geofenced delivery receipt capture.
              </p>
              <div className="space-y-2 pt-2 border-t border-neutral-800 text-xs font-sans">
                <div className="flex justify-between text-neutral-300">
                  <span>Average Billing Turnaround:</span>
                  <span className="font-mono font-bold text-white">42 seconds</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>DSO Reduction:</span>
                  <span className="font-mono font-bold text-white">21.4 days (vs 45d industry avg)</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Floating-Point Rounding Error Rate:</span>
                  <span className="font-mono font-bold text-neutral-300">0.00% (Strict Integer Cents)</span>
                </div>
              </div>
            </div>

            {/* Regulatory Compliance Card */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">
                  Regulatory Compliance
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-900 text-white border border-neutral-700">
                  FMCSA &amp; DOT
                </span>
              </div>
              <h3 className="text-lg font-serif text-white font-normal">FMCSA § 379 &amp; S3 WORM Protection</h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                Complete 5-document load settlement archives (eBOL, signed POD, Rate Con, Freight Invoice, and $1M Insurance Cert) are sealed with Merkle Root SHA-256 hashes and locked with 7-year AWS S3 Object Lock in COMPLIANCE mode.
              </p>
              <div className="space-y-2 pt-2 border-t border-neutral-800 text-xs font-sans">
                <div className="flex justify-between text-neutral-300">
                  <span>Preservation Requirement:</span>
                  <span className="font-mono font-bold text-white">49 CFR § 379 (3-Year Min)</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Statutory DOT Audit Lock:</span>
                  <span className="font-mono font-bold text-white">7-Year Immutable WORM</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Tamper-Proof Audit Seals:</span>
                  <span className="font-mono font-bold text-white">100% Cryptographic Match</span>
                </div>
              </div>
            </div>

            {/* Financial Operations Shortcuts */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">
                  Quick Actions
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-900 text-white border border-neutral-700">
                  Broker Operations
                </span>
              </div>
              <h3 className="text-lg font-serif text-white font-normal">Financial Automation Hub</h3>
              <div className="space-y-2.5 pt-1 font-sans">
                <button
                  onClick={() => setActiveTab('invoices')}
                  className="w-full py-2.5 px-3 bg-[#121215] hover:bg-neutral-800 text-white rounded-xl text-xs font-medium flex items-center justify-between border border-neutral-800 transition"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-neutral-400" /> Review Customer Invoices
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>
                <button
                  onClick={handleRunDunning}
                  disabled={isDunningRunning}
                  className="w-full py-2.5 px-3 bg-[#121215] hover:bg-neutral-800 text-white rounded-xl text-xs font-medium flex items-center justify-between border border-neutral-800 transition"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" /> Trigger AR Dunning Cadence
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>
                <button
                  onClick={() => setActiveTab('accounting')}
                  className="w-full py-2.5 px-3 bg-[#121215] hover:bg-neutral-800 text-white rounded-xl text-xs font-medium flex items-center justify-between border border-neutral-800 transition"
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-neutral-400" /> Sync QuickBooks Online Ledger
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Aging Summary & Margin Breakdown Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 font-sans">
              <div className="flex justify-between items-center">
                <h4 className="font-serif font-normal text-white text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-neutral-400" /> Accounts Receivable Aging Breakdown
                </h4>
                <span className="text-xs font-mono text-white font-bold">95.4% Current</span>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-neutral-300 font-mono text-[11px] mb-1">
                    <span>Current (0-30 Days): $2,914.90</span>
                    <span className="text-white">64.6%</span>
                  </div>
                  <div className="w-full bg-[#121215] rounded-full h-2 border border-neutral-800">
                    <div className="bg-white h-2 rounded-full" style={{ width: '64.6%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-neutral-300 font-mono text-[11px] mb-1">
                    <span>1-30 Days Past Due: $1,595.00</span>
                    <span className="text-neutral-400">35.4%</span>
                  </div>
                  <div className="w-full bg-[#121215] rounded-full h-2 border border-neutral-800">
                    <div className="bg-neutral-400 h-2 rounded-full" style={{ width: '35.4%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 font-sans">
              <div className="flex justify-between items-center">
                <h4 className="font-serif font-normal text-white text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-neutral-400" /> Realized Gross Margin Performance
                </h4>
                <span className="text-xs font-mono text-white font-bold">18.62% GP Realized</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#121215] p-3.5 rounded-xl border border-neutral-800">
                <div>
                  <span className="text-neutral-400 text-[10px] block font-sans">Total Invoiced</span>
                  <span className="text-white font-bold">${totalInvoiced.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 text-[10px] block font-sans">Carrier Cost</span>
                  <span className="text-neutral-300 font-bold">${totalCarrierCost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 text-[10px] block font-sans">Gross Profit</span>
                  <span className="text-white font-bold">${realizedGp.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER INVOICES */}
      {activeTab === 'invoices' && (
        <div className="space-y-4 font-sans">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-[#09090b] p-3.5 rounded-2xl border border-[#27272a]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by Shipper, Invoice #, PO #, Shipment..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#121215] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-sans"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#121215] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-sans focus:outline-none focus:border-neutral-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">Issued</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#27272a] rounded-2xl bg-[#09090b] shadow-xl font-sans">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121215] text-neutral-400 font-semibold uppercase text-[10px] tracking-wider border-b border-neutral-800 font-mono">
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
              <tbody className="divide-y divide-neutral-800/80 font-sans">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-900/60 transition">
                    <td className="p-3.5 font-mono">
                      <div className="font-bold text-white text-xs">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-neutral-400">{inv.customerPoNumber}</div>
                    </td>
                    <td className="p-3.5 font-sans">
                      <div className="font-bold text-white">{inv.shipperName}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{inv.shipperEmail}</div>
                    </td>
                    <td className="p-3.5 font-sans">
                      <div className="text-neutral-200 font-medium">{inv.origin} $\rightarrow$ {inv.destination}</div>
                      <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-white" /> Verified POD ({inv.podGeofenceDistance})
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-mono text-neutral-300">${inv.linehaulAmount.toFixed(2)}</td>
                    <td className="p-3.5 text-right font-mono text-neutral-400">
                      +${(inv.fuelSurcharge + inv.accessorials).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-white text-sm">
                      ${inv.totalAmount.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center font-sans text-neutral-300">
                      <div>{inv.dueDate}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{inv.paymentTermsDays} Days Term</div>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      {inv.qboSynced ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-neutral-900 text-white border border-neutral-700 flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" /> Synced ({inv.qboDocNumber})
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSyncQbo(inv.id)}
                          disabled={isSyncingQbo === inv.id}
                          className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#121215] hover:bg-neutral-800 text-white border border-neutral-800 flex items-center justify-center gap-1 transition"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSyncingQbo === inv.id ? 'animate-spin' : ''}`} />
                          {isSyncingQbo === inv.id ? 'Syncing...' : 'Push QBO'}
                        </button>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-neutral-900 text-white border border-neutral-700">
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-2.5 py-1 bg-[#121215] hover:bg-neutral-800 text-white rounded-lg text-[11px] font-medium border border-neutral-800 flex items-center gap-1 transition"
                        >
                          <Eye className="w-3 h-3 text-neutral-400" /> View
                        </button>
                        <a
                          href={`/api/v1/invoices/${inv.id}/pdf`}
                          target="_blank"
                          className="px-2.5 py-1 bg-[#121215] hover:bg-neutral-800 text-white rounded-lg text-[11px] font-medium border border-neutral-800 flex items-center gap-1 transition"
                        >
                          <FileText className="w-3 h-3 text-neutral-400" /> PDF
                        </a>
                        {!inv.wormSealed && (
                          <button
                            onClick={() => handleSealWormArchive(inv)}
                            disabled={isSealingWorm}
                            className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow"
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

      {/* TAB 3: VERIFIED PODS FEED */}
      {activeTab === 'pods' && (
        <div className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {podRecords.map((pod) => (
              <div
                key={pod.id}
                className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 space-y-3.5 shadow-lg hover:border-neutral-700 transition"
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-white bg-[#121215] px-2.5 py-1 rounded border border-neutral-800">
                    {pod.shipmentRef}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-900 text-white border border-neutral-700">
                    {pod.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-sans">
                  <div className="text-white font-bold">{pod.consigneeName}</div>
                  <div className="text-neutral-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-neutral-500" /> Delivered: {pod.submittedAt}
                  </div>
                  <div className="text-neutral-400 text-[10px] font-mono">Device: {pod.device}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-[#121215] p-3 rounded-xl border border-neutral-800">
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-sans">Geofence (Haversine)</span>
                    <span className="text-white font-bold">{pod.geofenceDistance} (PASS)</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-sans">OCR Signature</span>
                    <span className="text-white font-bold">DETECTED ({pod.confidenceScore}%)</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-sans">Pieces</span>
                    <span className="text-white font-bold">{pod.receivedPieces}/{pod.expectedPieces} Plts</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[9px] uppercase font-sans">Damage Notation</span>
                    <span className="text-neutral-300 font-bold">
                      {pod.damageFlagged ? 'FLAGGED (HIGH)' : 'NONE (CLEAN)'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPod(pod)}
                  className="w-full py-2 bg-[#121215] hover:bg-neutral-800 text-white text-xs font-medium rounded-xl border border-neutral-800 flex items-center justify-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-400" /> Inspect Geotag &amp; EXIF Data
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CLAIMS & DELIVERY EXCEPTIONS DESK */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4 font-sans">
          {exceptions.map((exc) => (
            <div
              key={exc.id}
              className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 space-y-4 shadow-xl"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="bg-neutral-900 text-white border border-neutral-700 px-2.5 py-0.5 rounded text-xs font-mono font-bold">
                    SEVERITY: {exc.severity}
                  </span>
                  <span className="text-sm font-bold text-white">Shipment: {exc.shipmentRef}</span>
                  <span className="text-xs text-neutral-400 font-mono">Carrier: {exc.carrierName}</span>
                </div>

                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-900 text-white border border-neutral-700">
                  STATUS: {exc.status}
                </span>
              </div>

              <div className="bg-[#121215] border border-neutral-800 rounded-xl p-4 space-y-2">
                <div className="text-xs text-neutral-400 font-mono uppercase tracking-wider">
                  OCR Delivery Receipt Handwriting Transcription:
                </div>
                <div className="text-xs font-mono text-neutral-200 italic bg-[#09090b] p-3 rounded-lg border border-neutral-800">
                  {exc.notationSnippet}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-neutral-800">
                <div className="flex items-center gap-4 text-xs font-mono text-neutral-300">
                  <div>Shortage: <span className="text-white font-bold">{exc.piecesShort} Pallet Short</span></div>
                  <div>Estimated Claim: <span className="text-white font-bold">${exc.claimEstimate.toFixed(2)}</span></div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-[#121215] hover:bg-neutral-800 text-white font-medium text-xs rounded-xl border border-neutral-800 transition">
                    View POD Proof
                  </button>
                  <button className="px-3 py-1.5 bg-white hover:bg-neutral-200 text-black font-bold text-xs rounded-xl shadow transition">
                    File Carrier Claim (1-Click)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: ACCOUNTING SYNC */}
      {activeTab === 'accounting' && (
        <div className="space-y-6 font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#121215] border border-neutral-800 flex items-center justify-center text-white font-bold text-lg font-mono">
                  QB
                </div>
                <div>
                  <h3 className="text-base font-serif text-white font-normal flex items-center gap-2">
                    QuickBooks Online (Production Connection)
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-900 text-white border border-neutral-700">
                      LIVE &amp; HEALTHY
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono">Realm ID: 91303492810 • OAuth2 Token Active</p>
                </div>
              </div>

              <button className="px-3 py-2 bg-[#121215] hover:bg-neutral-800 text-white text-xs font-medium rounded-xl border border-neutral-800 flex items-center gap-1.5 transition">
                <RefreshCw className="w-3.5 h-3.5 text-neutral-400" /> Force Full Reconciliation
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800 text-xs font-mono">
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Revenue GL</span>
                <span className="font-mono font-bold text-white">4000 - Freight Revenue</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Carrier Expense GL</span>
                <span className="font-mono font-bold text-white">5000 - Carrier COGS</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Accounts Receivable</span>
                <span className="font-mono font-bold text-white">1200 - Customer AR</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Accounts Payable</span>
                <span className="font-mono font-bold text-white">2000 - Carrier AP</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#27272a] rounded-2xl bg-[#09090b] shadow-xl">
            <div className="p-4 border-b border-[#27272a] flex justify-between items-center">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
                Idempotent Accounting Sync Ledger
              </h4>
              <span className="text-xs text-neutral-400 font-mono">Auto-Sync on Verified Settlement</span>
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#121215] text-neutral-400 font-semibold uppercase text-[10px] border-b border-neutral-800">
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
              <tbody className="divide-y divide-neutral-800/80">
                {syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-900/60 transition">
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white border border-neutral-700">
                        {log.syncType}
                      </span>
                    </td>
                    <td className="p-3.5 text-white font-bold">{log.referenceNumber}</td>
                    <td className="p-3.5 text-right text-white font-bold">{log.amount}</td>
                    <td className="p-3.5 text-neutral-400">{log.externalPlatformId || 'Pending'}</td>
                    <td className="p-3.5 text-center font-sans">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white border border-neutral-700 font-mono">
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-neutral-400 text-[11px] font-sans">{log.syncedAt}</td>
                    <td className="p-3.5 text-center font-sans">
                      {log.status !== 'SUCCESS' && (
                        <button className="px-2.5 py-1 bg-[#121215] hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold border border-neutral-800 transition">
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

      {/* TAB 6: AR AGING & AUTOMATED DUNNING DESK */}
      {activeTab === 'aging' && (
        <div className="space-y-6 font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-serif text-white font-normal">Automated Accounts Receivable &amp; Dunning Engine</h3>
                <p className="text-xs text-neutral-400 font-sans">
                  Cadence triggers: T-5 (Friendly reminder), T-0 (Due today), T+7 (Past due notice), T+14 (Urgent), T+30 (Credit hold &amp; final demand).
                </p>
              </div>
              <button
                onClick={handleRunDunning}
                disabled={isDunningRunning}
                className="px-4 py-2.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-xl shadow flex items-center gap-2 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-black" />
                {isDunningRunning ? 'Dispatching Dunning Batch...' : 'Run Automated Dunning Cadence'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-[#27272a] font-mono text-center">
              <div className="bg-[#121215] p-3 rounded-2xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Current (0-30d)</span>
                <span className="text-lg font-bold text-white mt-1 block">$2,914.90</span>
                <span className="text-[10px] text-neutral-500 font-sans">3 Invoices (64.6%)</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-2xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">1-30 Days Past Due</span>
                <span className="text-lg font-bold text-white mt-1 block">$1,595.00</span>
                <span className="text-[10px] text-neutral-500 font-sans">1 Invoice (35.4%)</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-2xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">31-60 Days Past Due</span>
                <span className="text-lg font-bold text-neutral-400 mt-1 block">$0.00</span>
                <span className="text-[10px] text-neutral-500 font-sans">0 Invoices (0%)</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-2xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">61-90 Days Past Due</span>
                <span className="text-lg font-bold text-neutral-400 mt-1 block">$0.00</span>
                <span className="text-[10px] text-neutral-500 font-sans">0 Invoices (0%)</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-2xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">90+ Days (Credit Hold)</span>
                <span className="text-lg font-bold text-neutral-400 mt-1 block">$0.00</span>
                <span className="text-[10px] text-neutral-500 font-sans">0 Invoices (0%)</span>
              </div>
            </div>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
              Active Dunning Communications &amp; Cadence Dispatch
            </h4>
            <div className="space-y-2">
              <div className="bg-[#121215] border border-neutral-800 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-neutral-900 text-white font-mono text-[10px] border border-neutral-700">
                      PAST_DUE_T_PLUS_7
                    </span>
                    Titan Heavy Industries • INV-2026-08845 ($1,595.00)
                  </div>
                  <div className="text-neutral-400 text-[11px] font-sans">Recipient: payables@titanheavy.com • Days Past Due: 13 Days</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-[11px] font-bold">Email Dispatched</span>
                  <button className="px-2.5 py-1 bg-[#09090b] hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold border border-neutral-700">
                    Resend Notice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: GROSS MARGIN & COMMISSIONS */}
      {activeTab === 'commissions' && (
        <div className="space-y-6 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4">
              <span className="text-neutral-400 text-xs font-sans">Total Realized GP (MTD)</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">${realizedGp.toFixed(2)}</div>
              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">Average Margin: {realizedMarginPct.toFixed(2)}%</div>
            </div>
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4">
              <span className="text-neutral-400 text-xs font-sans">Total Commissions Accrued</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                ${salesReps.reduce((s, r) => s + r.commissionEarned, 0).toFixed(2)}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">Across {salesReps.length} Freight Brokers</div>
            </div>
            <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4">
              <span className="text-neutral-400 text-xs font-sans">Brokerage Net Retained Profit</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                ${(realizedGp - salesReps.reduce((s, r) => s + r.commissionEarned, 0)).toFixed(2)}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">Net Broker Margin Retained</div>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#27272a] rounded-2xl bg-[#09090b] shadow-xl">
            <div className="p-4 border-b border-[#27272a] flex justify-between items-center">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
                Broker Sales Rep Quotas &amp; Commission Ledger
              </h4>
              <button className="px-3 py-1.5 bg-white text-black font-bold text-xs rounded-xl shadow transition">
                Approve All Accrued Payouts
              </button>
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#121215] text-neutral-400 font-semibold uppercase text-[10px] border-b border-neutral-800">
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
              <tbody className="divide-y divide-neutral-800/80">
                {salesReps.map((rep) => (
                  <tr key={rep.id} className="hover:bg-neutral-900/60 transition">
                    <td className="p-3.5 font-sans">
                      <div className="font-bold text-white text-xs">{rep.name}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{rep.email}</div>
                    </td>
                    <td className="p-3.5 text-right text-neutral-300">${rep.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3.5 text-right text-neutral-400">${rep.carrierCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3.5 text-right font-bold text-white">${rep.realizedGp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3.5 text-center text-neutral-300">{rep.marginPct.toFixed(2)}%</td>
                    <td className="p-3.5 text-center font-bold text-white">{rep.appliedCommPct.toFixed(1)}%</td>
                    <td className="p-3.5 text-right font-bold text-white text-sm">
                      ${rep.commissionEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-900 text-white border border-neutral-700">
                        {rep.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <button className="px-2.5 py-1 bg-[#121215] hover:bg-neutral-800 text-white rounded-lg text-[11px] font-medium border border-neutral-800 transition">
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

      {/* TAB 8: S3 WORM VAULT EXPLORER */}
      {activeTab === 'worm' && (
        <div className="space-y-6 font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-white text-xs font-mono font-bold mb-1">
                  <Lock className="w-3.5 h-3.5" /> S3 OBJECT LOCK (COMPLIANCE MODE)
                </div>
                <h3 className="text-xl font-serif text-white font-normal">Settlement Document Vault &amp; Merkle Root Registry</h3>
                <p className="text-xs text-neutral-400 max-w-2xl font-sans">
                  Immutable WORM storage sealed pursuant to FMCSA 49 CFR § 379 and DOT 7-Year Statutory Audit regulations. Once locked in COMPLIANCE mode, archives cannot be overwritten or deleted.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-2 bg-[#121215] border border-neutral-800 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-white" />
                  100% Cryptographic Integrity
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800 text-xs font-mono">
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Retention Mode</span>
                <span className="font-mono font-bold text-white">COMPLIANCE (Immutable)</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Mandatory Duration</span>
                <span className="font-mono font-bold text-white">7 Years (DOT Statutory)</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Hashing Standard</span>
                <span className="font-mono font-bold text-white">SHA-256 (FIPS PUB 180-4)</span>
              </div>
              <div className="bg-[#121215] p-3 rounded-xl border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block uppercase font-sans">Total Vault Packages</span>
                <span className="font-mono font-bold text-white">{wormPackages.length} Archived</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#27272a] rounded-2xl bg-[#09090b] shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#121215] text-neutral-400 font-semibold uppercase text-[10px] border-b border-neutral-800">
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
              <tbody className="divide-y divide-neutral-800/80">
                {wormPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-neutral-900/60 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{pkg.packageReference}</div>
                      <div className="text-[10px] text-neutral-400 font-sans">
                        Shipment: {pkg.shipmentRef} | Invoice: {pkg.invoiceNumber}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-white font-bold bg-[#121215] px-2 py-0.5 rounded border border-neutral-800">
                          {pkg.merkleRootHash.substring(0, 16)}...{pkg.merkleRootHash.substring(48)}
                        </span>
                        <button
                          onClick={() => handleCopy(pkg.merkleRootHash, pkg.id)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition"
                        >
                          {copiedHash === pkg.id ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 text-neutral-400 text-[11px]">
                      <div>{pkg.s3Bucket}</div>
                      <div className="text-[10px] text-neutral-500 truncate max-w-xs">{pkg.s3ObjectKey}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white border border-neutral-700">
                        {pkg.retentionMode}
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-white font-bold">
                      {pkg.retainUntilDate} (7 Yrs)
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#121215] text-neutral-400 border border-neutral-800">
                        {pkg.isLegalHoldActive ? 'ACTIVE' : 'OFF'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <button
                        onClick={() => setSelectedWormPackage(pkg)}
                        className="px-2.5 py-1 bg-[#121215] hover:bg-neutral-800 text-white rounded-lg text-[11px] font-medium border border-neutral-800 flex items-center gap-1 transition"
                      >
                        <Layers className="w-3 h-3 text-neutral-400" /> Inspect Bundle (5 Docs)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                  VERIFIED AUDITED INVOICE
                </span>
                <h3 className="text-xl font-serif text-white font-normal mt-0.5">{selectedInvoice.invoiceNumber}</h3>
                <div className="text-xs text-neutral-400 font-mono">PO: {selectedInvoice.customerPoNumber}</div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-neutral-400 hover:text-white text-sm font-bold bg-[#121215] p-1.5 rounded-lg border border-neutral-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#121215] p-3.5 rounded-xl border border-neutral-800 space-y-1">
                <span className="text-neutral-400 text-[10px] uppercase font-mono">Shipper Billing Contact</span>
                <div className="text-white font-bold">{selectedInvoice.shipperName}</div>
                <div className="text-neutral-400 font-mono">{selectedInvoice.shipperEmail}</div>
              </div>

              <div className="bg-[#121215] p-3.5 rounded-xl border border-neutral-800 space-y-2 font-mono">
                <span className="text-neutral-400 text-[10px] uppercase font-mono">Itemized Billing Summary</span>
                <div className="flex justify-between text-neutral-300">
                  <span>Line-Haul Freight Charge:</span>
                  <span>${selectedInvoice.linehaulAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Fuel Surcharge:</span>
                  <span>${selectedInvoice.fuelSurcharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Approved Accessorials:</span>
                  <span>${selectedInvoice.accessorials.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold pt-2 border-t border-neutral-800 text-sm">
                  <span>Net Total Amount:</span>
                  <span className="text-white">${selectedInvoice.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-[#121215] hover:bg-neutral-800 text-white font-medium text-xs rounded-xl border border-neutral-800"
              >
                Close
              </button>
              <a
                href={`/api/v1/invoices/${selectedInvoice.id}/pdf`}
                target="_blank"
                className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
              >
                <FileText className="w-3.5 h-3.5" /> Download PDF Invoice
              </a>
            </div>
          </div>
        </div>
      )}

      {selectedPod && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                  GEOTAGGED PROOF OF DELIVERY AUDIT
                </span>
                <h3 className="text-lg font-serif text-white font-normal mt-0.5">{selectedPod.shipmentRef}</h3>
                <div className="text-xs text-neutral-400">{selectedPod.consigneeName}</div>
              </div>
              <button
                onClick={() => setSelectedPod(null)}
                className="text-neutral-400 hover:text-white text-sm font-bold bg-[#121215] p-1.5 rounded-lg border border-neutral-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#121215] p-3.5 rounded-xl border border-neutral-800 space-y-2">
                <div className="text-neutral-400 text-[10px] font-mono uppercase">GPS &amp; EXIF Metadata</div>
                <div className="grid grid-cols-2 gap-2 font-mono text-neutral-300">
                  <div>Latitude: <span className="text-white font-bold">{selectedPod.gpsLat}° N</span></div>
                  <div>Longitude: <span className="text-white font-bold">{selectedPod.gpsLng}° W</span></div>
                  <div>Distance: <span className="text-white font-bold">{selectedPod.geofenceDistance}</span></div>
                  <div>Device: <span className="text-white font-bold">{selectedPod.device}</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setSelectedPod(null)}
                className="px-4 py-2 bg-[#121215] hover:bg-neutral-800 text-white font-medium text-xs rounded-xl border border-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedWormPackage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold text-white flex items-center gap-1">
                  <Lock className="w-3 h-3" /> FMCSA § 379 &amp; DOT 7-YEAR WORM VAULT
                </span>
                <h3 className="text-lg font-serif text-white font-normal mt-0.5">{selectedWormPackage.packageReference}</h3>
              </div>
              <button
                onClick={() => setSelectedWormPackage(null)}
                className="text-neutral-400 hover:text-white text-sm font-bold bg-[#121215] p-1.5 rounded-lg border border-neutral-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#121215] p-3.5 rounded-xl border border-neutral-800 space-y-1.5 font-mono">
                <div className="text-white text-[10px] uppercase font-mono">Merkle Root Seal (SHA-256)</div>
                <div className="text-white text-[11px] font-bold break-all bg-[#09090b] p-2 rounded.xl border border-neutral-800">
                  {selectedWormPackage.merkleRootHash}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setSelectedWormPackage(null)}
                className="px-4 py-2 bg-[#121215] hover:bg-neutral-800 text-white font-medium text-xs rounded-xl border border-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Use Case Modal */}
      {showUseCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowUseCaseModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-[#121215] text-neutral-400 hover:text-white border border-neutral-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-white font-mono text-[10px] font-bold">
                  Phase 4.1–5.6
                </span>
                <span className="text-xs text-neutral-400 font-mono">Settlement &amp; Dispute Desk</span>
              </div>
              <h3 className="text-2xl font-serif text-white font-normal">Broker Invoicing &amp; Re-Bill Dispute Desk</h3>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-300" /> What This Feature Does
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Triggers sub-60 second customer billing upon GPS-verified delivery, audits inbound carrier re-bills against rate confirmations, and manages 30-day FMCSA legal disputes.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#121215] border border-neutral-800 space-y-1.5">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-300" /> Why Freight Brokers Need It
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  Carriers overbill brokers on accessorials and re-weighs on 15% of shipments. Apex flags discrepancies against cryptographic rate locks, auto-generates legal dispute packages, and collects 20% contingency recovery fees.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="font-semibold text-white uppercase tracking-wider text-[10px] font-mono">
                  Key Automated Capabilities:
                </div>
                <div className="space-y-2">
                  {[
                    'Sub-60s customer invoice generation with attached geotagged POD & eBOL',
                    'Re-Bill line-item auditor comparing carrier bills to rate confirmations',
                    '30-day statutory FMCSA clock tracker with automated 49 CFR dispute packages',
                    '20% Recovery Billing contingency fee tracking on clawed-back carrier overcharges',
                    'FMCSA § 379 3-year compliance vault sealed with SHA-256 Merkle proofs',
                  ].map((b, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-neutral-300">
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-mono">Phase 4 &amp; 5 Settlement Desk</span>
              <button
                onClick={() => setShowUseCaseModal(false)}
                className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs rounded-xl shadow transition"
              >
                Got It, Return to Invoicing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const InvoiceManagementDashboard: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400 font-mono text-xs">Loading Invoicing &amp; Settlement Desk...</div>}>
      <InvoiceManagementDashboardContent />
    </Suspense>
  );
};
