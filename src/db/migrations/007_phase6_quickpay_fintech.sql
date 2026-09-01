-- ==============================================================================
-- PHASE 6: EMBEDDED CARRIER QUICKPAY FINTECH RAILS & DOUBLE-ENTRY FINANCIAL LEDGER
-- ==============================================================================

-- 1. Carrier QuickPay Tokens (Tokenized 1-Click Access)
CREATE TABLE IF NOT EXISTS quickpay_tokens (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    carrier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    carrier_scac VARCHAR(10) NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    gross_amount_cents BIGINT NOT NULL,
    default_tier VARCHAR(32) NOT NULL DEFAULT 'INSTANT_SAME_DAY',
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    used_by_ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quickpay_tokens_token ON quickpay_tokens(token);
CREATE INDEX IF NOT EXISTS idx_quickpay_tokens_shipment ON quickpay_tokens(shipment_id);

-- 2. Carrier QuickPay Payout Records
CREATE TABLE IF NOT EXISTS carrier_payouts (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    carrier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    quickpay_token_id UUID REFERENCES quickpay_tokens(id) ON DELETE SET NULL,
    
    carrier_scac VARCHAR(10) NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    pro_number VARCHAR(64),
    
    selected_tier VARCHAR(32) NOT NULL DEFAULT 'INSTANT_SAME_DAY',
    payout_rail VARCHAR(32) NOT NULL DEFAULT 'INSTANT_RTP',
    
    gross_amount_cents BIGINT NOT NULL,
    fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 2.50,
    fee_amount_cents BIGINT NOT NULL,
    net_payout_cents BIGINT NOT NULL,
    
    banking_provider VARCHAR(32) NOT NULL DEFAULT 'STRIPE_TREASURY',
    external_disbursement_id VARCHAR(128),
    destination_bank_name VARCHAR(128),
    destination_routing_masked VARCHAR(16),
    destination_account_masked VARCHAR(16),
    
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    initiated_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_qp_tier CHECK (selected_tier IN ('INSTANT_SAME_DAY', 'NEXT_DAY_ACH', 'STANDARD_NET_30')),
    CONSTRAINT chk_qp_rail CHECK (payout_rail IN ('INSTANT_RTP', 'FEDNOW', 'SAME_DAY_ACH', 'STANDARD_ACH', 'PUSH_TO_CARD', 'CHECK')),
    CONSTRAINT chk_qp_status CHECK (status IN ('SCHEDULED', 'PROCESSING', 'SETTLED', 'FAILED', 'REVERSED'))
);

CREATE INDEX IF NOT EXISTS idx_carrier_payouts_tenant ON carrier_payouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carrier_payouts_shipment ON carrier_payouts(shipment_id);
CREATE INDEX IF NOT EXISTS idx_carrier_payouts_status ON carrier_payouts(status);

-- 3. Electronic Receivable Assignment Micro-Contracts (E-SIGN Act Compliant)
CREATE TABLE IF NOT EXISTS quickpay_agreements (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    payout_id UUID NOT NULL REFERENCES carrier_payouts(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    
    agreement_reference VARCHAR(64) NOT NULL UNIQUE,
    signer_name VARCHAR(128) NOT NULL,
    signer_title VARCHAR(128) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signer_ip VARCHAR(64) NOT NULL,
    signer_user_agent TEXT,
    
    gross_amount_cents BIGINT NOT NULL,
    discount_fee_cents BIGINT NOT NULL,
    net_settlement_cents BIGINT NOT NULL,
    
    agreement_sha256_hash VARCHAR(64) NOT NULL,
    legal_contract_terms TEXT NOT NULL,
    pdf_document_url TEXT,
    
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quickpay_agreements_payout ON quickpay_agreements(payout_id);

-- 4. IRS Form 1099-NEC Annual Tax Document Records
CREATE TABLE IF NOT EXISTS form_1099_records (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    carrier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    
    tax_year INT NOT NULL,
    carrier_name VARCHAR(128) NOT NULL,
    carrier_tin_ein VARCHAR(32) NOT NULL,
    carrier_address TEXT NOT NULL,
    
    box1_nonemployee_compensation_cents BIGINT NOT NULL,
    box4_federal_tax_withheld_cents BIGINT NOT NULL DEFAULT 0,
    total_payout_count INT NOT NULL DEFAULT 1,
    
    is_threshold_met BOOLEAN NOT NULL DEFAULT TRUE, -- >= $600.00
    filing_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    generated_pdf_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_1099_filing_status CHECK (filing_status IN ('DRAFT', 'READY_TO_FILE', 'FILED_IRS', 'CORRECTED'))
);

CREATE INDEX IF NOT EXISTS idx_form_1099_tax_year ON form_1099_records(tax_year);
CREATE INDEX IF NOT EXISTS idx_form_1099_carrier ON form_1099_records(carrier_account_id);
