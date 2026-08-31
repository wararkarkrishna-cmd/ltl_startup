-- ====================================================================================================================
-- MASTER LTL FREIGHT OPERATING SYSTEM & FINANCIAL ENGINE
-- MIGRATION: 001_initial_schema.sql
-- TARGET: PostgreSQL 14+ / Supabase with Row Level Security (RLS) & UUIDv7
-- ====================================================================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PostgreSQL UUIDv7 Native Function (RFC 9562)
CREATE OR REPLACE FUNCTION generate_uuid_v7()
RETURNS UUID AS 
DECLARE
  unix_time_ms BIGINT;
  retval UUID;
BEGIN
  unix_time_ms := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000);
  retval := (
    LPAD(TO_HEX(unix_time_ms), 12, '0') ||
    '7' ||
    SUBSTRING(TO_HEX(FLOOR(RANDOM() * 4096)::INT), 1, 3) ||
    LPAD(TO_HEX((8 + FLOOR(RANDOM() * 4)::INT)::INT), 1, '0') ||
    SUBSTRING(TO_HEX(FLOOR(RANDOM() * 4096)::INT), 1, 3) ||
    LPAD(TO_HEX(FLOOR(RANDOM() * 281474976710656)::BIGINT), 12, '0')
  )::UUID;
  RETURN retval;
END;
 LANGUAGE plpgsql VOLATILE;

-- 3. Core Multi-Tenant Organizations
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL UNIQUE,
    api_key_hash VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. User Profiles & Role-Based Access Control (RBAC)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'BROKER_AGENT',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_role CHECK (role IN ('OWNER', 'BROKER_AGENT', 'DISPATCHER', 'BILLING_SPECIALIST', 'READ_ONLY_AUDITOR')),
    CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email)
);

-- 5. Business Accounts (Shippers, Carriers, 3PLs, Factoring Companies)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL DEFAULT 'SHIPPER',
    mc_number VARCHAR(16),
    dot_number VARCHAR(16),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(32),
    billing_address_line1 VARCHAR(255),
    billing_city VARCHAR(128),
    billing_state VARCHAR(2),
    billing_zip VARCHAR(10),
    credit_limit_cents BIGINT NOT NULL DEFAULT 1000000, -- ,000.00
    payment_terms_days INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_account_type CHECK (account_type IN ('SHIPPER', 'CARRIER', '3PL', 'FACTORING'))
);

-- 6. Core Shipments Table
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipper_account_id UUID REFERENCES accounts(id),
    reference_number VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    
    -- Origin Details
    origin_name VARCHAR(255),
    origin_address1 VARCHAR(255) NOT NULL,
    origin_address2 VARCHAR(255),
    origin_city VARCHAR(128) NOT NULL,
    origin_state VARCHAR(2) NOT NULL,
    origin_zip VARCHAR(10) NOT NULL,
    origin_country VARCHAR(2) DEFAULT 'US',
    origin_contact_name VARCHAR(255),
    origin_contact_phone VARCHAR(32),

    -- Destination Details
    dest_name VARCHAR(255),
    dest_address1 VARCHAR(255) NOT NULL,
    dest_address2 VARCHAR(255),
    dest_city VARCHAR(128) NOT NULL,
    dest_state VARCHAR(2) NOT NULL,
    dest_zip VARCHAR(10) NOT NULL,
    dest_country VARCHAR(2) DEFAULT 'US',
    dest_contact_name VARCHAR(255),
    dest_contact_phone VARCHAR(32),

    -- Totals & Logistics
    total_pallets INT NOT NULL DEFAULT 1,
    total_weight_lbs NUMERIC(10,2) NOT NULL,
    total_linear_feet NUMERIC(6,2),
    total_cube_cuft NUMERIC(10,2),
    
    -- Dates & Scheduling
    pickup_date_ready DATE NOT NULL,
    pickup_time_start TIME,
    pickup_time_end TIME,
    delivery_date_target DATE,
    delivery_time_start TIME,
    delivery_time_end TIME,

    -- Metadata & Audit
    special_instructions TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_shipment_status CHECK (status IN (
        'DRAFT', 'EXTRACTED', 'QUOTED', 'TENDERED', 'DISPATCHED', 
        'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 
        'INVOICED', 'SETTLED', 'EXCEPTION', 'DISPUTED'
    )),
    CONSTRAINT chk_shipment_weight CHECK (total_weight_lbs > 0),
    CONSTRAINT chk_shipment_pallets CHECK (total_pallets >= 1),
    CONSTRAINT uq_tenant_ref_number UNIQUE (tenant_id, reference_number)
);

-- 7. Shipment Line Items (Pieces, Dimensions, Weights, PCF, NMFC)
CREATE TABLE shipment_items (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1,
    packaging_type VARCHAR(32) NOT NULL DEFAULT 'PALLET',
    length_in NUMERIC(6,2) NOT NULL,
    width_in NUMERIC(6,2) NOT NULL,
    height_in NUMERIC(6,2) NOT NULL,
    weight_lbs NUMERIC(10,2) NOT NULL,
    pcf_density NUMERIC(6,2),
    nmfc_class VARCHAR(8) NOT NULL DEFAULT '70',
    nmfc_code VARCHAR(16),
    commodity_description TEXT NOT NULL,
    is_stackable BOOLEAN NOT NULL DEFAULT FALSE,
    is_hazmat BOOLEAN NOT NULL DEFAULT FALSE,
    un_number VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_item_quantity CHECK (quantity >= 1),
    CONSTRAINT chk_item_dimensions CHECK (length_in > 0 AND width_in > 0 AND height_in > 0),
    CONSTRAINT chk_item_weight CHECK (weight_lbs > 0),
    CONSTRAINT chk_item_class CHECK (nmfc_class IN (
        '50', '55', '60', '65', '70', '77.5', '85', '92.5', '100', 
        '110', '125', '150', '175', '200', '250', '300', '400', '500'
    )),
    CONSTRAINT chk_packaging_type CHECK (packaging_type IN ('PALLET', 'CRATE', 'BOX', 'DRUM', 'ROLL', 'BUNDLE', 'OTHER'))
);

-- 8. Accessorial Master Dictionary
CREATE TABLE accessorial_lookups (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL DEFAULT 'DELIVERY',
    default_fee_cents BIGINT NOT NULL DEFAULT 7500, -- .00
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Shipment Accessorial Requests
CREATE TABLE shipment_accessorials (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    accessorial_code VARCHAR(32) NOT NULL REFERENCES accessorial_lookups(code),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shipment_accessorial UNIQUE (shipment_id, accessorial_code)
);

-- 10. Rate Quotes & Broker Margin Calculations
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    quote_number VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    selected_carrier_scac VARCHAR(8),
    total_carrier_cost_cents BIGINT NOT NULL,
    broker_margin_cents BIGINT NOT NULL,
    final_customer_price_cents BIGINT NOT NULL,
    pricing_rule_applied VARCHAR(64) DEFAULT 'DEFAULT_MARKUP',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_quote_status CHECK (status IN ('ACTIVE', 'ACCEPTED', 'EXPIRED', 'REJECTED'))
);

-- 11. Carrier Rate Quotes Returned from APIs / Tariffs
CREATE TABLE carrier_rates (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    carrier_scac VARCHAR(8) NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    service_level VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    transit_days INT NOT NULL DEFAULT 3,
    base_rate_cents BIGINT NOT NULL,
    fuel_surcharge_cents BIGINT NOT NULL,
    accessorials_total_cents BIGINT NOT NULL DEFAULT 0,
    total_rate_cents BIGINT NOT NULL,
    rate_source VARCHAR(32) NOT NULL DEFAULT 'BYOC_API',
    raw_response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rate_source CHECK (rate_source IN ('BYOC_API', 'WHOLESALE_TARIFF', 'MANUAL_SPOT'))
);

-- 12. Carrier API Credentials & BYOC Vault
CREATE TABLE carrier_credentials (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    carrier_scac VARCHAR(8) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    auth_type VARCHAR(32) NOT NULL DEFAULT 'API_KEY', -- API_KEY, OAUTH2, SOAP_CERT
    encrypted_credentials TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_carrier UNIQUE (tenant_id, carrier_scac)
);

-- 13. Carrier Final Settlement Invoices (EDI 210 / PDF Ingestion)
CREATE TABLE carrier_invoices (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    carrier_scac VARCHAR(8) NOT NULL,
    pro_number VARCHAR(64) NOT NULL,
    invoice_number VARCHAR(64) NOT NULL,
    total_billed_cents BIGINT NOT NULL,
    billed_weight_lbs NUMERIC(10,2),
    billed_class VARCHAR(8),
    invoice_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_AUDIT',
    raw_edi_or_ocr TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_invoice_status CHECK (status IN ('PENDING_AUDIT', 'MATCHED_CLEAN', 'DISCREPANCY_FLAGGED', 'DISPUTE_FILED', 'APPROVED_FOR_PAYMENT', 'SETTLED'))
);

-- 14. Carrier Discrepancy & Dispute Records
CREATE TABLE discrepancy_records (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    carrier_invoice_id UUID NOT NULL REFERENCES carrier_invoices(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    discrepancy_type VARCHAR(64) NOT NULL,
    quoted_cents BIGINT NOT NULL,
    billed_cents BIGINT NOT NULL,
    variance_cents BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'FLAGGED',
    dispute_package_pdf_path TEXT,
    evidence_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_discrepancy_type CHECK (discrepancy_type IN (
        'UNAUTHORIZED_REWEIGH', 'RECLASSIFICATION_DISPUTE', 
        'BOGUS_ACCESSORIAL', 'FUEL_INDEX_MISMATCH', 'DUPLICATE_BILLING'
    )),
    CONSTRAINT chk_dispute_status CHECK (status IN (
        'FLAGGED', 'DISPUTE_GENERATED', 'SUBMITTED', 'IN_REVIEW', 'CREDIT_ISSUED', 'DENIED', 'ESCALATED'
    ))
);

-- 15. Carrier QuickPay Payouts & Float Management
CREATE TABLE carrier_payouts (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    carrier_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    gross_amount_cents BIGINT NOT NULL,
    quickpay_fee_percent NUMERIC(4,2) NOT NULL DEFAULT 2.00,
    quickpay_fee_cents BIGINT NOT NULL,
    net_payout_cents BIGINT NOT NULL,
    payout_rail VARCHAR(32) NOT NULL DEFAULT 'SAME_DAY_ACH',
    payout_status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    initiated_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_payout_rail CHECK (payout_rail IN ('INSTANT_RTP', 'FEDNOW', 'SAME_DAY_ACH', 'STANDARD_ACH', 'CHECK')),
    CONSTRAINT chk_payout_status CHECK (payout_status IN ('SCHEDULED', 'PROCESSING', 'SETTLED', 'FAILED', 'REVERSED'))
);

-- 16. Double-Entry Financial Ledger
CREATE TABLE financial_ledger_entries (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    transaction_id UUID NOT NULL,
    account_type VARCHAR(32) NOT NULL,
    entry_type VARCHAR(6) NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ledger_account CHECK (account_type IN ('CARRIER_PAYABLE', 'SHIPPER_RECEIVABLE', 'QUICKPAY_REVENUE', 'CASH_ESCROW', 'DISPUTE_RECOVERY')),
    CONSTRAINT chk_ledger_entry_type CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    CONSTRAINT chk_ledger_currency CHECK (currency IN ('USD', 'CAD')),
    CONSTRAINT chk_ledger_amount CHECK (amount_cents > 0)
);

-- 17. Immutable Audit Trail & CDC Events
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(128) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    source VARCHAR(32) NOT NULL DEFAULT 'AI_EXTRACTOR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_audit_source CHECK (source IN ('AI_EXTRACTOR', 'USER_OVERRIDE', 'SYSTEM', 'CARRIER_EDI', 'DISPUTE_BOT'))
);

-- 18. Multi-Modal Ingestion Documents
CREATE TABLE ingestion_documents (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    source_channel VARCHAR(32) NOT NULL DEFAULT 'UPLOAD',
    extraction_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    raw_extracted_text TEXT,
    extracted_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_source_channel CHECK (source_channel IN ('UPLOAD', 'EMAIL_WEBHOOK', 'RAW_TEXT', 'API')),
    CONSTRAINT chk_doc_extraction_status CHECK (extraction_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

-- ====================================================================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING & COMPLIANCE
-- ====================================================================================================================
CREATE INDEX idx_shipments_tenant_status ON shipments(tenant_id, status);
CREATE INDEX idx_shipments_created_at ON shipments(created_at DESC);
CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX idx_quotes_shipment ON quotes(shipment_id);
CREATE INDEX idx_carrier_rates_quote ON carrier_rates(quote_id);
CREATE INDEX idx_carrier_invoices_pro ON carrier_invoices(carrier_scac, pro_number);
CREATE INDEX idx_ledger_transaction ON financial_ledger_entries(transaction_id);
CREATE INDEX idx_audit_shipment ON audit_events(shipment_id, created_at DESC);
CREATE INDEX idx_ingestion_sha256 ON ingestion_documents(tenant_id, sha256_hash);

-- ====================================================================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_accessorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE discrepancy_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_accounts ON accounts
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_shipments ON shipments
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_shipment_items ON shipment_items
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_quotes ON quotes
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_carrier_rates ON carrier_rates
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_carrier_invoices ON carrier_invoices
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_discrepancies ON discrepancy_records
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_carrier_payouts ON carrier_payouts
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_ledger ON financial_ledger_entries
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_audit ON audit_events
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY tenant_isolation_docs ON ingestion_documents
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
