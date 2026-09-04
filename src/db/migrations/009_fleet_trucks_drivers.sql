-- ============================================================================
-- MIGRATION: 009_fleet_trucks_drivers.sql
-- Fleet Management: Trucks and Drivers Tables
-- ============================================================================

-- 1. Create Trucks Table
CREATE TABLE IF NOT EXISTS trucks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    carrier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    unit_number VARCHAR(50) NOT NULL,
    equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('DRY_VAN_53', 'REEFER_53', 'FLATBED_48', 'BOX_TRUCK_26', 'POWER_ONLY')),
    max_weight_lbs INTEGER NOT NULL DEFAULT 45000,
    max_pallets INTEGER NOT NULL DEFAULT 26,
    has_liftgate BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'OUT_OF_SERVICE')),
    current_location_zip VARCHAR(10),
    current_city VARCHAR(100),
    current_state VARCHAR(2),
    assigned_driver_name VARCHAR(100),
    assigned_driver_phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    carrier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    cdl_number VARCHAR(50),
    cdl_state VARCHAR(2),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_LOAD', 'OFF_DUTY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS) & Policies
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_trucks ON trucks;
CREATE POLICY tenant_isolation_trucks ON trucks
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_drivers ON drivers;
CREATE POLICY tenant_isolation_drivers ON drivers
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_trucks_tenant_id ON trucks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trucks_carrier_account_id ON trucks(carrier_account_id);
CREATE INDEX IF NOT EXISTS idx_trucks_unit_number ON trucks(unit_number);
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status);

CREATE INDEX IF NOT EXISTS idx_drivers_tenant_id ON drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drivers_carrier_account_id ON drivers(carrier_account_id);
CREATE INDEX IF NOT EXISTS idx_drivers_truck_id ON drivers(truck_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
