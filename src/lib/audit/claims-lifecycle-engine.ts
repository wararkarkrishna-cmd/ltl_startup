import { z } from 'zod';
import { dbClient } from '../../db/client';
import {
  CarrierDispute,
  CarrierDisputeSchema,
  CarrierInvoice,
  DisputeStatus,
  DISPUTE_STATUSES,
  DiscrepancyRecord,
} from '../../db/schema';

// ============================================================================
// STATE MACHINE TRANSITION MAP & TYPES
// ============================================================================

/**
 * Valid state transition graph for Carrier Disputes.
 * FLAGGED -> DISPUTE_GENERATED -> SUBMITTED -> IN_REVIEW -> CREDIT_ISSUED / DENIED / ESCALATED
 */
export const ALLOWED_DISPUTE_TRANSITIONS: Record<DisputeStatus, readonly DisputeStatus[]> = {
  FLAGGED: ['DISPUTE_GENERATED'],
  DISPUTE_GENERATED: ['SUBMITTED'],
  SUBMITTED: ['IN_REVIEW', 'CREDIT_ISSUED', 'DENIED', 'ESCALATED'],
  IN_REVIEW: ['CREDIT_ISSUED', 'DENIED', 'ESCALATED'],
  DENIED: ['ESCALATED'],
  ESCALATED: ['CREDIT_ISSUED', 'DENIED'],
  CREDIT_ISSUED: [], // Terminal settled state
} as const;

export class InvalidStateTransitionError extends Error {
  public readonly fromStatus: DisputeStatus;
  public readonly toStatus: DisputeStatus;

  constructor(fromStatus: DisputeStatus, toStatus: DisputeStatus, message?: string) {
    const allowed = ALLOWED_DISPUTE_TRANSITIONS[fromStatus] || [];
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'None (Terminal State)';
    const msg =
      message ||
      `Invalid dispute state transition from "${fromStatus}" to "${toStatus}". Allowed transitions: [${allowedStr}].`;
    super(msg);
    this.name = 'InvalidStateTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

// ============================================================================
// ZOD SCHEMAS & INTERFACES FOR CLAIMS LIFECYCLE ENGINE
// ============================================================================

export const TransitionDisputeStatusInputSchema = z.object({
  tenantId: z.string().uuid(),
  disputeId: z.string().uuid(),
  newStatus: z.enum(DISPUTE_STATUSES),
  notes: z.string().optional(),
  actorId: z.string().optional(),
  timestamp: z.date().optional(),
  submittedAt: z.union([z.string(), z.date()]).optional(),
});
export type TransitionDisputeStatusInput = z.infer<typeof TransitionDisputeStatusInputSchema>;

export const RecordCreditMemoInputSchema = z.object({
  tenantId: z.string().uuid(),
  disputeId: z.string().uuid(),
  creditMemoNumber: z.string().min(1).max(64),
  recoveredAmountCents: z.number().int().nonnegative(),
  settlementNotes: z.string().optional(),
  actorId: z.string().optional(),
  resolvedAt: z.date().optional(),
});
export type RecordCreditMemoInput = z.infer<typeof RecordCreditMemoInputSchema>;

export interface SettlementResult {
  success: boolean;
  dispute: CarrierDispute;
  carrierInvoice: CarrierInvoice | null;
  discrepancy: DiscrepancyRecord | null;
  recoveredAmountCents: number;
  disputedAmountCents: number;
  recoveryYieldPercent: number;
  creditMemoNumber: string;
  settledAt: Date;
}

export interface OverdueClaimItem {
  disputeId: string;
  disputeReferenceNumber: string;
  carrierScac: string;
  carrierName?: string | null;
  carrierProNumber: string;
  bolNumber?: string | null;
  disputedAmountCents: number;
  submittedAt: Date;
  daysElapsed: number;
  isFmcsaViolated: boolean;
  status: DisputeStatus;
  escalationLetterGenerated: boolean;
  escalationLetterText?: string | null;
}

export interface FmcsaDeadlineAuditSummary {
  tenantId: string;
  auditedAt: Date;
  totalDisputesAudited: number;
  openClaimsAudited: number;
  overdueClaimsCount: number;
  escalatedCount: number;
  totalOverdueDisputedAmountCents: number;
  overdueClaims: OverdueClaimItem[];
}

export interface DisputeMetricsSummary {
  tenantId: string;
  totalDisputesCount: number;
  byStatus: Record<DisputeStatus, number>;
  totalDisputedAmountCents: number;
  totalRecoveredAmountCents: number;
  overallRecoveryYieldPercent: number;
  fmcsaViolationsCount: number;
  escalatedDisputesCount: number;
}

// ============================================================================
// CLAIMS LIFECYCLE ENGINE CLASS (PHASE 5.5)
// ============================================================================

export class ClaimsLifecycleEngine {
  /**
   * Statutory 30-Day FMCSA Acknowledgment Deadline in calendar days (49 CFR § 378.7)
   */
  public static readonly STATUTORY_FMCSA_ACKNOWLEDGMENT_DAYS = 30;

  /**
   * Validate whether a status transition is permitted by the state machine
   */
  public static isValidTransition(from: DisputeStatus, to: DisputeStatus): boolean {
    const allowed = ALLOWED_DISPUTE_TRANSITIONS[from];
    if (!allowed) return false;
    return (allowed as readonly string[]).includes(to);
  }

  /**
   * Validate state transition and throw an error if disallowed
   */
  public static validateStateTransition(from: DisputeStatus, to: DisputeStatus): void {
    if (!this.isValidTransition(from, to)) {
      throw new InvalidStateTransitionError(from, to);
    }
  }

  /**
   * Transition dispute lifecycle status with validation, audit history and timestamps
   */
  public static async transitionDisputeStatus(
    params: TransitionDisputeStatusInput
  ): Promise<CarrierDispute> {
    const validated = TransitionDisputeStatusInputSchema.parse(params);
    const { tenantId, disputeId, newStatus, notes, actorId } = validated;
    const now = validated.timestamp || new Date();

    dbClient.setTenantContext(tenantId);

    // 1. Fetch Carrier Dispute
    const dispute = await dbClient.getCarrierDisputeById(disputeId);
    if (!dispute) {
      throw new Error(`Carrier dispute with ID "${disputeId}" not found for tenant "${tenantId}".`);
    }

    const currentStatus = (dispute.disputeStatus || dispute.status || 'FLAGGED') as DisputeStatus;

    // 2. Validate Allowed Transition
    if (currentStatus !== newStatus) {
      this.validateStateTransition(currentStatus, newStatus);
    }

    // 3. Prepare Updates
    const statusHistory = Array.isArray(dispute.statusHistory) ? [...dispute.statusHistory] : [];
    statusHistory.push({
      status: newStatus,
      timestamp: now,
      notes: notes || null,
      actorId: actorId || null,
    });

    const updates: Partial<CarrierDispute> = {
      disputeStatus: newStatus,
      status: newStatus,
      statusHistory,
      updatedAt: now,
    };

    if (newStatus === 'SUBMITTED') {
      const submittedDate = validated.submittedAt
        ? new Date(validated.submittedAt)
        : dispute.submittedAt
        ? new Date(dispute.submittedAt)
        : now;
      updates.submittedAt = submittedDate;
    } else if (newStatus === 'CREDIT_ISSUED') {
      updates.resolvedAt = now;
    } else if (newStatus === 'ESCALATED') {
      updates.escalatedAt = now;
    }

    // 4. Persist Updates in Database
    const updatedDispute = await dbClient.updateCarrierDispute(disputeId, updates);
    if (!updatedDispute) {
      throw new Error(`Failed to update carrier dispute with ID "${disputeId}".`);
    }

    return updatedDispute;
  }

  /**
   * Calculate elapsed calendar days between submission and reference date
   */
  public static calculateDaysElapsed(
    submittedAt: Date | string,
    referenceDate: Date = new Date()
  ): number {
    const subDate = typeof submittedAt === 'string' ? new Date(submittedAt) : submittedAt;
    const diffMs = referenceDate.getTime() - subDate.getTime();
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Statutory 30-Day FMCSA Claim Acknowledgment Tracker (49 CFR § 378.7)
   * Scans all open submitted disputes for carrier acknowledgment violations,
   * automatically flags violations, escalates claims, and generates STB/FMCSA letters.
   */
  public static async auditFmcsaDeadlines(
    tenantId: string,
    referenceDate: Date = new Date()
  ): Promise<FmcsaDeadlineAuditSummary> {
    dbClient.setTenantContext(tenantId);

    const allDisputes = await dbClient.getCarrierDisputesByTenant(tenantId);
    let openClaimsCount = 0;
    let overdueClaimsCount = 0;
    let escalatedCount = 0;
    let totalOverdueDisputedAmountCents = 0;
    const overdueClaims: OverdueClaimItem[] = [];

    for (const dispute of allDisputes) {
      const status = (dispute.disputeStatus || dispute.status || 'FLAGGED') as DisputeStatus;

      // Track submitted or escalated claims
      if (status === 'SUBMITTED' || status === 'ESCALATED' || dispute.isFmcsaViolated) {
        openClaimsCount++;

        if (dispute.submittedAt) {
          const submittedDate = new Date(dispute.submittedAt);
          const daysElapsed = this.calculateDaysElapsed(submittedDate, referenceDate);

          if (daysElapsed > this.STATUTORY_FMCSA_ACKNOWLEDGMENT_DAYS) {
            overdueClaimsCount++;
            totalOverdueDisputedAmountCents += dispute.disputedAmountCents || 0;

            const isNewlyEscalated = status === 'SUBMITTED';
            let escalationLetter = dispute.escalationLetterText;

            // Generate escalation letter if not already generated
            if (!escalationLetter) {
              escalationLetter = this.generateFmcsaEscalationLetter(dispute, {
                daysElapsed,
                referenceDate,
              });
            }

            // Update status if currently in SUBMITTED
            if (isNewlyEscalated) {
              escalatedCount++;
              const statusHistory = Array.isArray(dispute.statusHistory) ? [...dispute.statusHistory] : [];
              statusHistory.push({
                status: 'ESCALATED',
                timestamp: referenceDate,
                notes: `Statutory FMCSA 30-Day deadline exceeded (${daysElapsed} days elapsed). Auto-escalated to regulatory complaint.`,
                actorId: 'FMCSA_STATUTORY_DEADLINE_TRACKER',
              });

              await dbClient.updateCarrierDispute(dispute.id, {
                disputeStatus: 'ESCALATED',
                status: 'ESCALATED',
                isFmcsaViolated: true,
                daysElapsedSinceSubmission: daysElapsed,
                escalatedAt: referenceDate,
                escalationLetterText: escalationLetter,
                statusHistory,
              });
            } else {
              // Ensure violation flags are set
              await dbClient.updateCarrierDispute(dispute.id, {
                isFmcsaViolated: true,
                daysElapsedSinceSubmission: daysElapsed,
                escalationLetterText: escalationLetter,
              });
            }

            overdueClaims.push({
              disputeId: dispute.id,
              disputeReferenceNumber: dispute.disputeReferenceNumber,
              carrierScac: dispute.carrierScac,
              carrierName: dispute.carrierName,
              carrierProNumber: dispute.carrierProNumber,
              bolNumber: dispute.bolNumber,
              disputedAmountCents: dispute.disputedAmountCents,
              submittedAt: submittedDate,
              daysElapsed,
              isFmcsaViolated: true,
              status: isNewlyEscalated ? 'ESCALATED' : status,
              escalationLetterGenerated: true,
              escalationLetterText: escalationLetter,
            });
          }
        }
      }
    }

    return {
      tenantId,
      auditedAt: referenceDate,
      totalDisputesAudited: allDisputes.length,
      openClaimsAudited: openClaimsCount,
      overdueClaimsCount,
      escalatedCount,
      totalOverdueDisputedAmountCents,
      overdueClaims,
    };
  }

  /**
   * Generates formal STB & FMCSA Regulatory Escalation Complaint Letter
   * citing 49 U.S.C. § 14708 and 49 CFR § 378.7 for carrier non-compliance.
   */
  public static generateFmcsaEscalationLetter(
    dispute: CarrierDispute,
    options?: {
      daysElapsed?: number;
      referenceDate?: Date;
    }
  ): string {
    const now = options?.referenceDate || new Date();
    const filingDateStr = now.toISOString().split('T')[0];
    const submittedDateStr = dispute.submittedAt
      ? new Date(dispute.submittedAt).toISOString().split('T')[0]
      : 'N/A';
    const daysElapsed =
      options?.daysElapsed ??
      (dispute.submittedAt ? this.calculateDaysElapsed(dispute.submittedAt, now) : 31);

    const disputedDollars = (dispute.disputedAmountCents / 100).toFixed(2);
    const carrierName = dispute.carrierName || dispute.carrierScac;
    const claimEmail = dispute.assignedClaimEmail || dispute.carrierContactEmail || 'claims@carrier.com';

    return (
      `================================================================================\n` +
      `FORMAL NOTICE OF STATUTORY REGULATORY VIOLATION & ESCALATED DEMAND\n` +
      `PURSUANT TO 49 CFR § 378.7 AND 49 U.S.C. § 14708\n` +
      `================================================================================\n\n` +
      `DATE OF ESCALATION: ${filingDateStr}\n` +
      `DISPUTE REFERENCE:  ${dispute.disputeReferenceNumber}\n` +
      `CARRIER / SCAC:     ${carrierName} (${dispute.carrierScac})\n` +
      `CARRIER CLAIMS DESK:${claimEmail}\n` +
      `CARRIER PRO NUMBER: ${dispute.carrierProNumber}\n` +
      `BILL OF LADING #:   ${dispute.bolNumber || 'N/A'}\n` +
      `ORIGINAL CLAIM DATE:${submittedDateStr}\n` +
      `DAYS ELAPSED:       ${daysElapsed} CALENDAR DAYS (STATUTORY DEADLINE: 30 DAYS)\n` +
      `DISPUTED AMOUNT:    $${disputedDollars} USD\n\n` +
      `TO: CARRIER CLAIMS & REVENUE COMPLIANCE DEPARTMENT\n\n` +
      `1. STATUTORY NOTICE OF NON-COMPLIANCE (49 CFR § 378.7):\n` +
      `Pursuant to Title 49 of the Code of Federal Regulations, Section 378.7 (Acknowledgment of claims), ` +
      `every motor carrier subject to ICC Termination Act jurisdiction is statutorily required to acknowledge ` +
      `receipt of an overcharge/disputed billing claim in writing within thirty (30) calendar days of receipt.\n\n` +
      `As of ${filingDateStr}, exactly ${daysElapsed} calendar days have elapsed since the formal submission of ` +
      `Dispute ${dispute.disputeReferenceNumber} on ${submittedDateStr} without written statutory acknowledgment, ` +
      `investigative findings, or credit memo issuance from ${carrierName}.\n\n` +
      `2. LEGAL BASIS & STATUTORY CITATIONS:\n` +
      `• 49 CFR § 378.7: Mandatory written acknowledgment within 30 days.\n` +
      `• 49 CFR § 378.8: Mandatory claim disposition, investigation, and settlement.\n` +
      `• 49 U.S.C. § 14708: Dispute settlement program regulations and carrier statutory liability.\n` +
      `• 49 U.S.C. § 14901: Federal civil penalties for failure to comply with Surface Transportation regulations.\n\n` +
      `3. FORMAL NOTICE OF REGULATORY FILING:\n` +
      `Take notice that due to ${carrierName}'s statutory default, this file is being escalated for formal complaint filing with:\n` +
      `  (a) The Surface Transportation Board (STB) Rail Customer and Public Assistance Program / Freight Claims Division;\n` +
      `  (b) The Federal Motor Carrier Safety Administration (FMCSA) National Consumer Complaint Database (NCCDB); and\n` +
      `  (c) Brokerage legal counsel for administrative offset against pending carrier payable settlements.\n\n` +
      `4. FINAL DEMAND FOR IMMEDIATE RESOLUTION:\n` +
      `To avoid formal regulatory sanctions and civil penalty proceedings, ${carrierName} must issue a full credit memo ` +
      `in the amount of $${disputedDollars} USD within five (5) business days of this notice.\n\n` +
      `Respectfully Submitted,\n` +
      `APEX FREIGHT SOLUTIONS AUDIT & LEGAL CLAIMS DESK\n` +
      `Regulatory Compliance Division • 49 CFR § 378 Enforcement\n` +
      `disputes@apexfreightos.com | 1000 Logistics Blvd, Suite 500, Chicago, IL 60601`
    );
  }

  /**
   * Credit Memo Settlement Engine
   * Records carrier settlement, updates dispute to CREDIT_ISSUED, marks CarrierInvoice
   * as SETTLED, and computes exact mathematical recovery yield percentage.
   */
  public static async recordCreditMemo(
    params: RecordCreditMemoInput
  ): Promise<SettlementResult> {
    const validated = RecordCreditMemoInputSchema.parse(params);
    const { tenantId, disputeId, creditMemoNumber, recoveredAmountCents, settlementNotes, actorId } =
      validated;
    const now = validated.resolvedAt || new Date();

    dbClient.setTenantContext(tenantId);

    // 1. Fetch Carrier Dispute
    const dispute = await dbClient.getCarrierDisputeById(disputeId);
    if (!dispute) {
      throw new Error(`Carrier dispute with ID "${disputeId}" not found for tenant "${tenantId}".`);
    }

    const currentStatus = (dispute.disputeStatus || dispute.status || 'FLAGGED') as DisputeStatus;

    // 2. Validate Allowed Transition to CREDIT_ISSUED
    if (currentStatus !== 'CREDIT_ISSUED') {
      this.validateStateTransition(currentStatus, 'CREDIT_ISSUED');
    }

    // 3. Compute Recovery Yield Percentage: (recoveredAmountCents / disputedAmountCents) * 100
    const disputedAmountCents = dispute.disputedAmountCents || 0;
    let recoveryYieldPercent = 100.0;
    if (disputedAmountCents > 0) {
      recoveryYieldPercent = Math.round((recoveredAmountCents / disputedAmountCents) * 10000) / 100;
    }

    // 4. Update Carrier Dispute Record
    const statusHistory = Array.isArray(dispute.statusHistory) ? [...dispute.statusHistory] : [];
    statusHistory.push({
      status: 'CREDIT_ISSUED',
      timestamp: now,
      notes: `Credit Memo #${creditMemoNumber} recorded. Recovered $${(recoveredAmountCents / 100).toFixed(2)} (${recoveryYieldPercent}% yield). ${settlementNotes || ''}`.trim(),
      actorId: actorId || null,
    });

    const updatedDispute = await dbClient.updateCarrierDispute(disputeId, {
      disputeStatus: 'CREDIT_ISSUED',
      status: 'CREDIT_ISSUED',
      creditMemoNumber,
      recoveredAmountCents,
      recoveryYieldPercent,
      settlementNotes: settlementNotes || dispute.settlementNotes || null,
      resolvedAt: now,
      statusHistory,
    });

    if (!updatedDispute) {
      throw new Error(`Failed to update carrier dispute ${disputeId} with credit memo.`);
    }

    // 5. Update Associated Carrier Invoice to SETTLED
    let updatedInvoice: CarrierInvoice | null = null;
    if (dispute.carrierInvoiceId) {
      updatedInvoice = await dbClient.updateCarrierInvoice(dispute.carrierInvoiceId, {
        status: 'SETTLED',
      });
    }

    // 6. Update Associated Discrepancy Record to SETTLED if present
    let updatedDiscrepancy: DiscrepancyRecord | null = null;
    if (dispute.discrepancyId) {
      updatedDiscrepancy = await dbClient.updateDiscrepancyRecord(dispute.discrepancyId, {
        status: 'SETTLED',
      });
    }

    return {
      success: true,
      dispute: updatedDispute,
      carrierInvoice: updatedInvoice,
      discrepancy: updatedDiscrepancy,
      recoveredAmountCents,
      disputedAmountCents,
      recoveryYieldPercent,
      creditMemoNumber,
      settledAt: now,
    };
  }

  /**
   * Compute comprehensive dispute recovery metrics for a tenant
   */
  public static async getDisputeMetrics(tenantId: string): Promise<DisputeMetricsSummary> {
    dbClient.setTenantContext(tenantId);

    const allDisputes = await dbClient.getCarrierDisputesByTenant(tenantId);
    const byStatus: Record<DisputeStatus, number> = {
      FLAGGED: 0,
      DISPUTE_GENERATED: 0,
      SUBMITTED: 0,
      IN_REVIEW: 0,
      CREDIT_ISSUED: 0,
      DENIED: 0,
      ESCALATED: 0,
    };

    let totalDisputedAmountCents = 0;
    let totalRecoveredAmountCents = 0;
    let fmcsaViolationsCount = 0;
    let escalatedDisputesCount = 0;

    for (const d of allDisputes) {
      const status = (d.disputeStatus || d.status || 'FLAGGED') as DisputeStatus;
      if (byStatus[status] !== undefined) {
        byStatus[status]++;
      }

      totalDisputedAmountCents += d.disputedAmountCents || 0;
      totalRecoveredAmountCents += d.recoveredAmountCents || 0;

      if (d.isFmcsaViolated) {
        fmcsaViolationsCount++;
      }
      if (status === 'ESCALATED') {
        escalatedDisputesCount++;
      }
    }

    let overallRecoveryYieldPercent = 0;
    if (totalDisputedAmountCents > 0) {
      overallRecoveryYieldPercent =
        Math.round((totalRecoveredAmountCents / totalDisputedAmountCents) * 10000) / 100;
    }

    return {
      tenantId,
      totalDisputesCount: allDisputes.length,
      byStatus,
      totalDisputedAmountCents,
      totalRecoveredAmountCents,
      overallRecoveryYieldPercent,
      fmcsaViolationsCount,
      escalatedDisputesCount,
    };
  }
}
