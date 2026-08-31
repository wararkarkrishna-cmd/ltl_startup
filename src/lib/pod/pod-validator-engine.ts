import { z } from 'zod';
import { POD_STATUSES, EXCEPTION_SEVERITIES, PodStatus, ExceptionSeverity } from '../../db/schema';
import { ExifParser, ExifData } from './exif-parser';
import { ImageCompressor, ImageCompressionResult } from './image-compressor';
import { GeofenceValidator, GeofenceResult } from './geofence-validator';
import { OcrEngine, OcrResult } from '../ocr/ocr-engine';

export const PodValidationInputSchema = z.object({
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  consigneeName: z.string().min(1),
  receivedPieces: z.number().int().nonnegative(),
  expectedPieces: z.number().int().positive(),
  destZip: z.string().min(5),
  consigneeSignatureDataUrl: z.string().optional().nullable(),
  clientGpsLat: z.number().optional().nullable(),
  clientGpsLon: z.number().optional().nullable(),
  driverNotes: z.string().optional().nullable(),
  hasDamageNotation: z.boolean().optional().default(false),
  podToken: z.string().optional().nullable(),
  fileName: z.string().optional().default('delivery_pod.jpg'),
});

export type PodValidationInput = z.input<typeof PodValidationInputSchema>;

export const PodValidationResultSchema = z.object({
  status: z.enum(POD_STATUSES),
  overallConfidence: z.number().min(0).max(100),
  
  // Image & File
  imageHash: z.string().length(64),
  fileSizeBytes: z.number().int().nonnegative(),
  originalSizeBytes: z.number().int().nonnegative(),
  compressionRatio: z.number().nonnegative(),
  mimeType: z.string(),
  
  // Consignee Signature
  consigneeName: z.string(),
  signatureDetected: z.boolean(),
  signatureVerificationMethod: z.enum(['CANVAS_DRAWING', 'OCR_DETECTED', 'CONSIGNEE_CONFIRMED', 'NONE']),
  
  // Piece Count Cross-Check
  receivedPieces: z.number().int().nonnegative(),
  expectedPieces: z.number().int().positive(),
  pieceCountVerified: z.boolean(),
  pieceCountFoundInOcr: z.number().int().nullable().optional(),
  piecesShort: z.number().int().nonnegative().default(0),
  
  // EXIF & Hardware
  exif: z.custom<ExifData>(),
  
  // Geofence Evaluation
  geofence: z.custom<GeofenceResult>(),
  
  // OCR Document Inspection
  ocr: z.object({
    rawText: z.string(),
    confidence: z.number(),
    stampedDateDetected: z.boolean(),
    stampedDate: z.string().nullable().optional(),
    processingTimeMs: z.number(),
  }),
  
  // Damage & Exceptions
  damageCheck: z.object({
    hasDamageException: z.boolean(),
    exceptionSeverity: z.enum(EXCEPTION_SEVERITIES),
    detectedKeywords: z.array(z.string()),
    notationSnippets: z.array(z.string()),
    exceptionNotes: z.string().nullable().optional(),
  }),
  
  // Scoring Breakdown
  scoringBreakdown: z.object({
    baseScore: z.number(),
    geofenceDelta: z.number(),
    signatureDelta: z.number(),
    pieceCountDelta: z.number(),
    timestampDelta: z.number(),
    ocrLegibilityDelta: z.number(),
    exceptionPenalty: z.number(),
    finalScore: z.number(),
  }),
  
  validationFlags: z.array(z.string()),
  processedAt: z.date(),
});

export type PodValidationResult = z.infer<typeof PodValidationResultSchema>;

/**
 * Multi-Point Composite POD Validator & Authenticity Engine
 * Combines Binary EXIF Extraction, Haversine Geofencing, OCR Verification,
 * Piece Count Cross-Auditing, and Exception/Damage Detection.
 */
export class PodValidatorEngine {
  private static readonly DAMAGE_KEYWORDS: Record<string, ExceptionSeverity> = {
    // Critical
    REFUSED: 'CRITICAL',
    REJECTED: 'CRITICAL',
    DESTROYED: 'CRITICAL',
    COLLAPSED: 'CRITICAL',

    // High
    DAMAGED: 'HIGH',
    DAMAGE: 'HIGH',
    CRUSHED: 'HIGH',
    BROKEN: 'HIGH',
    LEAKING: 'HIGH',
    LEAK: 'HIGH',
    SHORTAGE: 'HIGH',
    SHORT: 'HIGH',
    MISSING: 'HIGH',

    // Medium
    TORN: 'MEDIUM',
    WET: 'MEDIUM',
    DENTED: 'MEDIUM',
    HOLE: 'MEDIUM',
    PUNCTURED: 'MEDIUM',
    PUNCTURE: 'MEDIUM',
    STAINED: 'MEDIUM',
    CONCEALED: 'MEDIUM',

    // Low
    'SUBJECT TO COUNT': 'LOW',
    SCRATCHED: 'LOW',
    DIRTY: 'LOW',
    RECOUNT: 'LOW',
  };

  /**
   * Execute Comprehensive Multi-Point Composite POD Validation
   */
  public static async validatePod(
    imageBuffer: Buffer,
    input: PodValidationInput
  ): Promise<PodValidationResult> {
    const validatedInput = PodValidationInputSchema.parse(input);
    const validationFlags: string[] = [];

    // 1. Image Compression & Cryptographic Hashing
    const compression = await ImageCompressor.processUpload(
      imageBuffer,
      validatedInput.fileName
    );

    // 2. Binary EXIF Extraction
    const exif = ExifParser.parseExif(imageBuffer, {
      fallbackGps:
        validatedInput.clientGpsLat && validatedInput.clientGpsLon
          ? { lat: validatedInput.clientGpsLat, lon: validatedInput.clientGpsLon }
          : null,
      fallbackTimestamp: new Date(),
    });

    // 3. Haversine Geofence Evaluation
    const effectiveLat = exif.gpsLatitude ?? validatedInput.clientGpsLat ?? null;
    const effectiveLon = exif.gpsLongitude ?? validatedInput.clientGpsLon ?? null;

    const geofence = GeofenceValidator.validateDeliveryLocation(
      validatedInput.destZip,
      effectiveLat,
      effectiveLon,
      0.5 // 0.5 miles threshold
    );

    if (!geofence.isWithinGeofence) {
      validationFlags.push(
        geofence.flaggedWarning || 'Delivery photo captured outside destination geofence'
      );
    }

    // 4. Optical Character Recognition (OCR) Engine
    const ocrResult = await OcrEngine.recognizeText(compression.compressedBuffer);
    const ocrText = ocrResult.text || '';

    // 5. Signature Detection Subroutine
    const signatureCheck = this.detectSignature(
      ocrText,
      validatedInput.consigneeSignatureDataUrl,
      validatedInput.consigneeName
    );

    if (!signatureCheck.detected) {
      validationFlags.push('Consignee signature not verified on delivery document');
    }

    // 6. Stamped Date & Delivery Time Extraction
    const stampedDateCheck = this.detectStampedDate(ocrText);

    // 7. Piece Count Cross-Check
    const pieceCountCheck = this.extractAndVerifyPieceCount(
      ocrText,
      validatedInput.receivedPieces,
      validatedInput.expectedPieces
    );

    if (!pieceCountCheck.isVerified) {
      validationFlags.push(
        `Piece count shortage detected: ${validatedInput.receivedPieces} received vs ${validatedInput.expectedPieces} expected (${pieceCountCheck.piecesShort} short)`
      );
    }

    // 8. Damage & Exception Detection
    const damageCheck = this.detectDamageAndExceptions(
      ocrText,
      validatedInput.driverNotes,
      validatedInput.hasDamageNotation
    );

    if (damageCheck.hasDamageException) {
      validationFlags.push(
        `Damage exception flagged (${damageCheck.exceptionSeverity}): ${damageCheck.detectedKeywords.join(', ')}`
      );
    }

    // 9. Composite Confidence Score Calculation (0.0 to 100.0)
    const scoring = this.calculateConfidenceScore({
      geofence,
      signatureDetected: signatureCheck.detected,
      pieceCountVerified: pieceCountCheck.isVerified,
      ocrConfidence: ocrResult.confidence,
      hasStampedDate: stampedDateCheck.detected,
      damageSeverity: damageCheck.exceptionSeverity,
      hasDamageException: damageCheck.hasDamageException,
      hasExif: exif.hasExif,
    });

    // 10. Final POD Status Determination
    let status: PodStatus = 'VERIFIED';

    if (
      scoring.finalScore < 50.0 ||
      (!geofence.isWithinGeofence && !signatureCheck.detected && ocrResult.confidence < 40)
    ) {
      status = 'REJECTED';
    } else if (
      damageCheck.hasDamageException ||
      !pieceCountCheck.isVerified ||
      !geofence.isWithinGeofence ||
      scoring.finalScore < 80.0
    ) {
      status = 'FLAGGED_EXCEPTION';
    }

    return {
      status,
      overallConfidence: scoring.finalScore,
      imageHash: compression.hash,
      fileSizeBytes: compression.fileSizeBytes,
      originalSizeBytes: compression.originalSizeBytes,
      compressionRatio: compression.compressionRatio,
      mimeType: compression.mimeType,
      consigneeName: validatedInput.consigneeName,
      signatureDetected: signatureCheck.detected,
      signatureVerificationMethod: signatureCheck.method,
      receivedPieces: validatedInput.receivedPieces,
      expectedPieces: validatedInput.expectedPieces,
      pieceCountVerified: pieceCountCheck.isVerified,
      pieceCountFoundInOcr: pieceCountCheck.foundCount,
      piecesShort: pieceCountCheck.piecesShort,
      exif,
      geofence,
      ocr: {
        rawText: ocrText,
        confidence: ocrResult.confidence,
        stampedDateDetected: stampedDateCheck.detected,
        stampedDate: stampedDateCheck.dateString,
        processingTimeMs: ocrResult.processingTimeMs,
      },
      damageCheck: {
        hasDamageException: damageCheck.hasDamageException,
        exceptionSeverity: damageCheck.exceptionSeverity,
        detectedKeywords: damageCheck.detectedKeywords,
        notationSnippets: damageCheck.snippets,
        exceptionNotes: validatedInput.driverNotes || null,
      },
      scoringBreakdown: scoring,
      validationFlags,
      processedAt: new Date(),
    };
  }

  /**
   * Signature Verification Subroutine
   */
  private static detectSignature(
    ocrText: string,
    signatureDataUrl?: string | null,
    consigneeName?: string
  ): { detected: boolean; method: 'CANVAS_DRAWING' | 'OCR_DETECTED' | 'CONSIGNEE_CONFIRMED' | 'NONE' } {
    // 1. Digital Signature Data URL from mobile canvas
    if (signatureDataUrl && signatureDataUrl.length > 200) {
      return { detected: true, method: 'CANVAS_DRAWING' };
    }

    // 2. OCR Text Analysis for signature stamps / signs
    const signaturePatterns = [
      /received\s*(?:by|in good order|clean)[:\s]*([a-z\s]+)/i,
      /signed\s*(?:by)?[:\s]*([a-z\s]+)/i,
      /consignee\s*(?:signature|receiver)[:\s]*([a-z\s]+)/i,
      /authorized\s*signature/i,
      /customer\s*signature/i,
      /rec'd\s*by/i,
      /driver\s*signature/i,
      /signature\s*:\s*[_\.\-a-z0-9]/i,
    ];

    for (const pattern of signaturePatterns) {
      if (pattern.test(ocrText)) {
        return { detected: true, method: 'OCR_DETECTED' };
      }
    }

    // 3. Name Match confirmation
    if (consigneeName && consigneeName.trim().length >= 3) {
      const cleanName = consigneeName.trim().toLowerCase();
      if (ocrText.toLowerCase().includes(cleanName)) {
        return { detected: true, method: 'CONSIGNEE_CONFIRMED' };
      }
    }

    return { detected: false, method: 'NONE' };
  }

  /**
   * Stamped Date & Timestamp Subroutine
   */
  private static detectStampedDate(ocrText: string): { detected: boolean; dateString: string | null } {
    const datePatterns = [
      /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/,
      /\b(\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})\b/,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
      /date[:\s]+(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
      /delivered[:\s]+(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = ocrText.match(pattern);
      if (match) {
        return { detected: true, dateString: match[0] };
      }
    }

    return { detected: false, dateString: null };
  }

  /**
   * Piece Count Cross-Auditing Subroutine
   */
  private static extractAndVerifyPieceCount(
    ocrText: string,
    receivedPieces: number,
    expectedPieces: number
  ): { isVerified: boolean; foundCount: number | null; piecesShort: number } {
    let foundCount: number | null = null;

    const piecePatterns = [
      /(\d+)\s*(?:pallets?|plts?|skids?|pcs?|pieces?|ctns?|cartons?|boxes?|pkgs?)/i,
      /(?:total\s*(?:pieces?|pallets?|qty|count)|qty|piece\s*count)[:\s]*(\d+)/i,
      /(?:received|rec'd|delivered)\s*(\d+)/i,
    ];

    for (const pattern of piecePatterns) {
      const match = ocrText.match(pattern);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 500) {
          foundCount = parsed;
          break;
        }
      }
    }

    const piecesShort = Math.max(0, expectedPieces - receivedPieces);
    const isVerified = receivedPieces >= expectedPieces && piecesShort === 0;

    return {
      isVerified,
      foundCount,
      piecesShort,
    };
  }

  /**
   * Damage & Exception Detection Subroutine
   */
  private static detectDamageAndExceptions(
    ocrText: string,
    driverNotes?: string | null,
    hasDamageNotation = false
  ): {
    hasDamageException: boolean;
    exceptionSeverity: ExceptionSeverity;
    detectedKeywords: string[];
    snippets: string[];
  } {
    const detectedKeywords: string[] = [];
    const snippets: string[] = [];
    let highestSeverity: ExceptionSeverity = 'NONE';

    const severityRanks: Record<ExceptionSeverity, number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const combinedCorpus = `${ocrText}\n${driverNotes || ''}`;

    for (const [keyword, severity] of Object.entries(this.DAMAGE_KEYWORDS)) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(combinedCorpus)) {
        detectedKeywords.push(keyword);
        
        // Find matching line/snippet
        const lines = combinedCorpus.split('\n');
        for (const line of lines) {
          if (regex.test(line) && !snippets.includes(line.trim())) {
            snippets.push(line.trim());
          }
        }

        if (severityRanks[severity] > severityRanks[highestSeverity]) {
          highestSeverity = severity;
        }
      }
    }

    if (hasDamageNotation && highestSeverity === 'NONE') {
      highestSeverity = 'HIGH';
      detectedKeywords.push('DRIVER_FLAGGED_NOTATION');
      if (driverNotes) snippets.push(driverNotes);
    }

    const hasDamageException = highestSeverity !== 'NONE' || hasDamageNotation;

    return {
      hasDamageException,
      exceptionSeverity: highestSeverity,
      detectedKeywords: Array.from(new Set(detectedKeywords)),
      snippets: snippets.slice(0, 5),
    };
  }

  /**
   * Calculate Multi-Point Weighted Confidence Score
   */
  private static calculateConfidenceScore(params: {
    geofence: GeofenceResult;
    signatureDetected: boolean;
    pieceCountVerified: boolean;
    ocrConfidence: number;
    hasStampedDate: boolean;
    damageSeverity: ExceptionSeverity;
    hasDamageException: boolean;
    hasExif: boolean;
  }): {
    baseScore: number;
    geofenceDelta: number;
    signatureDelta: number;
    pieceCountDelta: number;
    timestampDelta: number;
    ocrLegibilityDelta: number;
    exceptionPenalty: number;
    finalScore: number;
  } {
    const baseScore = 60.0;
    let geofenceDelta = 0;
    let signatureDelta = 0;
    let pieceCountDelta = 0;
    let timestampDelta = 0;
    let ocrLegibilityDelta = 0;
    let exceptionPenalty = 0;

    // 1. Geofence Check (+15 if pass, -25 if fail)
    if (params.geofence.isWithinGeofence) {
      geofenceDelta = 15.0;
    } else {
      geofenceDelta = -(params.geofence.confidencePenaltyPercent || 25.0);
    }

    // 2. Consignee Signature (+15 if detected, -20 if absent)
    if (params.signatureDetected) {
      signatureDelta = 15.0;
    } else {
      signatureDelta = -20.0;
    }

    // 3. Piece Count (+10 if verified, -20 if shortage)
    if (params.pieceCountVerified) {
      pieceCountDelta = 10.0;
    } else {
      pieceCountDelta = -20.0;
    }

    // 4. Stamped Date & Hardware Timestamp (+5)
    if (params.hasStampedDate || params.hasExif) {
      timestampDelta = 5.0;
    }

    // 5. OCR Confidence factor (+5 to -10)
    if (params.ocrConfidence >= 85.0) {
      ocrLegibilityDelta = 5.0;
    } else if (params.ocrConfidence < 60.0) {
      ocrLegibilityDelta = -10.0;
    }

    // 6. Damage Exception Penalties
    if (params.hasDamageException) {
      switch (params.damageSeverity) {
        case 'CRITICAL':
          exceptionPenalty = -30.0;
          break;
        case 'HIGH':
          exceptionPenalty = -20.0;
          break;
        case 'MEDIUM':
          exceptionPenalty = -12.0;
          break;
        case 'LOW':
          exceptionPenalty = -5.0;
          break;
        default:
          exceptionPenalty = -10.0;
      }
    }

    const rawScore =
      baseScore +
      geofenceDelta +
      signatureDelta +
      pieceCountDelta +
      timestampDelta +
      ocrLegibilityDelta +
      exceptionPenalty;

    const finalScore = Math.max(0.0, Math.min(100.0, Math.round(rawScore * 10) / 10));

    return {
      baseScore,
      geofenceDelta,
      signatureDelta,
      pieceCountDelta,
      timestampDelta,
      ocrLegibilityDelta,
      exceptionPenalty,
      finalScore,
    };
  }
}
