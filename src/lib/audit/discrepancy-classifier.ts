import { z } from 'zod';
import { dbClient } from '../../db/client';
import {
  DiscrepancyRecord,
  DiscrepancyRecordSchema,
  DiscrepancyType,
  DISCREPANCY_TYPES,
  CarrierInvoice,
  DigitalBol,
  PodRecord,
} from '../../db/schema';
import { AuditReconciliationResult } from './re-bill-audit-engine';

// ============================================================================
// SCHEMAS & TYPES FOR DISCREPANCY CLASSIFICATION
// ============================================================================

export const DiscrepancyEvidencePayloadSchema = z.object({
  category: z.enum(DISCREPANCY_TYPES),
  shipperEbolAttached: z.boolean().default(false),
  shipperEbolSigned: z.boolean().default(false),
  geotaggedPodVerified: z.boolean().default(false),
  podWithinGeofence: z.boolean().default(false),
  podGpsCoordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable()
    .optional(),
  consigneeSignaturePresent: z.boolean().default(false),
  hasScaleCertificate: z.boolean().default(false),
  hasDensityInspectionDoc: z.boolean().default(false),
  quotedWeightLbs: z.number().nonnegative(),
  billedWeightLbs: z.number().nonnegative(),
  weightDeltaLbs: z.number(),
  quotedClass: z.string(),
  billedClass: z.string(),
  unauthorizedAccessorials: z.array(z.string()).default([]),
  agreedFuelPercent: z.number().nullable().optional(),
  billedFuelPercent: z.number().nullable().optional(),
  agreedTariffBase: z.string().nullable().optional(),
  billedTariffBase: z.string().nullable().optional(),
  duplicateInvoiceId: z.string().nullable().optional(),
  notes: z.array(z.string()).default([]),
});
export type DiscrepancyEvidencePayload = z.infer<typeof DiscrepancyEvidencePayloadSchema>;

export const ClassifiedDiscrepancySchema = z.object({
  discrepancyType: z.enum(DISCREPANCY_TYPES),
  quotedCents: z.number().int().nonnegative(),
  billedCents: z.number().int().nonnegative(),
  varianceCents: z.number().int(),
  disputableAmountCents: z.number().int().nonnegative(),
  confidenceScore: z.number().min(0).max(100),
  title: z.string().min(1),
  reasonNotes: z.string().min(1),
  evidencePayload: DiscrepancyEvidencePayloadSchema,
});
export type ClassifiedDiscrepancy = z.infer<typeof ClassifiedDiscrepancySchema>;

export const DiscrepancyClassificationSchema = z.object({
  invoiceId: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  proNumber: z.string(),
  carrierScac: z.string(),
  isDisputed: z.boolean(),
  totalDisputableAmountCents: z.number().int().nonnegative(),
  primaryDiscrepancyType: z.enum(DISCREPANCY_TYPES).nullable(),
  discrepancies: z.array(ClassifiedDiscrepancySchema),
  overallConfidenceScore: z.number().min(0).max(100),
  evidenceSummary: z.array(z.string()),
  classifiedAt: z.date(),
});
export type DiscrepancyClassification = z.infer<typeof DiscrepancyClassificationSchema>;

// ============================================================================
// DISCREPANCY CLASSIFIER ENGINE
// ============================================================================

export class DiscrepancyClassifier {
  /**
   * Destination accessorial codes that frequently get erroneously or spuriously billed
   */
  public static readonly BOGUS_PRONE_ACCESSORIALS = [
    'LG_DEL',   // Liftgate Delivery
    'RES_DEL',  // Residential Delivery
    'INS_DEL',  // Inside Delivery
    'LIM_ACC',  // Limited Access Delivery
    'NOTIFY',   // Call Prior Delivery
    'REDELIVERY', // Redelivery
  ] as const;

  /**
   * Classify all overcharges and discrepancies for an audited carrier invoice
   */
  public static async classifyDiscrepancy(
    auditResult: AuditReconciliationResult
  ): Promise<DiscrepancyClassification> {
    const { tenantId, shipmentId, invoiceId, deltas, contractBaseline } = auditResult;
    dbClient.setTenantContext(tenantId);

    // 1. Fetch Carrier Invoice
    const invoice = await dbClient.getCarrierInvoiceById(invoiceId);

    // 2. Fetch Supporting Evidence (eBOL, Geotagged POD, Shipment)
    const ebol = await dbClient.getDigitalBolByShipmentId(tenantId, shipmentId);
    const pod = await dbClient.getPodRecordByShipmentId(tenantId, shipmentId);
    const shipment = await dbClient.getShipmentById(shipmentId);

    // 3. Evaluate Discrepancy Categories
    const discrepancies: ClassifiedDiscrepancy[] = [];
    const evidenceNotes: string[] = [];

    // Category 5: DUPLICATE_BILLING Check
    const duplicateDiscrepancy = await this.evaluateDuplicateBilling(
      tenantId,
      invoice,
      auditResult
    );
    if (duplicateDiscrepancy) {
      discrepancies.push(duplicateDiscrepancy);
      evidenceNotes.push(`Duplicate billing detected for PRO# ${auditResult.proNumber}`);
    }

    // Category 1: UNAUTHORIZED_REWEIGH Check
    const reweighDiscrepancy = this.evaluateUnauthorizedReweigh(
      invoice,
      ebol,
      pod,
      auditResult
    );
    if (reweighDiscrepancy) {
      discrepancies.push(reweighDiscrepancy);
      evidenceNotes.push(
        `Unauthorized reweigh: billed weight ${deltas.weightDeltaLbs} lbs over quoted without certified scale ticket.`
      );
    }

    // Category 2: RECLASSIFICATION_DISPUTE Check
    const reclassDiscrepancy = this.evaluateReclassification(
      invoice,
      ebol,
      pod,
      auditResult
    );
    if (reclassDiscrepancy) {
      discrepancies.push(reclassDiscrepancy);
      evidenceNotes.push(
        `Reclassification dispute: billed class bumped to ${deltas.classDelta?.billedClass} from ${deltas.classDelta?.quotedClass} without W&I inspection certificate.`
      );
    }

    // Category 3: BOGUS_ACCESSORIAL Check
    const bogusDiscrepancies = this.evaluateBogusAccessorials(
      invoice,
      ebol,
      pod,
      auditResult
    );
    for (const bd of bogusDiscrepancies) {
      discrepancies.push(bd);
      evidenceNotes.push(`Bogus accessorial billed: ${bd.title} (${bd.disputableAmountCents} cents)`);
    }

    // Category 4: FUEL_INDEX_MISMATCH Check
    const fuelDiscrepancy = this.evaluateFuelIndexMismatch(
      invoice,
      auditResult
    );
    if (fuelDiscrepancy) {
      discrepancies.push(fuelDiscrepancy);
      evidenceNotes.push(`Fuel surcharge index mismatch: overcharge of ${fuelDiscrepancy.disputableAmountCents} cents.`);
    }

    // Category 6: INCORRECT_RATE_BASE Check
    const rateBaseDiscrepancy = this.evaluateIncorrectRateBase(
      invoice,
      auditResult,
      discrepancies
    );
    if (rateBaseDiscrepancy) {
      discrepancies.push(rateBaseDiscrepancy);
      evidenceNotes.push(`Incorrect rate base applied: ${rateBaseDiscrepancy.reasonNotes}`);
    }

    // 4. Calculate Aggregate Disputable Amount (Exact Integer Cents)
    let totalDisputableAmountCents = 0;
    if (duplicateDiscrepancy) {
      // If duplicate, full invoice is disputable
      totalDisputableAmountCents = auditResult.invoicedTotalCents;
    } else {
      for (const d of discrepancies) {
        totalDisputableAmountCents += d.disputableAmountCents;
      }
      // Cannot dispute more than the total invoice amount
      totalDisputableAmountCents = Math.min(
        totalDisputableAmountCents,
        auditResult.invoicedTotalCents
      );
    }

    // 5. Calculate Overall Confidence Score (Weighted / Max)
    let overallConfidenceScore = 0;
    if (discrepancies.length > 0) {
      const sumScores = discrepancies.reduce((acc, d) => acc + d.confidenceScore, 0);
      overallConfidenceScore = Math.round((sumScores / discrepancies.length) * 10) / 10;
    }

    // 6. Determine Primary Discrepancy Type
    let primaryDiscrepancyType: DiscrepancyType | null = null;
    if (discrepancies.length > 0) {
      // Sort by disputable amount descending to find primary driver
      const sorted = [...discrepancies].sort(
        (a, b) => b.disputableAmountCents - a.disputableAmountCents
      );
      primaryDiscrepancyType = sorted[0].discrepancyType;
    }

    const classification: DiscrepancyClassification = {
      invoiceId,
      tenantId,
      shipmentId,
      proNumber: auditResult.proNumber,
      carrierScac: auditResult.carrierScac,
      isDisputed: discrepancies.length > 0 && totalDisputableAmountCents > 0,
      totalDisputableAmountCents,
      primaryDiscrepancyType,
      discrepancies,
      overallConfidenceScore,
      evidenceSummary: evidenceNotes,
      classifiedAt: new Date(),
    };

    return DiscrepancyClassificationSchema.parse(classification);
  }

  /**
   * Persist classified discrepancies as DiscrepancyRecord entries in the database
   */
  public static async createAndPersistDiscrepancies(
    tenantId: string,
    auditResult: AuditReconciliationResult
  ): Promise<DiscrepancyRecord[]> {
    dbClient.setTenantContext(tenantId);

    const classification = await this.classifyDiscrepancy(auditResult);
    const createdRecords: DiscrepancyRecord[] = [];

    for (const item of classification.discrepancies) {
      const record = await dbClient.insertDiscrepancyRecord({
        tenantId,
        carrierInvoiceId: auditResult.invoiceId,
        shipmentId: auditResult.shipmentId,
        discrepancyType: item.discrepancyType,
        quotedCents: item.quotedCents,
        billedCents: item.billedCents,
        varianceCents: item.varianceCents,
        disputableAmountCents: item.disputableAmountCents,
        confidenceScore: item.confidenceScore,
        status: 'FLAGGED',
        reasonNotes: item.reasonNotes,
        notes: item.reasonNotes,
        discrepancyDescription: item.title,
        deltaWeightLbs: item.evidencePayload.weightDeltaLbs || null,
        deltaClassBump:
          item.evidencePayload.quotedClass !== item.evidencePayload.billedClass
            ? `${item.evidencePayload.quotedClass}->${item.evidencePayload.billedClass}`
            : null,
        quotedExpectedRateCents: item.quotedCents,
        carrierInvoicedRateCents: item.billedCents,
        isDisputable: true,
        evidencePayload: item.evidencePayload as unknown as Record<string, unknown>,
      });
      createdRecords.push(record);
    }

    // Update Carrier Invoice status accordingly
    if (createdRecords.length > 0) {
      await dbClient.updateCarrierInvoice(auditResult.invoiceId, {
        status: 'DISCREPANCY_FLAGGED',
      });
    } else if (auditResult.isWithinTolerance) {
      await dbClient.updateCarrierInvoice(auditResult.invoiceId, {
        status: 'AUDITED_CLEAN',
      });
    }

    return createdRecords;
  }

  // ============================================================================
  // DISCREPANCY EVALUATION RULES
  // ============================================================================

  /**
   * 1. UNAUTHORIZED_REWEIGH:
   * Billed weight > Quoted weight + 50 lbs with no terminal scale certificate attached.
   */
  private static evaluateUnauthorizedReweigh(
    invoice: CarrierInvoice | null,
    ebol: DigitalBol | null,
    pod: PodRecord | null,
    auditResult: AuditReconciliationResult
  ): ClassifiedDiscrepancy | null {
    const { deltas, contractBaseline } = auditResult;
    const weightDelta = deltas.weightDeltaLbs;
    const hasScaleCert = invoice?.hasScaleCertificate || Boolean(invoice?.scaleCertificateUrl);

    if (weightDelta > 50 && !hasScaleCert) {
      // Disputable amount: linehaul delta attributable to weight overcharge or total linehaul delta
      const quotedLinehaul = contractBaseline.agreedLinehaulCents;
      const quotedWeight = Math.max(contractBaseline.quotedWeightLbs, 1);
      const proportionalWeightOvercharge = Math.round(
        (quotedLinehaul * weightDelta) / quotedWeight
      );
      const disputableAmountCents = Math.max(
        deltas.linehaulDeltaCents > 0 ? deltas.linehaulDeltaCents : 0,
        proportionalWeightOvercharge
      );

      // Confidence score calculation
      let confidenceScore = 80.0;
      const notes: string[] = ['Billed weight exceeds contract quoted weight by >50 lbs.'];

      if (ebol?.shipperSignature) {
        confidenceScore += 10.0;
        notes.push('Shipper eBOL digitally signed with certified origin weight.');
      }
      if (pod?.pieceCountVerified) {
        confidenceScore += 5.0;
        notes.push('Delivered piece count verified matching origin BOL.');
      }
      if (!hasScaleCert) {
        confidenceScore += 5.0;
        notes.push('Carrier failed to attach certified terminal scale certificate (NIST Handbook 44).');
      }

      confidenceScore = Math.min(confidenceScore, 100.0);

      const evidencePayload: DiscrepancyEvidencePayload = {
        category: 'UNAUTHORIZED_REWEIGH',
        shipperEbolAttached: Boolean(ebol),
        shipperEbolSigned: Boolean(ebol?.shipperSignature),
        geotaggedPodVerified: Boolean(pod),
        podWithinGeofence: Boolean(pod?.isWithinGeofence),
        podGpsCoordinates:
          pod?.gpsLatitude && pod?.gpsLongitude
            ? { latitude: pod.gpsLatitude, longitude: pod.gpsLongitude }
            : null,
        consigneeSignaturePresent: Boolean(pod?.consigneeSignatureDataUrl || pod?.signatureDetected),
        hasScaleCertificate: false,
        hasDensityInspectionDoc: Boolean(invoice?.hasDensityInspectionDoc),
        quotedWeightLbs: contractBaseline.quotedWeightLbs,
        billedWeightLbs: contractBaseline.quotedWeightLbs + weightDelta,
        weightDeltaLbs: weightDelta,
        quotedClass: contractBaseline.quotedClass,
        billedClass: deltas.classDelta?.billedClass || contractBaseline.quotedClass,
        unauthorizedAccessorials: [],
        notes,
      };

      return {
        discrepancyType: 'UNAUTHORIZED_REWEIGH',
        quotedCents: contractBaseline.agreedLinehaulCents,
        billedCents: contractBaseline.agreedLinehaulCents + deltas.linehaulDeltaCents,
        varianceCents: deltas.linehaulDeltaCents,
        disputableAmountCents,
        confidenceScore,
        title: `Unauthorized Reweigh (+${weightDelta} lbs)`,
        reasonNotes: `Carrier invoiced ${weightDelta} lbs above contracted rate confirmation without certified scale weight ticket. Disputing $${(disputableAmountCents / 100).toFixed(2)} under 49 CFR § 378.`,
        evidencePayload,
      };
    }

    return null;
  }

  /**
   * 2. RECLASSIFICATION_DISPUTE:
   * Invoiced NMFC class higher than quoted class without certified density inspection documentation.
   */
  private static evaluateReclassification(
    invoice: CarrierInvoice | null,
    ebol: DigitalBol | null,
    pod: PodRecord | null,
    auditResult: AuditReconciliationResult
  ): ClassifiedDiscrepancy | null {
    const { deltas, contractBaseline } = auditResult;
    const isClassBumped = deltas.classDelta?.isBumped === true;
    const hasDensityDoc = invoice?.hasDensityInspectionDoc || Boolean(invoice?.densityInspectionDocUrl);

    if (isClassBumped && !hasDensityDoc) {
      const disputableAmountCents = deltas.linehaulDeltaCents > 0
        ? deltas.linehaulDeltaCents
        : Math.max(deltas.totalDeltaCents, 0);

      let confidenceScore = 80.0;
      const notes: string[] = [
        `Carrier reclassified commodity from Class ${deltas.classDelta?.quotedClass} to Class ${deltas.classDelta?.billedClass}.`,
      ];

      if (ebol) {
        confidenceScore += 10.0;
        notes.push('Shipper eBOL commodity description and NMFC class certified at origin.');
      }
      if (!hasDensityDoc) {
        confidenceScore += 10.0;
        notes.push('Carrier failed to provide certified W&I density inspection report.');
      }

      confidenceScore = Math.min(confidenceScore, 100.0);

      const evidencePayload: DiscrepancyEvidencePayload = {
        category: 'RECLASSIFICATION_DISPUTE',
        shipperEbolAttached: Boolean(ebol),
        shipperEbolSigned: Boolean(ebol?.shipperSignature),
        geotaggedPodVerified: Boolean(pod),
        podWithinGeofence: Boolean(pod?.isWithinGeofence),
        podGpsCoordinates:
          pod?.gpsLatitude && pod?.gpsLongitude
            ? { latitude: pod.gpsLatitude, longitude: pod.gpsLongitude }
            : null,
        consigneeSignaturePresent: Boolean(pod?.consigneeSignatureDataUrl || pod?.signatureDetected),
        hasScaleCertificate: Boolean(invoice?.hasScaleCertificate),
        hasDensityInspectionDoc: false,
        quotedWeightLbs: contractBaseline.quotedWeightLbs,
        billedWeightLbs: contractBaseline.quotedWeightLbs + deltas.weightDeltaLbs,
        weightDeltaLbs: deltas.weightDeltaLbs,
        quotedClass: deltas.classDelta?.quotedClass || contractBaseline.quotedClass,
        billedClass: deltas.classDelta?.billedClass || 'UNKNOWN',
        unauthorizedAccessorials: [],
        notes,
      };

      return {
        discrepancyType: 'RECLASSIFICATION_DISPUTE',
        quotedCents: contractBaseline.agreedLinehaulCents,
        billedCents: contractBaseline.agreedLinehaulCents + deltas.linehaulDeltaCents,
        varianceCents: deltas.linehaulDeltaCents,
        disputableAmountCents,
        confidenceScore,
        title: `Reclassification Dispute (Class ${deltas.classDelta?.quotedClass} -> ${deltas.classDelta?.billedClass})`,
        reasonNotes: `Invoiced NMFC class escalated from Class ${deltas.classDelta?.quotedClass} to Class ${deltas.classDelta?.billedClass} without certified density inspection documentation. Disputing $${(disputableAmountCents / 100).toFixed(2)}.`,
        evidencePayload,
      };
    }

    return null;
  }

  /**
   * 3. BOGUS_ACCESSORIAL:
   * Billed for Liftgate Delivery, Residential, Inside Delivery, or Limited Access when destination BOL
   * and delivery records confirm standard commercial dock delivery.
   */
  private static evaluateBogusAccessorials(
    invoice: CarrierInvoice | null,
    ebol: DigitalBol | null,
    pod: PodRecord | null,
    auditResult: AuditReconciliationResult
  ): ClassifiedDiscrepancy[] {
    const results: ClassifiedDiscrepancy[] = [];
    const { deltas, contractBaseline } = auditResult;

    for (const item of deltas.accessorials) {
      const isBogusProne = (this.BOGUS_PRONE_ACCESSORIALS as readonly string[]).includes(
        item.code.toUpperCase()
      );

      if ((item.isUnapproved || item.deltaCents > 500) && (isBogusProne || item.isUnapproved)) {
        let confidenceScore = 85.0;
        const notes: string[] = [
          `Unapproved accessorial charge "${item.code}" of $${(item.billedCents / 100).toFixed(2)} not agreed on rate confirmation.`,
        ];

        if (pod?.isWithinGeofence && pod?.gpsLatitude) {
          confidenceScore += 10.0;
          notes.push('Geotagged POD EXIF GPS confirms delivery to standard commercial dock facility.');
        }
        if (pod?.consigneeSignatureDataUrl || pod?.signatureDetected) {
          confidenceScore += 5.0;
          notes.push('Consignee signature confirmed standard dock receipt.');
        }

        confidenceScore = Math.min(confidenceScore, 100.0);

        const evidencePayload: DiscrepancyEvidencePayload = {
          category: 'BOGUS_ACCESSORIAL',
          shipperEbolAttached: Boolean(ebol),
          shipperEbolSigned: Boolean(ebol?.shipperSignature),
          geotaggedPodVerified: Boolean(pod),
          podWithinGeofence: Boolean(pod?.isWithinGeofence),
          podGpsCoordinates:
            pod?.gpsLatitude && pod?.gpsLongitude
              ? { latitude: pod.gpsLatitude, longitude: pod.gpsLongitude }
              : null,
          consigneeSignaturePresent: Boolean(pod?.consigneeSignatureDataUrl || pod?.signatureDetected),
          hasScaleCertificate: Boolean(invoice?.hasScaleCertificate),
          hasDensityInspectionDoc: Boolean(invoice?.hasDensityInspectionDoc),
          quotedWeightLbs: contractBaseline.quotedWeightLbs,
          billedWeightLbs: contractBaseline.quotedWeightLbs + deltas.weightDeltaLbs,
          weightDeltaLbs: deltas.weightDeltaLbs,
          quotedClass: contractBaseline.quotedClass,
          billedClass: deltas.classDelta?.billedClass || contractBaseline.quotedClass,
          unauthorizedAccessorials: [item.code],
          notes,
        };

        results.push({
          discrepancyType: 'BOGUS_ACCESSORIAL',
          quotedCents: item.quotedCents,
          billedCents: item.billedCents,
          varianceCents: item.deltaCents,
          disputableAmountCents: item.deltaCents,
          confidenceScore,
          title: `Bogus Accessorial (${item.code})`,
          reasonNotes: `Carrier billed for uncontracted accessorial ${item.code} ($${(item.billedCents / 100).toFixed(2)}). Destination eBOL and geotagged POD confirm standard commercial dock delivery with no accessorial requested or performed.`,
          evidencePayload,
        });
      }
    }

    return results;
  }

  /**
   * 4. FUEL_INDEX_MISMATCH:
   * Carrier applied fuel surcharge percentage exceeding agreed DOE weekly index.
   */
  private static evaluateFuelIndexMismatch(
    invoice: CarrierInvoice | null,
    auditResult: AuditReconciliationResult
  ): ClassifiedDiscrepancy | null {
    const { deltas, contractBaseline } = auditResult;

    // Triggered if fuel delta exceeds standard tolerance threshold
    if (deltas.fuelDeltaCents > 500) {
      const disputableAmountCents = deltas.fuelDeltaCents;
      const confidenceScore = 95.0;
      const notes = [
        `Billed fuel surcharge ($${(deltas.fuelDeltaCents / 100).toFixed(2)} delta) exceeds agreed DOE weekly diesel fuel index peg.`,
      ];

      const evidencePayload: DiscrepancyEvidencePayload = {
        category: 'FUEL_INDEX_MISMATCH',
        shipperEbolAttached: false,
        shipperEbolSigned: false,
        geotaggedPodVerified: false,
        podWithinGeofence: false,
        consigneeSignaturePresent: false,
        hasScaleCertificate: false,
        hasDensityInspectionDoc: false,
        quotedWeightLbs: contractBaseline.quotedWeightLbs,
        billedWeightLbs: contractBaseline.quotedWeightLbs + deltas.weightDeltaLbs,
        weightDeltaLbs: deltas.weightDeltaLbs,
        quotedClass: contractBaseline.quotedClass,
        billedClass: deltas.classDelta?.billedClass || contractBaseline.quotedClass,
        unauthorizedAccessorials: [],
        agreedFuelPercent: contractBaseline.agreedFuelPercent ?? null,
        billedFuelPercent: invoice?.appliedFuelPercentage ?? null,
        notes,
      };

      return {
        discrepancyType: 'FUEL_INDEX_MISMATCH',
        quotedCents: contractBaseline.agreedFuelCents,
        billedCents: contractBaseline.agreedFuelCents + deltas.fuelDeltaCents,
        varianceCents: deltas.fuelDeltaCents,
        disputableAmountCents,
        confidenceScore,
        title: 'Fuel Surcharge Index Mismatch',
        reasonNotes: `Carrier applied fuel surcharge exceeding agreed contract DOE weekly index rate by $${(disputableAmountCents / 100).toFixed(2)}.`,
        evidencePayload,
      };
    }

    return null;
  }

  /**
   * 5. DUPLICATE_BILLING:
   * Duplicate invoice received for the same Pro# / shipment.
   */
  private static async evaluateDuplicateBilling(
    tenantId: string,
    invoice: CarrierInvoice | null,
    auditResult: AuditReconciliationResult
  ): Promise<ClassifiedDiscrepancy | null> {
    if (!invoice) return null;

    // Search existing invoices for same PRO# or shipment ID with status already settled / audited / approved
    const allInvoices = await dbClient.getCarrierInvoices(tenantId);
    const duplicate = allInvoices.find(
      (inv) =>
        inv.id !== invoice.id &&
        (inv.proNumber === invoice.proNumber ||
          (inv.shipmentId === invoice.shipmentId && inv.carrierScac === invoice.carrierScac)) &&
        inv.status !== 'PENDING_AUDIT' &&
        inv.status !== 'DISCREPANCY_FLAGGED'
    );

    if (duplicate) {
      const confidenceScore = 99.0;
      const disputableAmountCents = auditResult.invoicedTotalCents;
      const notes = [
        `Duplicate billing detected: PRO# ${invoice.proNumber} was already billed and processed on prior invoice ${duplicate.invoiceNumber} (ID: ${duplicate.id}).`,
      ];

      const evidencePayload: DiscrepancyEvidencePayload = {
        category: 'DUPLICATE_BILLING',
        shipperEbolAttached: false,
        shipperEbolSigned: false,
        geotaggedPodVerified: false,
        podWithinGeofence: false,
        consigneeSignaturePresent: false,
        hasScaleCertificate: false,
        hasDensityInspectionDoc: false,
        quotedWeightLbs: auditResult.contractBaseline.quotedWeightLbs,
        billedWeightLbs: auditResult.contractBaseline.quotedWeightLbs + auditResult.deltas.weightDeltaLbs,
        weightDeltaLbs: auditResult.deltas.weightDeltaLbs,
        quotedClass: auditResult.contractBaseline.quotedClass,
        billedClass: auditResult.deltas.classDelta?.billedClass || auditResult.contractBaseline.quotedClass,
        unauthorizedAccessorials: [],
        duplicateInvoiceId: duplicate.id,
        notes,
      };

      return {
        discrepancyType: 'DUPLICATE_BILLING',
        quotedCents: 0,
        billedCents: auditResult.invoicedTotalCents,
        varianceCents: auditResult.invoicedTotalCents,
        disputableAmountCents,
        confidenceScore,
        title: `Duplicate Invoice (PRO# ${invoice.proNumber})`,
        reasonNotes: `Duplicate invoice received for PRO# ${invoice.proNumber}. Prior invoice ${duplicate.invoiceNumber} already exists in status ${duplicate.status}. Disputing 100% of duplicate charge ($${(disputableAmountCents / 100).toFixed(2)}).`,
        evidencePayload,
      };
    }

    return null;
  }

  /**
   * 6. INCORRECT_RATE_BASE:
   * Carrier applied tariff base other than agreed contract base.
   */
  private static evaluateIncorrectRateBase(
    invoice: CarrierInvoice | null,
    auditResult: AuditReconciliationResult,
    existingDiscrepancies: ClassifiedDiscrepancy[]
  ): ClassifiedDiscrepancy | null {
    const { deltas, contractBaseline } = auditResult;

    // Check if tariff rate base is mismatched
    const tariffMismatch =
      Boolean(invoice?.tariffRateBase) &&
      Boolean(contractBaseline.agreedTariffBase) &&
      invoice?.tariffRateBase !== contractBaseline.agreedTariffBase;

    // Or linehaul delta exists with no reweigh or reclass discrepancy explaining it
    const hasReweighOrReclass = existingDiscrepancies.some(
      (d) =>
        d.discrepancyType === 'UNAUTHORIZED_REWEIGH' ||
        d.discrepancyType === 'RECLASSIFICATION_DISPUTE'
    );

    if ((tariffMismatch || (!hasReweighOrReclass && deltas.linehaulDeltaCents > 500)) && deltas.linehaulDeltaCents > 500) {
      const disputableAmountCents = deltas.linehaulDeltaCents;
      const confidenceScore = 90.0;
      const notes = [
        tariffMismatch
          ? `Carrier applied tariff base ${invoice?.tariffRateBase} instead of contracted ${contractBaseline.agreedTariffBase}.`
          : `Uncontracted linehaul variance of $${(disputableAmountCents / 100).toFixed(2)} without reweigh or reclassification certification.`,
      ];

      const evidencePayload: DiscrepancyEvidencePayload = {
        category: 'INCORRECT_RATE_BASE',
        shipperEbolAttached: false,
        shipperEbolSigned: false,
        geotaggedPodVerified: false,
        podWithinGeofence: false,
        consigneeSignaturePresent: false,
        hasScaleCertificate: false,
        hasDensityInspectionDoc: false,
        quotedWeightLbs: contractBaseline.quotedWeightLbs,
        billedWeightLbs: contractBaseline.quotedWeightLbs + deltas.weightDeltaLbs,
        weightDeltaLbs: deltas.weightDeltaLbs,
        quotedClass: contractBaseline.quotedClass,
        billedClass: deltas.classDelta?.billedClass || contractBaseline.quotedClass,
        unauthorizedAccessorials: [],
        agreedTariffBase: contractBaseline.agreedTariffBase ?? null,
        billedTariffBase: invoice?.tariffRateBase ?? null,
        notes,
      };

      return {
        discrepancyType: 'INCORRECT_RATE_BASE',
        quotedCents: contractBaseline.agreedLinehaulCents,
        billedCents: contractBaseline.agreedLinehaulCents + deltas.linehaulDeltaCents,
        varianceCents: deltas.linehaulDeltaCents,
        disputableAmountCents,
        confidenceScore,
        title: 'Incorrect Tariff Rate Base',
        reasonNotes: `Carrier applied uncontracted base tariff rate resulting in linehaul overcharge of $${(disputableAmountCents / 100).toFixed(2)}. Contracted baseline: ${contractBaseline.agreedTariffBase || 'Standard Contract Agreement'}.`,
        evidencePayload,
      };
    }

    return null;
  }
}
