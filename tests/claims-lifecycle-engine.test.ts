import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClaimsLifecycleEngine,
  ALLOWED_DISPUTE_TRANSITIONS,
  InvalidStateTransitionError,
} from '../src/lib/audit/claims-lifecycle-engine';
import { dbClient } from '../src/db/client';
import { DisputeStatus } from '../src/db/schema';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 5.5: Carrier Claims Lifecycle Engine', () => {
  const testTenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(testTenantId);
  });

  // ==========================================================================
  // 1. STATE MACHINE & VALID TRANSITION GRAPH TESTS
  // ==========================================================================
  describe('Dispute State Machine Transitions', () => {
    it('defines strict allowed transitions for all dispute statuses', () => {
      expect(ALLOWED_DISPUTE_TRANSITIONS.FLAGGED).toEqual(['DISPUTE_GENERATED']);
      expect(ALLOWED_DISPUTE_TRANSITIONS.DISPUTE_GENERATED).toEqual(['SUBMITTED']);
      expect(ALLOWED_DISPUTE_TRANSITIONS.SUBMITTED).toEqual([
        'IN_REVIEW',
        'CREDIT_ISSUED',
        'DENIED',
        'ESCALATED',
      ]);
      expect(ALLOWED_DISPUTE_TRANSITIONS.IN_REVIEW).toEqual([
        'CREDIT_ISSUED',
        'DENIED',
        'ESCALATED',
      ]);
      expect(ALLOWED_DISPUTE_TRANSITIONS.DENIED).toEqual(['ESCALATED']);
      expect(ALLOWED_DISPUTE_TRANSITIONS.ESCALATED).toEqual(['CREDIT_ISSUED', 'DENIED']);
      expect(ALLOWED_DISPUTE_TRANSITIONS.CREDIT_ISSUED).toEqual([]);
    });

    it('correctly evaluates isValidTransition helper', () => {
      expect(ClaimsLifecycleEngine.isValidTransition('FLAGGED', 'DISPUTE_GENERATED')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('DISPUTE_GENERATED', 'SUBMITTED')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('SUBMITTED', 'IN_REVIEW')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('SUBMITTED', 'CREDIT_ISSUED')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('SUBMITTED', 'DENIED')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('SUBMITTED', 'ESCALATED')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('IN_REVIEW', 'CREDIT_ISSUED')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('DENIED', 'ESCALATED')).toBe(true);
      expect(ClaimsLifecycleEngine.isValidTransition('ESCALATED', 'CREDIT_ISSUED')).toBe(true);

      // Illegal transitions
      expect(ClaimsLifecycleEngine.isValidTransition('FLAGGED', 'CREDIT_ISSUED')).toBe(false);
      expect(ClaimsLifecycleEngine.isValidTransition('FLAGGED', 'SUBMITTED')).toBe(false);
      expect(ClaimsLifecycleEngine.isValidTransition('DISPUTE_GENERATED', 'CREDIT_ISSUED')).toBe(false);
      expect(ClaimsLifecycleEngine.isValidTransition('CREDIT_ISSUED', 'SUBMITTED')).toBe(false);
      expect(ClaimsLifecycleEngine.isValidTransition('CREDIT_ISSUED', 'FLAGGED')).toBe(false);
    });

    it('throws InvalidStateTransitionError on disallowed transitions', () => {
      expect(() => {
        ClaimsLifecycleEngine.validateStateTransition('FLAGGED', 'CREDIT_ISSUED');
      }).toThrow(InvalidStateTransitionError);

      expect(() => {
        ClaimsLifecycleEngine.validateStateTransition('CREDIT_ISSUED', 'SUBMITTED');
      }).toThrow(/Invalid dispute state transition/);
    });
  });

  // ==========================================================================
  // 2. DISPUTE STATUS TRANSITION LIFECYCLE METHOD TESTS
  // ==========================================================================
  describe('transitionDisputeStatus method', () => {
    it('executes full sequential lifecycle FLAGGED -> DISPUTE_GENERATED -> SUBMITTED -> IN_REVIEW -> CREDIT_ISSUED', async () => {
      // Seed initial dispute in FLAGGED status
      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'XPO-887711',
        totalBilledCents: 150000,
        status: 'DISCREPANCY_FLAGGED',
      });

      const dispute = await dbClient.insertCarrierDispute({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        disputeReferenceNumber: 'DISP-2026-XPO-001',
        carrierScac: 'XPO',
        carrierProNumber: 'XPO-887711',
        disputedAmountCents: 25000,
        disputeStatus: 'FLAGGED',
      });

      // 1. Transition: FLAGGED -> DISPUTE_GENERATED
      const step1 = await ClaimsLifecycleEngine.transitionDisputeStatus({
        tenantId: testTenantId,
        disputeId: dispute.id,
        newStatus: 'DISPUTE_GENERATED',
        notes: 'Dispute documentation package compiled with POD evidence',
        actorId: 'AUDIT_ROBOT_01',
      });
      expect(step1.disputeStatus).toBe('DISPUTE_GENERATED');
      expect(step1.statusHistory?.length).toBe(1);
      expect(step1.statusHistory?.[0].status).toBe('DISPUTE_GENERATED');

      // 2. Transition: DISPUTE_GENERATED -> SUBMITTED
      const submissionDate = new Date('2026-08-01T10:00:00Z');
      const step2 = await ClaimsLifecycleEngine.transitionDisputeStatus({
        tenantId: testTenantId,
        disputeId: dispute.id,
        newStatus: 'SUBMITTED',
        notes: 'Dispatched via carrier API/email to disputes@xpo.com',
        timestamp: submissionDate,
        submittedAt: submissionDate,
        actorId: 'DISPUTE_ROUTER',
      });
      expect(step2.disputeStatus).toBe('SUBMITTED');
      expect(new Date(step2.submittedAt!).toISOString()).toBe(submissionDate.toISOString());
      expect(step2.statusHistory?.length).toBe(2);

      // 3. Transition: SUBMITTED -> IN_REVIEW
      const step3 = await ClaimsLifecycleEngine.transitionDisputeStatus({
        tenantId: testTenantId,
        disputeId: dispute.id,
        newStatus: 'IN_REVIEW',
        notes: 'Carrier claim desk acknowledged claim receipt (Claim Ref #CLM-994)',
        actorId: 'BROKER_AGENT_JANE',
      });
      expect(step3.disputeStatus).toBe('IN_REVIEW');
      expect(step3.statusHistory?.length).toBe(3);

      // 4. Transition: IN_REVIEW -> CREDIT_ISSUED
      const step4 = await ClaimsLifecycleEngine.transitionDisputeStatus({
        tenantId: testTenantId,
        disputeId: dispute.id,
        newStatus: 'CREDIT_ISSUED',
        notes: 'Carrier issued credit memo #CM-88412 for $250.00',
        actorId: 'BILLING_SPECIALIST_BOB',
      });
      expect(step4.disputeStatus).toBe('CREDIT_ISSUED');
      expect(step4.resolvedAt).toBeDefined();
      expect(step4.statusHistory?.length).toBe(4);
    });

    it('rejects illegal transition directly from FLAGGED to CREDIT_ISSUED', async () => {
      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        carrierScac: 'SAIA',
        proNumber: 'SAIA-112233',
        totalBilledCents: 90000,
      });

      const dispute = await dbClient.insertCarrierDispute({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        disputeReferenceNumber: 'DISP-2026-SAIA-002',
        carrierScac: 'SAIA',
        carrierProNumber: 'SAIA-112233',
        disputedAmountCents: 15000,
        disputeStatus: 'FLAGGED',
      });

      await expect(
        ClaimsLifecycleEngine.transitionDisputeStatus({
          tenantId: testTenantId,
          disputeId: dispute.id,
          newStatus: 'CREDIT_ISSUED',
        })
      ).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  // ==========================================================================
  // 3. STATUTORY 30-DAY FMCSA CLAIM ACKNOWLEDGMENT TRACKER (49 CFR § 378.7)
  // ==========================================================================
  describe('Statutory 30-Day FMCSA Claim Acknowledgment Tracker', () => {
    it('calculates elapsed calendar days accurately', () => {
      const submitted = new Date('2026-08-01T00:00:00Z');
      const day15 = new Date('2026-08-16T00:00:00Z');
      const day35 = new Date('2026-09-05T00:00:00Z');

      expect(ClaimsLifecycleEngine.calculateDaysElapsed(submitted, day15)).toBe(15);
      expect(ClaimsLifecycleEngine.calculateDaysElapsed(submitted, day35)).toBe(35);
      expect(ClaimsLifecycleEngine.calculateDaysElapsed(submitted, submitted)).toBe(0);
    });

    it('identifies FMCSA 30-day statutory violations, auto-escalates to ESCALATED, and attaches STB/FMCSA complaint letter', async () => {
      const submissionDate = new Date('2026-07-15T00:00:00Z'); // 47 days ago from 2026-09-01
      const auditDate = new Date('2026-09-01T00:00:00Z');

      // 1. Create overdue dispute in SUBMITTED state
      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        carrierScac: 'ESTES',
        carrierName: 'Estes Express Lines',
        proNumber: 'EXLA-990011',
        totalBilledCents: 120000,
      });

      const dispute = await dbClient.insertCarrierDispute({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        disputeReferenceNumber: 'DISP-2026-ESTES-001',
        carrierScac: 'ESTES',
        carrierName: 'Estes Express Lines',
        carrierProNumber: 'EXLA-990011',
        disputedAmountCents: 35000,
        disputeStatus: 'SUBMITTED',
        submittedAt: submissionDate,
      });

      // 2. Run FMCSA deadline audit
      const auditSummary = await ClaimsLifecycleEngine.auditFmcsaDeadlines(testTenantId, auditDate);

      expect(auditSummary.overdueClaimsCount).toBeGreaterThanOrEqual(1);
      expect(auditSummary.escalatedCount).toBeGreaterThanOrEqual(1);
      expect(auditSummary.totalOverdueDisputedAmountCents).toBeGreaterThanOrEqual(35000);

      const overdueItem = auditSummary.overdueClaims.find((c) => c.disputeId === dispute.id);
      expect(overdueItem).toBeDefined();
      expect(overdueItem?.daysElapsed).toBe(48);
      expect(overdueItem?.isFmcsaViolated).toBe(true);
      expect(overdueItem?.status).toBe('ESCALATED');
      expect(overdueItem?.escalationLetterGenerated).toBe(true);
      expect(overdueItem?.escalationLetterText).toContain('49 CFR § 378.7');
      expect(overdueItem?.escalationLetterText).toContain('49 U.S.C. § 14708');

      // 3. Verify database record was updated to ESCALATED with violation flags
      const updatedDispute = await dbClient.getCarrierDisputeById(dispute.id);
      expect(updatedDispute?.disputeStatus).toBe('ESCALATED');
      expect(updatedDispute?.isFmcsaViolated).toBe(true);
      expect(updatedDispute?.daysElapsedSinceSubmission).toBe(48);
      expect(updatedDispute?.escalationLetterText).toBeDefined();
    });

    it('does not escalate disputes that are within the 30-day statutory window', async () => {
      const recentSubmission = new Date('2026-08-25T00:00:00Z'); // 7 days ago from 2026-09-01
      const auditDate = new Date('2026-09-01T00:00:00Z');

      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        carrierScac: 'ABF',
        carrierName: 'ABF Freight',
        proNumber: 'ABFS-445566',
        totalBilledCents: 80000,
      });

      const dispute = await dbClient.insertCarrierDispute({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        disputeReferenceNumber: 'DISP-2026-ABF-RECENT',
        carrierScac: 'ABF',
        carrierProNumber: 'ABFS-445566',
        disputedAmountCents: 12000,
        disputeStatus: 'SUBMITTED',
        submittedAt: recentSubmission,
      });

      const auditSummary = await ClaimsLifecycleEngine.auditFmcsaDeadlines(testTenantId, auditDate);
      const item = auditSummary.overdueClaims.find((c) => c.disputeId === dispute.id);
      expect(item).toBeUndefined();

      const refreshed = await dbClient.getCarrierDisputeById(dispute.id);
      expect(refreshed?.disputeStatus).toBe('SUBMITTED');
      expect(refreshed?.isFmcsaViolated).toBe(false);
    });
  });

  // ==========================================================================
  // 4. FORMAL ESCALATION LETTER GENERATOR TESTS
  // ==========================================================================
  describe('Formal FMCSA & STB Escalation Complaint Letter Generator', () => {
    it('generates formal regulatory escalation complaint letter citing 49 U.S.C. § 14708 and 49 CFR § 378.7', async () => {
      const dispute = await dbClient.insertCarrierDispute({
        tenantId: testTenantId,
        carrierInvoiceId: generateUuidV7(),
        disputeReferenceNumber: 'DISP-2026-XPO-7788',
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        carrierProNumber: 'XPO-778899',
        bolNumber: 'BOL-2026-9900',
        disputedAmountCents: 45000, // $450.00
        disputeStatus: 'SUBMITTED',
        submittedAt: '2026-07-20',
      });

      const letter = ClaimsLifecycleEngine.generateFmcsaEscalationLetter(dispute, {
        daysElapsed: 42,
        referenceDate: new Date('2026-09-01'),
      });

      expect(letter).toContain('FORMAL NOTICE OF STATUTORY REGULATORY VIOLATION & ESCALATED DEMAND');
      expect(letter).toContain('49 CFR § 378.7');
      expect(letter).toContain('49 U.S.C. § 14708');
      expect(letter).toContain('49 U.S.C. § 14901');
      expect(letter).toContain('DISP-2026-XPO-7788');
      expect(letter).toContain('XPO Logistics (XPO)');
      expect(letter).toContain('XPO-778899');
      expect(letter).toContain('BOL-2026-9900');
      expect(letter).toContain('$450.00 USD');
      expect(letter).toContain('42 CALENDAR DAYS');
      expect(letter).toContain('Surface Transportation Board (STB)');
      expect(letter).toContain('Federal Motor Carrier Safety Administration (FMCSA)');
      expect(letter).toContain('National Consumer Complaint Database (NCCDB)');
      expect(letter).toContain('within five (5) business days');
    });
  });

  // ==========================================================================
  // 5. CREDIT MEMO SETTLEMENT ENGINE TESTS
  // ==========================================================================
  describe('Credit Memo Settlement Engine (recordCreditMemo)', () => {
    it('settles 100% full recovery credit memo, updates dispute to CREDIT_ISSUED, CarrierInvoice to SETTLED, and computes 100% yield', async () => {
      // 1. Seed carrier invoice & discrepancy & dispute in IN_REVIEW status
      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        carrierScac: 'XPO',
        proNumber: 'XPO-554411',
        totalBilledCents: 147000,
        status: 'DISPUTE_FILED',
      });

      const discrepancy = await dbClient.insertDiscrepancyRecord({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        discrepancyType: 'UNAUTHORIZED_REWEIGH',
        discrepancyDescription: 'Reweigh overcharge',
        disputableAmountCents: 22000,
        status: 'DISPUTE_GENERATED',
      });

      const dispute = await dbClient.insertCarrierDispute({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        discrepancyId: discrepancy.id,
        disputeReferenceNumber: 'DISP-2026-XPO-SETTLE-01',
        carrierScac: 'XPO',
        carrierProNumber: 'XPO-554411',
        disputedAmountCents: 22000,
        disputeStatus: 'IN_REVIEW',
      });

      // 2. Record full settlement credit memo
      const settlement = await ClaimsLifecycleEngine.recordCreditMemo({
        tenantId: testTenantId,
        disputeId: dispute.id,
        creditMemoNumber: 'CM-XPO-98421',
        recoveredAmountCents: 22000,
        settlementNotes: 'Carrier granted full $220.00 reweigh credit adjustment upon inspection review.',
        actorId: 'BILLING_AGENT_MIKE',
      });

      expect(settlement.success).toBe(true);
      expect(settlement.recoveredAmountCents).toBe(22000);
      expect(settlement.disputedAmountCents).toBe(22000);
      expect(settlement.recoveryYieldPercent).toBe(100.0);
      expect(settlement.creditMemoNumber).toBe('CM-XPO-98421');

      // Verify dispute updated
      expect(settlement.dispute.disputeStatus).toBe('CREDIT_ISSUED');
      expect(settlement.dispute.creditMemoNumber).toBe('CM-XPO-98421');
      expect(settlement.dispute.recoveredAmountCents).toBe(22000);
      expect(settlement.dispute.recoveryYieldPercent).toBe(100.0);
      expect(settlement.dispute.resolvedAt).toBeDefined();

      // Verify associated CarrierInvoice updated to SETTLED
      const updatedInv = await dbClient.getCarrierInvoiceById(carrierInvoice.id);
      expect(updatedInv?.status).toBe('SETTLED');

      // Verify associated Discrepancy updated to SETTLED
      const updatedDisc = await dbClient.getDiscrepancyRecordById(discrepancy.id);
      expect(updatedDisc?.status).toBe('SETTLED');
    });

    it('correctly calculates partial recovery yield percentage (e.g. 50% compromised settlement)', async () => {
      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        carrierScac: 'SAIA',
        proNumber: 'SAIA-332211',
        totalBilledCents: 100000,
        status: 'DISPUTED',
      });

      const dispute = await dbClient.insertCarrierDispute({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        disputeReferenceNumber: 'DISP-2026-SAIA-PARTIAL',
        carrierScac: 'SAIA',
        carrierProNumber: 'SAIA-332211',
        disputedAmountCents: 20000, // $200.00 disputed
        disputeStatus: 'ESCALATED',
      });

      // Record partial settlement ($100.00 recovered = 50% yield)
      const settlement = await ClaimsLifecycleEngine.recordCreditMemo({
        tenantId: testTenantId,
        disputeId: dispute.id,
        creditMemoNumber: 'CM-SAIA-5500',
        recoveredAmountCents: 10000,
        settlementNotes: 'Negotiated 50/50 split on detention surcharge',
      });

      expect(settlement.recoveredAmountCents).toBe(10000);
      expect(settlement.recoveryYieldPercent).toBe(50.0);
      expect(settlement.dispute.disputeStatus).toBe('CREDIT_ISSUED');

      const updatedInv = await dbClient.getCarrierInvoiceById(carrierInvoice.id);
      expect(updatedInv?.status).toBe('SETTLED');
    });
  });

  // ==========================================================================
  // 6. COMPREHENSIVE DISPUTE METRICS SUMMARY
  // ==========================================================================
  describe('Dispute Metrics Aggregator (getDisputeMetrics)', () => {
    it('aggregates total disputes, status breakdowns, recovery yields, and FMCSA violation counts', async () => {
      const metrics = await ClaimsLifecycleEngine.getDisputeMetrics(testTenantId);

      expect(metrics.tenantId).toBe(testTenantId);
      expect(metrics.totalDisputesCount).toBeGreaterThan(0);
      expect(metrics.byStatus).toBeDefined();
      expect(metrics.totalDisputedAmountCents).toBeGreaterThan(0);
      expect(metrics.overallRecoveryYieldPercent).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.fmcsaViolationsCount).toBe('number');
      expect(typeof metrics.escalatedDisputesCount).toBe('number');
    });
  });
});
