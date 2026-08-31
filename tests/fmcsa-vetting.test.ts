import { describe, it, expect } from 'vitest';
import {
  FmcsaCarrierVettingEngine,
  VettingRequest,
} from '../src/lib/vetting/fmcsa-vetting-engine';
import { POST as VettingPost } from '../src/app/api/v1/vetting/carrier/route';
import { NextRequest } from 'next/server';

describe('Phase 3.8: Carrier Vetting & FMCSA Safety Validation Service', () => {
  const baseRequest: VettingRequest = {
    tenantId: '01916362-7901-7080-867c-9b8895092a01',
    carrierCode: 'SAIA',
    carrierScac: 'SAIA',
    carrierName: 'SAIA LTL Freight',
    dotNumber: '123456',
    mcNumber: 'MC987654',
    autoLiabilityCoverageDollars: 2_000_000,
    cargoInsuranceCoverageDollars: 250_000,
    safetyRatingOverride: 'SATISFACTORY',
    operatingAuthorityStatusOverride: 'ACTIVE',
    driverOosRatePercent: 2.1,
    vehicleOosRatePercent: 11.4,
  };

  it('approves carrier meeting all operating authority, safety rating, and insurance thresholds', () => {
    const result = FmcsaCarrierVettingEngine.evaluateCarrier(baseRequest);

    expect(result.isApproved).toBe(true);
    expect(result.safetyScore).toBe(100);
    expect(result.rejectionReasons.length).toBe(0);
  });

  it('blocks dispatch when operating authority is revoked or inactive', () => {
    const revokedReq: VettingRequest = {
      ...baseRequest,
      operatingAuthorityStatusOverride: 'REVOKED',
    };

    const result = FmcsaCarrierVettingEngine.evaluateCarrier(revokedReq);
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('REVOKED'))).toBe(true);
    expect(result.safetyScore).toBeLessThan(100);
  });

  it('blocks dispatch when Auto Liability coverage is under $1,000,000 threshold', () => {
    const lowInsuranceReq: VettingRequest = {
      ...baseRequest,
      autoLiabilityCoverageDollars: 500_000, // Below $1M
    };

    const result = FmcsaCarrierVettingEngine.evaluateCarrier(lowInsuranceReq);
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('$1,000,000'))).toBe(true);
  });

  it('evaluates carrier safety via POST /api/v1/vetting/carrier API', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/vetting/carrier', {
      method: 'POST',
      body: JSON.stringify(baseRequest),
    });

    const res = await VettingPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.vetting.isApproved).toBe(true);
    expect(json.vetting.carrierScac).toBe('SAIA');
  });
});
