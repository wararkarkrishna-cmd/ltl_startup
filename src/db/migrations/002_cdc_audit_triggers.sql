-- ====================================================================================================================
-- MASTER LTL FREIGHT OPERATING SYSTEM & FINANCIAL ENGINE
-- MIGRATION: 002_cdc_audit_triggers.sql
-- TARGET: PostgreSQL 14+ / Supabase CDC Triggers & Hash-Chained Audit Ledger
-- ====================================================================================================================

-- 1. Add Previous Hash column for Cryptographic Hash-Chaining on audit_events
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS event_hash VARCHAR(64);

-- 2. Function to compute SHA-256 Hash of an Audit Event
CREATE OR REPLACE FUNCTION fn_compute_audit_hash(
    p_tenant_id UUID,
    p_shipment_id UUID,
    p_field_name VARCHAR,
    p_old_val TEXT,
    p_new_val TEXT,
    p_source VARCHAR,
    p_prev_hash VARCHAR,
    p_timestamp TIMESTAMPTZ
) RETURNS VARCHAR AS $$
BEGIN
    RETURN encode(
        digest(
            COALESCE(p_tenant_id::TEXT, '') || '|' ||
            COALESCE(p_shipment_id::TEXT, '') || '|' ||
            COALESCE(p_field_name, '') || '|' ||
            COALESCE(p_old_val, '') || '|' ||
            COALESCE(p_new_val, '') || '|' ||
            COALESCE(p_source, '') || '|' ||
            COALESCE(p_prev_hash, 'GENESIS') || '|' ||
            EXTRACT(EPOCH FROM p_timestamp)::TEXT,
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Change-Data-Capture (CDC) Trigger on shipments table
CREATE OR REPLACE FUNCTION fn_shipments_cdc_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_last_hash VARCHAR(64);
    v_new_hash VARCHAR(64);
    v_source VARCHAR(32) := 'USER_OVERRIDE';
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Determine last event hash for cryptographic chaining
    SELECT event_hash INTO v_last_hash 
    FROM audit_events 
    WHERE tenant_id = NEW.tenant_id AND shipment_id = NEW.id 
    ORDER BY created_at DESC LIMIT 1;

    IF v_last_hash IS NULL THEN
        v_last_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    -- Track Status Changes
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        v_new_hash := fn_compute_audit_hash(NEW.tenant_id, NEW.id, 'status', OLD.status, NEW.status, v_source, v_last_hash, v_now);
        INSERT INTO audit_events (id, tenant_id, shipment_id, field_name, old_value, new_value, source, prev_hash, event_hash, created_at)
        VALUES (generate_uuid_v7(), NEW.tenant_id, NEW.id, 'status', OLD.status, NEW.status, v_source, v_last_hash, v_new_hash, v_now);
        v_last_hash := v_new_hash;
    END IF;

    -- Track Weight Changes (Critical Liability Field)
    IF (TG_OP = 'UPDATE' AND OLD.total_weight_lbs IS DISTINCT FROM NEW.total_weight_lbs) THEN
        v_new_hash := fn_compute_audit_hash(NEW.tenant_id, NEW.id, 'total_weight_lbs', OLD.total_weight_lbs::TEXT, NEW.total_weight_lbs::TEXT, v_source, v_last_hash, v_now);
        INSERT INTO audit_events (id, tenant_id, shipment_id, field_name, old_value, new_value, source, prev_hash, event_hash, created_at)
        VALUES (generate_uuid_v7(), NEW.tenant_id, NEW.id, 'total_weight_lbs', OLD.total_weight_lbs::TEXT, NEW.total_weight_lbs::TEXT, v_source, v_last_hash, v_new_hash, v_now);
        v_last_hash := v_new_hash;
    END IF;

    -- Track Pallet Count Changes
    IF (TG_OP = 'UPDATE' AND OLD.total_pallets IS DISTINCT FROM NEW.total_pallets) THEN
        v_new_hash := fn_compute_audit_hash(NEW.tenant_id, NEW.id, 'total_pallets', OLD.total_pallets::TEXT, NEW.total_pallets::TEXT, v_source, v_last_hash, v_now);
        INSERT INTO audit_events (id, tenant_id, shipment_id, field_name, old_value, new_value, source, prev_hash, event_hash, created_at)
        VALUES (generate_uuid_v7(), NEW.tenant_id, NEW.id, 'total_pallets', OLD.total_pallets::TEXT, NEW.total_pallets::TEXT, v_source, v_last_hash, v_new_hash, v_now);
        v_last_hash := v_new_hash;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach Trigger to shipments
DROP TRIGGER IF EXISTS trg_shipments_cdc ON shipments;
CREATE TRIGGER trg_shipments_cdc
AFTER UPDATE ON shipments
FOR EACH ROW EXECUTE FUNCTION fn_shipments_cdc_audit();
