-- ==============================================================================
-- PHASE 4.5 TO 4.8: ACCOUNTING, COMMISSION, AR AGING & WORM AUDIT VAULT SCHEMA
-- ==============================================================================

-- 1. Accounting Connections & OAuth2 Vault
CREATE TABLE IF NOT EXISTS accounting_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL, -- 'QUICKBOOKS_ONLINE', 'XERO', 'NETSUITE', 'GENERIC_ERP'
    realm_id VARCHAR(64),
    company_name VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    gl_freight_revenue_account_id VARCHAR(64) DEFAULT '4000',
    gl_carrier_expense_account_id VARCHAR(64) DEFAULT '5000',
    gl_accounts_receivable_account_id VARCHAR(64) DEFAULT '1200',
    gl_accounts_payable_account_id VARCHAR(64) DEFAULT '2000',
    sync_settings JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Accounting Sync Ledger (Idempotent Transaction Logs)
CREATE TABLE IF NOT EXISTS accounting_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES accounting_connections(id) ON DELETE SET NULL,
    sync_type VARCHAR(32) NOT NULL, -- 'AR_INVOICE', 'AP_BILL', 'PAYMENT_RECON', 'CUSTOMER_SYNC', 'VENDOR_SYNC'
    entity_id UUID NOT NULL, -- invoice_id, shipment_id, quote_id
    reference_number VARCHAR(64) NOT NULL,
    external_platform_id VARCHAR(128),
    external_sync_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'FAILED', 'SKIPPED'
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sales Representatives & Profit Quotas
CREATE TABLE IF NOT EXISTS sales_reps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    default_commission_tier_id VARCHAR(64) DEFAULT 'STANDARD_TIER',
    base_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    monthly_profit_quota_cents BIGINT DEFAULT 1000000, -- $10,000.00
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Broker Commission Records & Payout Ledger
CREATE TABLE IF NOT EXISTS commission_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES customer_invoices(id) ON DELETE SET NULL,
    sales_rep_id UUID NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,
    customer_invoiced_cents BIGINT NOT NULL,
    carrier_settlement_cents BIGINT NOT NULL,
    realized_gross_profit_cents BIGINT NOT NULL,
    realized_margin_percent NUMERIC(5,2) NOT NULL,
    applied_commission_percent NUMERIC(5,2) NOT NULL,
    commission_earned_cents BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACCRUED', -- 'ACCRUED', 'APPROVED', 'PAID', 'CLAWED_BACK'
    notes TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Automated AR Aging & Dunning Logs
CREATE TABLE IF NOT EXISTS dunning_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
    customer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    dunning_stage VARCHAR(32) NOT NULL, -- 'REMINDER_T_MINUS_5', 'DUE_TODAY_T_0', 'PAST_DUE_T_PLUS_7', 'URGENT_T_PLUS_14', 'FINAL_DEMAND_T_PLUS_30'
    days_past_due INT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_snippet TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'DISPATCHED', -- 'QUEUED', 'DISPATCHED', 'FAILED', 'PAUSED_DISPUTE'
    credit_hold_triggered BOOLEAN NOT NULL DEFAULT false,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Settlement Document Vault & S3 WORM Compliance Packages
CREATE TABLE IF NOT EXISTS worm_audit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES customer_invoices(id) ON DELETE SET NULL,
    package_reference VARCHAR(64) NOT NULL,
    bundle_manifest JSONB NOT NULL,
    merkle_root_hash VARCHAR(64) NOT NULL, -- SHA-256
    s3_bucket VARCHAR(128) NOT NULL,
    s3_object_key VARCHAR(255) NOT NULL,
    s3_version_id VARCHAR(128),
    retention_mode VARCHAR(32) NOT NULL DEFAULT 'COMPLIANCE', -- 'COMPLIANCE', 'GOVERNANCE'
    retain_until_date TIMESTAMPTZ NOT NULL, -- 7-Year DOT / FMCSA WORM retention
    is_legal_hold_active BOOLEAN NOT NULL DEFAULT false,
    sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-throughput billing and settlement queries
CREATE INDEX IF NOT EXISTS idx_accounting_sync_logs_tenant_entity ON accounting_sync_logs(tenant_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_logs_status ON accounting_sync_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_records_rep ON commission_records(tenant_id, sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_shipment ON commission_records(tenant_id, shipment_id);
CREATE INDEX IF NOT EXISTS idx_dunning_records_invoice ON dunning_records(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_worm_audit_packages_shipment ON worm_audit_packages(tenant_id, shipment_id);
