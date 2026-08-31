-- ====================================================================================================================
-- MASTER LTL FREIGHT OPERATING SYSTEM & FINANCIAL ENGINE
-- MIGRATION: 001_phase1_schema.sql (Strict phases.md Blueprint)
-- TARGET: PostgreSQL 14+ / Supabase with Row Level Security (RLS) & Generated Discrepancy Columns
-- ====================================================================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Core Schema: Tenants & Organizations
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    mc_number VARCHAR(50),
    dot_number VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RFQ Ingestion Table
CREATE TABLE IF NOT EXISTS rfqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- 'EMAIL', 'PDF_UPLOAD', 'SPREADSHEET', 'MANUAL', 'API'
    raw_document_url TEXT,
    raw_text TEXT,
    confidence_score NUMERIC(5,4),
    status VARCHAR(50) DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'VERIFIED', 'QUOTED', 'EXPIRED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Shipments & Split Parent-Child Hierarchy
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_id UUID REFERENCES rfqs(id),
    parent_shipment_id UUID REFERENCES shipments(id), -- Nullable: populated for split child shipments
    is_split BOOLEAN DEFAULT FALSE,
    pro_number VARCHAR(100),
    bol_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'UNASSIGNED',
    
    -- Origin & Destination
    origin_zip VARCHAR(20) NOT NULL,
    origin_city VARCHAR(100),
    origin_state VARCHAR(50),
    origin_is_residential BOOLEAN DEFAULT FALSE,
    dest_zip VARCHAR(20) NOT NULL,
    dest_city VARCHAR(100),
    dest_state VARCHAR(50),
    dest_is_residential BOOLEAN DEFAULT FALSE,
    
    -- Metrics
    total_handling_units INT NOT NULL,
    total_weight_lbs NUMERIC(10,2) NOT NULL,
    total_volume_cuft NUMERIC(10,2) NOT NULL,
    calculated_pcf NUMERIC(8,2) NOT NULL,
    declared_class NUMERIC(5,1),
    recommended_class NUMERIC(5,1),
    linear_feet NUMERIC(6,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Line Items & Handling Units
CREATE TABLE IF NOT EXISTS shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    packaging_type VARCHAR(50) NOT NULL, -- 'PALLET', 'SKID', 'CRATE', 'DRUM', 'BOX', 'LOOSE'
    handling_units INT NOT NULL DEFAULT 1,
    length_inches NUMERIC(8,2) NOT NULL,
    width_inches NUMERIC(8,2) NOT NULL,
    height_inches NUMERIC(8,2) NOT NULL,
    weight_lbs NUMERIC(10,2) NOT NULL,
    density_pcf NUMERIC(8,2) NOT NULL,
    nmfc_class NUMERIC(5,1) NOT NULL,
    commodity_description TEXT,
    is_hazardous BOOLEAN DEFAULT FALSE
);

-- 5. Carrier Quotes
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    carrier_name VARCHAR(100) NOT NULL,
    carrier_scac VARCHAR(10) NOT NULL,
    quote_type VARCHAR(50) NOT NULL, -- 'BYOC_DIRECT', 'PLATFORM_WHOLESALE', 'SMC3_TARIFF'
    carrier_rate_quote_id VARCHAR(100),
    
    linehaul_cost NUMERIC(10,2) NOT NULL,
    fuel_surcharge NUMERIC(10,2) NOT NULL,
    accessorial_cost NUMERIC(10,2) NOT NULL,
    total_carrier_cost NUMERIC(10,2) NOT NULL,
    
    applied_margin_amount NUMERIC(10,2) NOT NULL,
    quoted_customer_price NUMERIC(10,2) NOT NULL,
    transit_days INT,
    is_selected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Carrier Invoices & Discrepancies (Re-Bill Engine)
CREATE TABLE IF NOT EXISTS carrier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    carrier_scac VARCHAR(10) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    raw_edi_210 TEXT,
    
    invoiced_linehaul NUMERIC(10,2) NOT NULL,
    invoiced_fuel NUMERIC(10,2) NOT NULL,
    invoiced_accessorials NUMERIC(10,2) NOT NULL,
    total_invoiced_amount NUMERIC(10,2) NOT NULL,
    expected_carrier_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    
    discrepancy_amount NUMERIC(10,2) GENERATED ALWAYS AS (total_invoiced_amount - expected_carrier_cost) STORED,
    discrepancy_reason VARCHAR(100), -- 'REWEIGH', 'RECLASS', 'UNAUTHORIZED_LIFTGATE', 'DETENTION'
    status VARCHAR(50) DEFAULT 'AUDITED', -- 'CLEAN', 'DISCREPANCY_FLAGGED', 'DISPUTED', 'SETTLED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Dispute Recovery Ledger
CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_invoice_id UUID REFERENCES carrier_invoices(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    disputed_amount NUMERIC(10,2) NOT NULL,
    recovered_amount NUMERIC(10,2) DEFAULT 0.00,
    contingency_fee_rate NUMERIC(4,2) DEFAULT 0.20, -- 20%
    platform_contingency_fee NUMERIC(10,2) GENERATED ALWAYS AS (recovered_amount * contingency_fee_rate) STORED,
    evidence_bundle_url TEXT,
    status VARCHAR(50) DEFAULT 'SUBMITTED', -- 'SUBMITTED', 'APPROVED', 'REJECTED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- 8. QuickPay & Payout Ledger
CREATE TABLE IF NOT EXISTS quickpay_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    carrier_scac VARCHAR(10) NOT NULL,
    gross_payable_amount NUMERIC(10,2) NOT NULL,
    quickpay_discount_fee_pct NUMERIC(4,2) DEFAULT 0.020, -- 2.0%
    quickpay_fee_amount NUMERIC(10,2) NOT NULL,
    net_payout_amount NUMERIC(10,2) NOT NULL,
    payout_method VARCHAR(50) DEFAULT 'SAME_DAY_ACH',
    payout_status VARCHAR(50) DEFAULT 'INITIATED', -- 'INITIATED', 'SETTLED', 'FAILED'
    payout_reference_id VARCHAR(100),
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- 9. Immutable Cryptographic Audit Ledger
CREATE TABLE IF NOT EXISTS shipment_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID,
    actor_type VARCHAR(50) NOT NULL, -- 'SYSTEM_AI', 'BROKER', 'CARRIER_EDI', 'DRIVER_POD'
    event_payload JSONB NOT NULL,
    previous_event_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
