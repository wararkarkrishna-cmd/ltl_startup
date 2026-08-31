-- ====================================================================================================================
-- MASTER LTL FREIGHT OPERATING SYSTEM & FINANCIAL ENGINE
-- MIGRATION: 003_phase2_phase3_tables.sql
-- TARGET: PostgreSQL 14+ / Supabase (Phase 2 & Phase 3 Extensions)
-- ====================================================================================================================

-- 1. Dynamic Margin Rules
CREATE TABLE IF NOT EXISTS margin_rules (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    rule_type VARCHAR(32) NOT NULL, -- CUSTOMER_CONTRACT, LANE, WEIGHT_TIER, GLOBAL_DEFAULT
    customer_id UUID REFERENCES accounts(id),
    origin_state VARCHAR(2),
    dest_state VARCHAR(2),
    min_weight_lbs NUMERIC(10,2),
    max_weight_lbs NUMERIC(10,2),
    markup_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    flat_fee_cents BIGINT NOT NULL DEFAULT 0,
    min_margin_cents BIGINT NOT NULL DEFAULT 7500, -- $75.00 floor
    priority INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Deterministic Rate Caching
CREATE TABLE IF NOT EXISTS rate_cache (
    cache_key VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    carrier_scac VARCHAR(8) NOT NULL,
    account_type VARCHAR(32) NOT NULL,
    response_payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Electronic Carrier Tenders (REST & EDI 204/990)
CREATE TABLE IF NOT EXISTS carrier_tenders (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    quote_id UUID REFERENCES quotes(id) ON DELETE RESTRICT,
    carrier_code VARCHAR(32) NOT NULL,
    carrier_scac VARCHAR(10) NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    tender_method VARCHAR(32) NOT NULL DEFAULT 'DIRECT_API',
    tender_status VARCHAR(32) NOT NULL DEFAULT 'TENDER_ACCEPTED',
    pro_number VARCHAR(64),
    pickup_confirmation_number VARCHAR(64),
    raw_edi_204_payload TEXT,
    raw_edi_990_response TEXT,
    tendered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- 4. Standardized VICS Digital BOL (eBOL)
CREATE TABLE IF NOT EXISTS digital_bols (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    bol_number VARCHAR(64) NOT NULL,
    master_bol_number VARCHAR(64) NOT NULL,
    pro_number VARCHAR(64),
    carrier_code VARCHAR(32) NOT NULL,
    carrier_scac VARCHAR(10) NOT NULL,
    trailer_number VARCHAR(64),
    seal_number VARCHAR(64),
    special_instructions TEXT,
    freight_charge_term VARCHAR(32) NOT NULL DEFAULT 'PREPAID',
    shipper_signature TEXT,
    carrier_signature TEXT,
    emergency_contact VARCHAR(128) NOT NULL DEFAULT 'CHEMTREC: 1-800-424-9300',
    barcode_data TEXT NOT NULL,
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 1-Click Quote Action Tokens
CREATE TABLE IF NOT EXISTS quote_action_tokens (
    token VARCHAR(255) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES accounts(id),
    quoted_price_cents BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    booked_by_ip VARCHAR(64),
    po_number VARCHAR(64)
);

-- 6. Carrier Rate Confirmation Contracts
CREATE TABLE IF NOT EXISTS rate_confirmations (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    rate_confirmation_number VARCHAR(64) NOT NULL,
    carrier_code VARCHAR(32) NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    carrier_scac VARCHAR(10) NOT NULL,
    agreed_linehaul_cents BIGINT NOT NULL,
    agreed_fuel_cents BIGINT NOT NULL,
    agreed_accessorial_cents BIGINT NOT NULL,
    total_agreed_rate_cents BIGINT NOT NULL,
    pickup_number VARCHAR(64) NOT NULL,
    pickup_date VARCHAR(32) NOT NULL,
    delivery_date_est VARCHAR(32) NOT NULL,
    special_instructions TEXT,
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Port Transload & Deconsolidation Containers
CREATE TABLE IF NOT EXISTS transload_containers (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    container_number VARCHAR(32) NOT NULL,
    vessel_name VARCHAR(128) NOT NULL,
    port_of_discharge VARCHAR(64) NOT NULL,
    steamship_line VARCHAR(64) NOT NULL,
    last_free_day DATE NOT NULL,
    staging_lane VARCHAR(32) NOT NULL,
    seal_number VARCHAR(64) NOT NULL,
    total_cartons INT NOT NULL,
    total_pallets_devanned INT NOT NULL,
    total_gross_weight_lbs NUMERIC(10,2) NOT NULL,
    outbound_shipment_ids UUID[] DEFAULT ARRAY[]::UUID[],
    status VARCHAR(32) NOT NULL DEFAULT 'IN_BOUND',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Carrier Vetting & FMCSA Safety Validation
CREATE TABLE IF NOT EXISTS carrier_vetting_records (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    carrier_code VARCHAR(32) NOT NULL,
    carrier_scac VARCHAR(10) NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    dot_number VARCHAR(32) NOT NULL,
    mc_number VARCHAR(32) NOT NULL,
    operating_authority_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    safety_rating VARCHAR(32) NOT NULL DEFAULT 'SATISFACTORY',
    auto_liability_coverage_cents BIGINT NOT NULL,
    cargo_insurance_coverage_cents BIGINT NOT NULL,
    driver_oos_rate_percent NUMERIC(5,2) NOT NULL,
    vehicle_oos_rate_percent NUMERIC(5,2) NOT NULL,
    is_approved_for_dispatch BOOLEAN NOT NULL DEFAULT TRUE,
    rejection_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
    vetted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
