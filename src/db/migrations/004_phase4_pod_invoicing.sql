-- ====================================================================================================================
-- MASTER LTL FREIGHT OPERATING SYSTEM & FINANCIAL ENGINE
-- MIGRATION: 004_phase4_pod_invoicing.sql
-- TARGET: PostgreSQL 14+ / Supabase (Phase 4: Geotagged POD Capture, Settlement & Customer Invoicing)
-- ====================================================================================================================

-- 1. POD Mobile Upload Action Tokens (Secure tokenized URLs for drivers)
CREATE TABLE IF NOT EXISTS pod_tokens (
    token VARCHAR(255) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    carrier_code VARCHAR(32),
    driver_phone VARCHAR(32),
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Proof of Delivery (POD) Records & Geotagged Verification
CREATE TABLE IF NOT EXISTS pod_records (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    pod_token VARCHAR(255) REFERENCES pod_tokens(token),
    
    -- Image and Document Data
    image_url TEXT NOT NULL,
    image_hash VARCHAR(64) NOT NULL, -- SHA-256 integrity hash
    file_size_bytes BIGINT NOT NULL,
    
    -- Consignee Receipt Info
    consignee_name VARCHAR(255) NOT NULL,
    consignee_signature_data_url TEXT,
    received_pieces INT NOT NULL,
    expected_pieces INT NOT NULL,
    
    -- EXIF GPS & Device Metadata
    gps_latitude NUMERIC(10, 6),
    gps_longitude NUMERIC(10, 6),
    photo_timestamp TIMESTAMPTZ,
    device_model VARCHAR(128),
    image_orientation INT DEFAULT 1,
    
    -- Geofence Verification
    dest_latitude NUMERIC(10, 6),
    dest_longitude NUMERIC(10, 6),
    geofence_distance_miles NUMERIC(8, 3),
    is_within_geofence BOOLEAN NOT NULL DEFAULT TRUE,
    geofence_warning TEXT,
    
    -- OCR & Document Verification
    ocr_raw_text TEXT,
    ocr_confidence NUMERIC(5, 2),
    signature_detected BOOLEAN NOT NULL DEFAULT FALSE,
    piece_count_verified BOOLEAN NOT NULL DEFAULT TRUE,
    piece_count_found INT,
    stamped_date_detected BOOLEAN NOT NULL DEFAULT FALSE,
    stamped_date VARCHAR(32),
    
    -- Damage & Exception Flagging
    has_damage_exception BOOLEAN NOT NULL DEFAULT FALSE,
    detected_exception_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    exception_severity VARCHAR(32) NOT NULL DEFAULT 'NONE', -- NONE, LOW, HIGH, CRITICAL
    exception_notes TEXT,
    claims_alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Overall POD Verification Status
    status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED', -- PENDING, VERIFIED, FLAGGED_EXCEPTION, REJECTED
    overall_confidence NUMERIC(5, 2) NOT NULL DEFAULT 95.0,
    
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Delivery Exceptions & Damage Claims Log
CREATE TABLE IF NOT EXISTS delivery_exceptions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    pod_id UUID REFERENCES pod_records(id) ON DELETE CASCADE,
    severity VARCHAR(32) NOT NULL DEFAULT 'HIGH', -- LOW, MEDIUM, HIGH, CRITICAL
    keywords_detected TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    notation_snippets TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    description TEXT NOT NULL,
    reported_pieces_short INT DEFAULT 0,
    claim_amount_cents BIGINT DEFAULT 0,
    alert_sent_to VARCHAR(255),
    alert_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, CLAIM_FILED, SETTLED, RESOLVED, DISMISSED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Instant Customer Invoices (Sub-Minute DSO)
CREATE TABLE IF NOT EXISTS customer_invoices (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    pod_id UUID REFERENCES pod_records(id) ON DELETE SET NULL,
    customer_account_id UUID REFERENCES accounts(id),
    
    invoice_number VARCHAR(64) NOT NULL UNIQUE,
    customer_po_number VARCHAR(64),
    shipper_name VARCHAR(255) NOT NULL,
    shipper_email VARCHAR(255) NOT NULL,
    shipper_address TEXT NOT NULL,
    
    -- Itemized Billing Amounts (Integer Cents for exact zero-drift financial precision)
    linehaul_amount_cents BIGINT NOT NULL,
    fuel_surcharge_cents BIGINT NOT NULL,
    accessorial_amount_cents BIGINT NOT NULL DEFAULT 0,
    accessorial_breakdown JSONB NOT NULL DEFAULT '{}'::JSONB,
    total_amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Payment Terms & Due Date
    payment_terms_days INT NOT NULL DEFAULT 30,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    
    -- Banking Remit Instructions
    remit_instructions JSONB NOT NULL,
    
    -- Document & Delivery Status
    pdf_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ISSUED', -- DRAFT, ISSUED, SENT, PAID, OVERDUE, DISPUTED
    email_sent_to VARCHAR(255),
    email_sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for Fast Querying and Realtime Dashboard
CREATE INDEX IF NOT EXISTS idx_pod_records_shipment ON pod_records(shipment_id);
CREATE INDEX IF NOT EXISTS idx_pod_records_tenant ON pod_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_shipment ON customer_invoices(shipment_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_tenant ON customer_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_number ON customer_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_delivery_exceptions_shipment ON delivery_exceptions(shipment_id);
