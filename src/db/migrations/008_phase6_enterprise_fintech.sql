-- ============================================================================
-- Phase 6.5 - 6.8: Advanced Financial Float, Factoring NOA, & SOC2 Compliance
-- ============================================================================

-- Bank Statements for Daily Statement Reconciliation (Phase 6.5)
CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    statement_date DATE NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    account_number_masked VARCHAR(32) NOT NULL,
    opening_balance_cents BIGINT NOT NULL,
    closing_balance_cents BIGINT NOT NULL,
    total_debits_cents BIGINT NOT NULL DEFAULT 0,
    total_credits_cents BIGINT NOT NULL DEFAULT 0,
    feed_format VARCHAR(32) NOT NULL DEFAULT 'PLAID_STREAM', -- BAI2, CAMT053, MT940, PLAID_STREAM, STRIPE_FEED
    reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'UNRECONCILED', -- UNRECONCILED, PARTIALLY_RECONCILED, FULLY_RECONCILED, DISCREPANCY_FLAGGED
    unreconciled_variance_cents BIGINT NOT NULL DEFAULT 0,
    reconciled_at TIMESTAMPTZ,
    reconciled_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank Statement Cleared Lines (Phase 6.5)
CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    value_date DATE NOT NULL,
    amount_cents BIGINT NOT NULL,
    entry_type VARCHAR(6) NOT NULL, -- DEBIT, CREDIT
    bank_reference_number VARCHAR(128),
    description TEXT NOT NULL,
    match_status VARCHAR(32) NOT NULL DEFAULT 'UNMATCHED', -- UNMATCHED, MATCHED, PROVISIONAL, TIMING_DIFFERENCE
    matched_ledger_entry_id UUID REFERENCES financial_ledger_entries(id),
    matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Factoring Companies Directory (Phase 6.6)
CREATE TABLE IF NOT EXISTS factoring_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_name VARCHAR(128) NOT NULL,
    remittance_email VARCHAR(255) NOT NULL,
    remittance_phone VARCHAR(32),
    lockbox_address TEXT NOT NULL,
    routing_number VARCHAR(32) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    api_endpoint VARCHAR(255),
    supports_electronic_waiver BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Carrier Notice of Assignment (NOA) Records (Phase 6.6)
CREATE TABLE IF NOT EXISTS carrier_noa_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    carrier_scac VARCHAR(10) NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    dot_number VARCHAR(32),
    mc_number VARCHAR(32),
    tax_id_ein VARCHAR(32),
    factoring_company_id UUID NOT NULL REFERENCES factoring_companies(id),
    noa_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, CONDITIONAL_WAIVER, REVOKED
    effective_date DATE NOT NULL,
    termination_date DATE,
    noa_document_url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QuickPay Factoring Waiver Agreements (Phase 6.6)
CREATE TABLE IF NOT EXISTS factoring_waivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    carrier_scac VARCHAR(10) NOT NULL,
    factoring_company_id UUID NOT NULL REFERENCES factoring_companies(id),
    waiver_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED', -- PENDING, APPROVED, REJECTED, EXPIRED
    authorized_by VARCHAR(128) NOT NULL,
    authorization_code VARCHAR(64) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SOC2 Continuous Compliance & Security Audit Logs (Phase 6.8)
CREATE TABLE IF NOT EXISTS soc2_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    criteria_code VARCHAR(32) NOT NULL, -- CC6.1, CC6.6, CC6.7, CC7.2, CC8.1
    control_name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL, -- PASS, WARNING, FAIL
    details JSONB NOT NULL,
    evidence_hash VARCHAR(64) NOT NULL,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index optimizations
CREATE INDEX IF NOT EXISTS idx_bank_statements_tenant_date ON bank_statements(tenant_id, statement_date);
CREATE INDEX IF NOT EXISTS idx_bank_lines_statement_id ON bank_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_carrier_noa_scac ON carrier_noa_records(tenant_id, carrier_scac);
CREATE INDEX IF NOT EXISTS idx_factoring_waivers_shipment ON factoring_waivers(tenant_id, shipment_id);
CREATE INDEX IF NOT EXISTS idx_soc2_logs_tenant ON soc2_audit_logs(tenant_id, assessed_at DESC);
