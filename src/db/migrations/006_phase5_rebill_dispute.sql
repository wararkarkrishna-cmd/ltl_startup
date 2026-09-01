-- ==============================================================================
-- PHASE 5.1: RE-BILL AUDITING, CARRIER INVOICES & DISPUTE RECOVERY SCHEMA
-- ==============================================================================

-- 1. Carrier Invoices (Ingested via EDI 210, PDF OCR, or Manual Entry)
CREATE TABLE IF NOT EXISTS carrier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    carrier_code VARCHAR(32) NOT NULL,
    carrier_scac VARCHAR(10) NOT NULL,
    carrier_name VARCHAR(128),
    carrier_invoice_number VARCHAR(64) NOT NULL,
    pro_number VARCHAR(64) NOT NULL,
    bol_number VARCHAR(64),
    invoiced_linehaul_cents BIGINT NOT NULL DEFAULT 0,
    invoiced_fuel_cents BIGINT NOT NULL DEFAULT 0,
    invoiced_accessorial_cents BIGINT NOT NULL DEFAULT 0,
    invoiced_accessorial_breakdown JSONB DEFAULT '[]'::jsonb,
    invoiced_total_cents BIGINT NOT NULL,
    invoiced_weight_lbs NUMERIC(10,2),
    invoiced_class VARCHAR(16),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'AUDITED_CLEAN', 'DISCREPANCY_FLAGGED', 'DISPUTED', 'SETTLED', 'PAID'
    raw_edi_payload TEXT,
    raw_ocr_text TEXT,
    source_format VARCHAR(16) NOT NULL DEFAULT 'EDI_210', -- 'EDI_210', 'PDF_OCR', 'MANUAL'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Discrepancy Records (Line-item rate deviations & audit variances)
CREATE TABLE IF NOT EXISTS discrepancy_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    carrier_invoice_id UUID NOT NULL REFERENCES carrier_invoices(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    discrepancy_type VARCHAR(32) NOT NULL, -- 'UNAUTHORIZED_REWEIGH', 'RECLASSIFICATION_DISPUTE', 'BOGUS_ACCESSORIAL', 'FUEL_INDEX_MISMATCH', 'DUPLICATE_BILLING', 'INCORRECT_RATE_BASE', 'OTHER'
    delta_total_cents BIGINT NOT NULL,
    delta_linehaul_cents BIGINT NOT NULL DEFAULT 0,
    delta_fuel_cents BIGINT NOT NULL DEFAULT 0,
    delta_accessorial_cents BIGINT NOT NULL DEFAULT 0,
    delta_weight_lbs NUMERIC(10,2),
    delta_class_bump VARCHAR(32),
    quoted_expected_rate_cents BIGINT NOT NULL DEFAULT 0,
    carrier_invoiced_rate_cents BIGINT NOT NULL DEFAULT 0,
    discrepancy_description TEXT NOT NULL,
    confidence_score NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    is_disputable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Carrier Disputes (Lifecycle tracking for claims and credit memos)
CREATE TABLE IF NOT EXISTS carrier_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    carrier_invoice_id UUID NOT NULL REFERENCES carrier_invoices(id) ON DELETE CASCADE,
    discrepancy_id UUID REFERENCES discrepancy_records(id) ON DELETE SET NULL,
    dispute_reference_number VARCHAR(64) NOT NULL,
    carrier_scac VARCHAR(10) NOT NULL,
    carrier_pro_number VARCHAR(64) NOT NULL,
    disputed_amount_cents BIGINT NOT NULL,
    dispute_status VARCHAR(32) NOT NULL DEFAULT 'FLAGGED', -- 'FLAGGED', 'DISPUTE_GENERATED', 'SUBMITTED', 'IN_REVIEW', 'CREDIT_ISSUED', 'DENIED', 'ESCALATED'
    carrier_contact_email VARCHAR(255),
    dispute_packet_pdf_url TEXT,
    dispute_letter_text TEXT,
    rebuttal_evidence_bundle JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    credit_memo_number VARCHAR(64),
    recovered_amount_cents BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_carrier_invoices_tenant_shipment ON carrier_invoices(tenant_id, shipment_id);
CREATE INDEX IF NOT EXISTS idx_carrier_invoices_pro ON carrier_invoices(tenant_id, pro_number);
CREATE INDEX IF NOT EXISTS idx_carrier_invoices_status ON carrier_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_carrier_invoices_invoice_no ON carrier_invoices(tenant_id, carrier_invoice_number);

CREATE INDEX IF NOT EXISTS idx_discrepancy_records_invoice ON discrepancy_records(tenant_id, carrier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_records_shipment ON discrepancy_records(tenant_id, shipment_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_records_type ON discrepancy_records(tenant_id, discrepancy_type);

CREATE INDEX IF NOT EXISTS idx_carrier_disputes_tenant_status ON carrier_disputes(tenant_id, dispute_status);
CREATE INDEX IF NOT EXISTS idx_carrier_disputes_invoice ON carrier_disputes(tenant_id, carrier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_carrier_disputes_shipment ON carrier_disputes(tenant_id, shipment_id);
CREATE INDEX IF NOT EXISTS idx_carrier_disputes_ref ON carrier_disputes(tenant_id, dispute_reference_number);
