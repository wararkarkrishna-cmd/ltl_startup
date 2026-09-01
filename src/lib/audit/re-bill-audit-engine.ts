import { z } from 'zod';
import { dbClient } from '../../db/client';
import {
  CarrierInvoice,
  CarrierInvoiceSchema,
  RateConfirmation,
  Quote,
  Shipment,
  ShipmentItem,
} from '../../db/schema';

// ============================================================================
// SCHEMAS & TYPES FOR LINE-ITEM AUDIT RECONCILIATION
// ============================================================================

export const AccessorialDeltaItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().optional(),
  billedCents: z.number().int().nonnegative(),
  quotedCents: z.number().int().nonnegative(),
  deltaCents: z.number().int(), // billedCents - quotedCents
  isUnapproved: z.boolean(),
  description: z.string().optional(),
});
export type AccessorialDeltaItem = z.infer<typeof AccessorialDeltaItemSchema>;

export const LineItemDeltasSchema = z.object({
  totalDeltaCents: z.number().int(),
  linehaulDeltaCents: z.number().int(),
  fuelDeltaCents: z.number().int(),
  accessorialDeltaCents: z.number().int(),
  weightDeltaLbs: z.number(),
  classDelta: z
    .object({
      quotedClass: z.string(),
      billedClass: z.string(),
      isBumped: z.boolean(),
    })
    .nullable(),
  accessorials: z.array(AccessorialDeltaItemSchema),
});
export type LineItemDeltas = z.infer<typeof LineItemDeltasSchema>;

export const ContractBaselineSchema = z.object({
  source: z.enum(['RATE_CONFIRMATION', 'QUOTE', 'SHIPMENT_DEFAULT']),
  rateConfirmationId: z.string().uuid().optional().nullable(),
  quoteId: z.string().uuid().optional().nullable(),
  carrierScac: z.string(),
  carrierName: z.string(),
  agreedLinehaulCents: z.number().int().nonnegative(),
  agreedFuelCents: z.number().int().nonnegative(),
  agreedAccessorialCents: z.number().int().nonnegative(),
  totalAgreedRateCents: z.number().int().nonnegative(),
  quotedWeightLbs: z.number().nonnegative(),
  quotedClass: z.string(),
  quotedAccessorials: z.record(z.number().int()),
  agreedFuelPercent: z.number().optional().nullable(),
  agreedTariffBase: z.string().optional().nullable(),
});
export type ContractBaseline = z.infer<typeof ContractBaselineSchema>;

export const AuditReconciliationResultSchema = z.object({
  invoiceId: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  proNumber: z.string(),
  carrierScac: z.string(),
  status: z.enum(['AUDITED_CLEAN', 'DISCREPANCY_FLAGGED']),
  toleranceCents: z.number().int().nonnegative(),
  isWithinTolerance: z.boolean(),
  hasUnapprovedAccessorials: z.boolean(),
  invoicedTotalCents: z.number().int().nonnegative(),
  expectedTotalCents: z.number().int().nonnegative(),
  deltas: LineItemDeltasSchema,
  discrepancyCount: z.number().int().nonnegative(),
  contractBaseline: ContractBaselineSchema,
  auditedAt: z.date(),
});
export type AuditReconciliationResult = z.infer<typeof AuditReconciliationResultSchema>;

export const BatchAuditSummarySchema = z.object({
  tenantId: z.string().uuid(),
  totalInvoicesProcessed: z.number().int().nonnegative(),
  auditedCleanCount: z.number().int().nonnegative(),
  discrepancyFlaggedCount: z.number().int().nonnegative(),
  totalDiscrepancyAmountCents: z.number().int().nonnegative(),
  results: z.array(AuditReconciliationResultSchema),
  completedAt: z.date(),
});
export type BatchAuditSummary = z.infer<typeof BatchAuditSummarySchema>;

export interface AuditOptions {
  toleranceCents?: number;
  autoUpdateInvoiceStatus?: boolean;
}

// ============================================================================
// RE-BILL AUDIT ENGINE
// ============================================================================

export class ReBillAuditEngine {
  /**
   * Standard tolerance threshold: $5.00 (500 integer cents)
   */
  public static readonly STANDARD_TOLERANCE_CENTS = 500;

  /**
   * Compares carrier final invoice against contracted rate agreement line-by-line
   */
  public static async auditCarrierInvoice(
    tenantId: string,
    invoiceId: string,
    options?: AuditOptions
  ): Promise<AuditReconciliationResult> {
    dbClient.setTenantContext(tenantId);

    const toleranceCents = options?.toleranceCents ?? this.STANDARD_TOLERANCE_CENTS;
    const autoUpdateStatus = options?.autoUpdateInvoiceStatus ?? true;

    // 1. Fetch Carrier Invoice
    const invoice = await dbClient.getCarrierInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Carrier invoice with ID "${invoiceId}" not found for tenant "${tenantId}".`);
    }

    // 2. Fetch Associated Shipment
    if (!invoice.shipmentId) {
      throw new Error(`Carrier invoice with ID "${invoiceId}" is not linked to any shipment.`);
    }
    const shipment = await dbClient.getShipmentById(invoice.shipmentId);
    if (!shipment) {
      throw new Error(`Associated shipment with ID "${invoice.shipmentId}" not found.`);
    }

    // 3. Fetch Shipment Items for NMFC class and piece weights
    let shipmentItems: ShipmentItem[] = [];
    for (const item of dbClient.shipmentItems.values()) {
      if (item.tenantId === tenantId && item.shipmentId === shipment.id) {
        shipmentItems.push(item);
      }
    }

    // 4. Resolve Contracted Baseline (Rate Confirmation -> Quote -> Shipment Default)
    const contractBaseline = await this.resolveContractBaseline(
      tenantId,
      shipment,
      shipmentItems,
      invoice.carrierScac
    );

    // 5. Extract Invoiced Line Items
    const billedLinehaulCents =
      invoice.invoicedLinehaulCents ?? invoice.billedLinehaulCents ?? invoice.linehaulBilledCents ?? 0;
    const billedFuelCents =
      invoice.invoicedFuelCents ?? invoice.billedFuelCents ?? invoice.fuelBilledCents ?? 0;
    const billedAccessorialCents =
      invoice.invoicedAccessorialCents ?? invoice.billedAccessorialCents ?? invoice.accessorialsBilledCents ?? 0;
    const totalBilledCents =
      invoice.invoicedTotalCents ?? invoice.totalBilledCents ?? (billedLinehaulCents + billedFuelCents + billedAccessorialCents);
    const billedWeightLbs = invoice.invoicedWeightLbs ?? invoice.billedWeightLbs ?? shipment.totalWeightLbs;
    const billedClass = invoice.invoicedClass ?? invoice.billedClass ?? contractBaseline.quotedClass;

    // Normalize accessorials map
    const billedAccessorials: Record<string, number> = { ...(invoice.billedAccessorials || {}) };
    if (Array.isArray(invoice.invoicedAccessorialBreakdown)) {
      for (const item of invoice.invoicedAccessorialBreakdown) {
        if (item.code && item.code !== '400' && item.code !== 'LH' && item.code !== 'FUE' && item.code !== 'FSC') {
          billedAccessorials[item.code] = (billedAccessorials[item.code] || 0) + item.amountCents;
        }
      }
    } else if (Array.isArray(invoice.itemizedCharges) && invoice.itemizedCharges.length > 0) {
      for (const item of invoice.itemizedCharges) {
        if (item.code && item.code !== 'LINEHAUL' && item.code !== 'FUEL') {
          billedAccessorials[item.code] = (billedAccessorials[item.code] || 0) + item.amountCents;
        }
      }
    }

    // 6. Compute Mathematical Deltas (Exact Integer Cents)
    // ΔTotal = Carrier Invoiced Total Cents - Quoted Expected Rate Cents
    const totalDeltaCents = totalBilledCents - contractBaseline.totalAgreedRateCents;
    // ΔLinehaul = Billed Linehaul Cents - Quoted Linehaul Cents
    const linehaulDeltaCents = billedLinehaulCents - contractBaseline.agreedLinehaulCents;
    // ΔFuel = Billed Fuel Cents - Quoted Fuel Cents
    const fuelDeltaCents = billedFuelCents - contractBaseline.agreedFuelCents;
    // ΔAccessorial = Billed Accessorial Cents - Quoted Accessorial Cents
    const accessorialDeltaCents = billedAccessorialCents - contractBaseline.agreedAccessorialCents;
    // ΔWeight = Billed Weight Lbs - Quoted Weight Lbs
    const weightDeltaLbs = billedWeightLbs - contractBaseline.quotedWeightLbs;

    // 7. Accessorial Delta Reconciliation & Injected Surcharge Detection
    const accessorialDeltaItems: AccessorialDeltaItem[] = [];
    let hasUnapprovedAccessorials = false;

    // Check billed accessorials against quoted accessorials
    const allAccessorialKeys = Array.from(
      new Set([
        ...Object.keys(billedAccessorials),
        ...Object.keys(contractBaseline.quotedAccessorials),
      ])
    );

    for (const code of allAccessorialKeys) {
      const billedFee = billedAccessorials[code] || 0;
      const quotedFee = contractBaseline.quotedAccessorials[code] || 0;
      const feeDelta = billedFee - quotedFee;
      const isUnapproved = quotedFee === 0 && billedFee > 0;

      if (isUnapproved) {
        hasUnapprovedAccessorials = true;
      }

      accessorialDeltaItems.push({
        code,
        billedCents: billedFee,
        quotedCents: quotedFee,
        deltaCents: feeDelta,
        isUnapproved,
      });
    }

    // Class Bump Detection
    const quotedClassNum = parseFloat(contractBaseline.quotedClass.replace(/[^0-9.]/g, '')) || 70;
    const billedClassNum = parseFloat(billedClass.replace(/[^0-9.]/g, '')) || quotedClassNum;
    const isClassBumped = billedClassNum > quotedClassNum;

    const classDelta = {
      quotedClass: contractBaseline.quotedClass,
      billedClass,
      isBumped: isClassBumped,
    };

    const deltas: LineItemDeltas = {
      totalDeltaCents,
      linehaulDeltaCents,
      fuelDeltaCents,
      accessorialDeltaCents,
      weightDeltaLbs,
      classDelta,
      accessorials: accessorialDeltaItems,
    };

    // 8. Apply Standard Tolerance Threshold Rule
    // Standard tolerance: $5.00 (500 cents).
    // If |ΔTotal| <= 500 cents AND no unapproved accessorials exist -> AUDITED_CLEAN
    // If ΔTotal > 500 cents OR unapproved accessorials exist -> DISCREPANCY_FLAGGED
    const isWithinTolerance = Math.abs(totalDeltaCents) <= toleranceCents;
    let auditStatus: 'AUDITED_CLEAN' | 'DISCREPANCY_FLAGGED';

    if (isWithinTolerance && !hasUnapprovedAccessorials && !isClassBumped && weightDeltaLbs <= 50) {
      auditStatus = 'AUDITED_CLEAN';
    } else {
      auditStatus = 'DISCREPANCY_FLAGGED';
    }

    // Count distinct discrepancy flags
    let discrepancyCount = 0;
    if (totalDeltaCents > toleranceCents) discrepancyCount++;
    if (hasUnapprovedAccessorials) discrepancyCount++;
    if (isClassBumped) discrepancyCount++;
    if (weightDeltaLbs > 50) discrepancyCount++;
    if (fuelDeltaCents > toleranceCents) discrepancyCount++;

    const result: AuditReconciliationResult = {
      invoiceId: invoice.id,
      tenantId,
      shipmentId: shipment.id,
      proNumber: invoice.proNumber,
      carrierScac: invoice.carrierScac,
      status: auditStatus,
      toleranceCents,
      isWithinTolerance,
      hasUnapprovedAccessorials,
      invoicedTotalCents: totalBilledCents,
      expectedTotalCents: contractBaseline.totalAgreedRateCents,
      deltas,
      discrepancyCount,
      contractBaseline,
      auditedAt: new Date(),
    };

    // 9. Update Carrier Invoice Status in Database
    if (autoUpdateStatus) {
      await dbClient.updateCarrierInvoice(invoice.id, {
        status: auditStatus,
      });
    }

    return AuditReconciliationResultSchema.parse(result);
  }

  /**
   * Batch Audit all pending carrier invoices for a given tenant
   */
  public static async auditBatch(
    tenantId: string,
    options?: AuditOptions & { limit?: number }
  ): Promise<BatchAuditSummary> {
    dbClient.setTenantContext(tenantId);

    const invoices = await dbClient.getCarrierInvoices(tenantId);
    const pendingInvoices = invoices.filter(
      (inv) => inv.status === 'PENDING_AUDIT' || inv.status === 'RECEIVED'
    );

    const limit = options?.limit ?? pendingInvoices.length;
    const targetInvoices = pendingInvoices.slice(0, limit);

    const results: AuditReconciliationResult[] = [];
    let auditedCleanCount = 0;
    let discrepancyFlaggedCount = 0;
    let totalDiscrepancyAmountCents = 0;

    for (const inv of targetInvoices) {
      try {
        const res = await this.auditCarrierInvoice(tenantId, inv.id, options);
        results.push(res);

        if (res.status === 'AUDITED_CLEAN') {
          auditedCleanCount++;
        } else {
          discrepancyFlaggedCount++;
          if (res.deltas.totalDeltaCents > 0) {
            totalDiscrepancyAmountCents += res.deltas.totalDeltaCents;
          }
        }
      } catch (err) {
        // Continue processing batch on individual invoice error
        console.error(`[ReBillAuditEngine.auditBatch] Failed auditing invoice ${inv.id}:`, err);
      }
    }

    const summary: BatchAuditSummary = {
      tenantId,
      totalInvoicesProcessed: results.length,
      auditedCleanCount,
      discrepancyFlaggedCount,
      totalDiscrepancyAmountCents,
      results,
      completedAt: new Date(),
    };

    return BatchAuditSummarySchema.parse(summary);
  }

  /**
   * Resolves contracted pricing baseline for the shipment
   */
  private static async resolveContractBaseline(
    tenantId: string,
    shipment: Shipment,
    shipmentItems: ShipmentItem[],
    carrierScac: string
  ): Promise<ContractBaseline> {
    // 1. Try to find Rate Confirmation
    const rateConf = await dbClient.getRateConfirmationByShipmentId(tenantId, shipment.id);
    const primaryItem = shipmentItems[0];
    const quotedClass = primaryItem?.nmfcClass || '70';

    if (rateConf) {
      return {
        source: 'RATE_CONFIRMATION',
        rateConfirmationId: rateConf.id,
        quoteId: null,
        carrierScac: rateConf.carrierScac,
        carrierName: rateConf.carrierName,
        agreedLinehaulCents: rateConf.agreedLinehaulCents,
        agreedFuelCents: rateConf.agreedFuelCents,
        agreedAccessorialCents: rateConf.agreedAccessorialCents,
        totalAgreedRateCents: rateConf.totalAgreedRateCents,
        quotedWeightLbs: shipment.totalWeightLbs,
        quotedClass,
        quotedAccessorials: {},
        agreedFuelPercent: null,
        agreedTariffBase: null,
      };
    }

    // 2. Try to find selected Quote or carrier-matching Quote
    const quotes = await dbClient.getQuotesByShipmentId(tenantId, shipment.id);
    const sortedQuotes = [...quotes].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const selectedQuote =
      sortedQuotes.find(
        (q) => q.isSelected && q.carrierScac.toUpperCase() === carrierScac.toUpperCase()
      ) ||
      sortedQuotes.find((q) => q.isSelected) ||
      sortedQuotes.find(
        (q) => q.carrierScac.toUpperCase() === carrierScac.toUpperCase()
      ) ||
      sortedQuotes[0];

    if (selectedQuote) {
      return {
        source: 'QUOTE',
        rateConfirmationId: null,
        quoteId: selectedQuote.id,
        carrierScac: selectedQuote.carrierScac,
        carrierName: selectedQuote.carrierName,
        agreedLinehaulCents: selectedQuote.linehaulCostCents,
        agreedFuelCents: selectedQuote.fuelSurchargeCents,
        agreedAccessorialCents: selectedQuote.accessorialCostCents,
        totalAgreedRateCents: selectedQuote.totalCarrierCostCents,
        quotedWeightLbs: shipment.totalWeightLbs,
        quotedClass,
        quotedAccessorials: selectedQuote.accessorialFees || {},
        agreedFuelPercent: null,
        agreedTariffBase: selectedQuote.sourceTag || null,
      };
    }

    // 3. Fallback: Shipment Default
    return {
      source: 'SHIPMENT_DEFAULT',
      rateConfirmationId: null,
      quoteId: null,
      carrierScac,
      carrierName: 'Contracted Carrier',
      agreedLinehaulCents: 0,
      agreedFuelCents: 0,
      agreedAccessorialCents: 0,
      totalAgreedRateCents: 0,
      quotedWeightLbs: shipment.totalWeightLbs,
      quotedClass,
      quotedAccessorials: {},
      agreedFuelPercent: null,
      agreedTariffBase: null,
    };
  }
}
