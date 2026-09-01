import { describe, it, expect } from 'vitest';
import { QuickPayContractEngine } from '../src/lib/quickpay/quickpay-contract-engine';
import { dbClient } from '../src/db/client';

describe('Phase 6.3: 1-Click QuickPay Acceptance & E-SIGN Micro-Contract Engine', () => {
  const contractInput = {
    tenantId: '01916362-7901-7080-867c-9b8895092a01',
    payoutId: '01916362-7901-7080-867c-9b8895092p01',
    shipmentId: '01916362-7901-7080-867c-9b8895092s01',
    carrierScac: 'SAIA',
    carrierName: 'SAIA LTL Freight',
    proNumber: 'PRO-984210',
    bolNumber: 'BOL-2026-001',
    selectedTier: 'INSTANT_SAME_DAY' as const,
    grossAmountCents: 80000,
    discountFeeCents: 2000,
    netSettlementCents: 78000,
    signerName: 'Sarah Jenkins',
    signerTitle: 'Director of Billing',
    signerEmail: 'sjenkins@saia.com',
    signerIp: '198.51.100.42',
    signerUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    bankName: 'JPMorgan Chase',
    routingNumberMasked: '*****0021',
    accountNumberMasked: '*****4829',
  };

  it('generates E-SIGN Act compliant assignment agreement with valid SHA-256 hash', () => {
    const res = QuickPayContractEngine.createAgreement(contractInput);

    expect(res.agreement.agreementReference).toMatch(/^QPA-/);
    expect(res.agreement.carrierScac).toBe('SAIA');
    expect(res.agreement.grossAmountCents).toBe(80000);
    expect(res.agreement.netSettlementCents).toBe(78000);
    expect(res.agreementSha256Hash).toHaveLength(64);
    expect(res.legalTermsText).toContain('ELECTRONIC ASSIGNMENT OF FREIGHT RECEIVABLES');
    expect(res.legalTermsText).toContain('Sarah Jenkins');
    expect(res.legalTermsText).toContain('198.51.100.42');
  });

  it('renders a professional vector PDF agreement document', async () => {
    const res = QuickPayContractEngine.createAgreement(contractInput);
    const pdfBuffer = await QuickPayContractEngine.renderAgreementPdf(res.agreement, {
      bankName: contractInput.bankName,
      routingMasked: contractInput.routingNumberMasked,
      accountMasked: contractInput.accountNumberMasked,
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('verifies tamper-proof hash changes if agreement payload is altered', () => {
    const hash1 = QuickPayContractEngine.computeAgreementHash(
      contractInput.tenantId,
      contractInput.payoutId,
      contractInput.shipmentId,
      80000,
      78000,
      contractInput.signerEmail,
      contractInput.signerIp,
      '2026-09-01T12:00:00.000Z'
    );

    const hash2 = QuickPayContractEngine.computeAgreementHash(
      contractInput.tenantId,
      contractInput.payoutId,
      contractInput.shipmentId,
      80000,
      75000, // Altered net payout
      contractInput.signerEmail,
      contractInput.signerIp,
      '2026-09-01T12:00:00.000Z'
    );

    expect(hash1).not.toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
