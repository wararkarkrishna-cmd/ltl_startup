import { describe, it, expect } from 'vitest';
import { AddressResolver } from '../src/lib/geo/address-resolver';

describe('Phase 1: Address Validation & Postal Code Resolution', () => {
  it('resolves standard commercial ZIP with dock', () => {
    const res = AddressResolver.resolvePostalCode('90001');
    expect(res.isValidZip).toBe(true);
    expect(res.city).toBe('Los Angeles');
    expect(res.state).toBe('CA');
    expect(res.isResidential).toBe(false);
    expect(res.hasDock).toBe(true);
    expect(res.zoningType).toBe('INDUSTRIAL');
  });

  it('resolves residential ZIP and suggests liftgate & residential accessorials', () => {
    const res = AddressResolver.resolvePostalCode('90210');
    expect(res.isValidZip).toBe(true);
    expect(res.city).toBe('Beverly Hills');
    expect(res.state).toBe('CA');
    expect(res.isResidential).toBe(true);
    expect(res.hasDock).toBe(false);
    expect(res.zoningType).toBe('RESIDENTIAL');
    expect(res.suggestedAccessorials).toContain('RESIDENTIAL');
    expect(res.suggestedAccessorials).toContain('LIFTGATE');
  });

  it('handles unknown 5-digit ZIPs with fallback defaults', () => {
    const res = AddressResolver.resolvePostalCode('99999', 'Ketchikan', 'AK');
    expect(res.isValidZip).toBe(true);
    expect(res.city).toBe('Ketchikan');
    expect(res.state).toBe('AK');
    expect(res.isResidential).toBe(false);
  });
});
