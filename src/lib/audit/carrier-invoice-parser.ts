import { generateUuidV7 } from '../uuidv7';
import { dbClient } from '../../db/client';
import {
  CarrierInvoice,
  CarrierInvoiceAccessorialItem,
  Shipment,
} from '../../db/schema';

export interface ParsedCarrierInvoice {
  tenantId: string;
  carrierCode: string;
  carrierScac: string;
  carrierName: string;
  carrierInvoiceNumber: string;
  proNumber: string;
  bolNumber?: string | null;
  invoicedLinehaulCents: number;
  invoicedFuelCents: number;
  invoicedAccessorialCents: number;
  invoicedAccessorialBreakdown: CarrierInvoiceAccessorialItem[];
  invoicedTotalCents: number;
  invoicedWeightLbs?: number | null;
  invoicedClass?: string | null;
  invoiceDate: Date;
  dueDate?: Date | null;
  sourceFormat: 'EDI_210' | 'PDF_OCR' | 'MANUAL';
  rawEdiPayload?: string | null;
  rawOcrText?: string | null;
}

/**
 * Standard Carrier Alpha Code (SCAC) Normalizer
 */
export function normalizeCarrierMetadata(
  scac?: string | null,
  name?: string | null
): { carrierCode: string; carrierScac: string; carrierName: string } {
  const upperScac = (scac || '').trim().toUpperCase();
  const upperName = (name || '').trim().toUpperCase();

  if (upperScac === 'XPOL' || upperScac === 'XPO' || upperName.includes('XPO')) {
    return { carrierCode: 'XPO', carrierScac: 'XPOL', carrierName: 'XPO Logistics' };
  }
  if (upperScac === 'ODFL' || upperName.includes('OLD DOMINION')) {
    return { carrierCode: 'ODFL', carrierScac: 'ODFL', carrierName: 'Old Dominion Freight Line' };
  }
  if (upperScac === 'EXLA' || upperScac === 'ESTES' || upperName.includes('ESTES')) {
    return { carrierCode: 'ESTES', carrierScac: 'EXLA', carrierName: 'Estes Express Lines' };
  }
  if (upperScac === 'SAIA' || upperName.includes('SAIA')) {
    return { carrierCode: 'SAIA', carrierScac: 'SAIA', carrierName: 'Saia LTL Freight' };
  }
  if (
    upperScac === 'ABFS' ||
    upperScac === 'ABF' ||
    upperName.includes('ARCBEST') ||
    upperName.includes('ABF')
  ) {
    return { carrierCode: 'ABF', carrierScac: 'ABFS', carrierName: 'ArcBest / ABF Freight' };
  }
  if (
    upperScac === 'RDFS' ||
    upperScac === 'RL' ||
    upperScac === 'RLCA' ||
    upperName.includes('R+L') ||
    upperName.includes('R AND L')
  ) {
    return { carrierCode: 'RL', carrierScac: 'RDFS', carrierName: 'R+L Carriers' };
  }
  if (
    upperScac === 'FXNL' ||
    upperScac === 'FXFE' ||
    upperScac === 'FEDEX' ||
    upperName.includes('FEDEX')
  ) {
    return {
      carrierCode: 'FEDEX',
      carrierScac: upperScac || 'FXNL',
      carrierName: 'FedEx Freight',
    };
  }
  if (upperScac === 'TWWF' || upperName.includes('TFORCE')) {
    return {
      carrierCode: 'TFORCE',
      carrierScac: upperScac || 'TWWF',
      carrierName: 'TForce Freight',
    };
  }

  const fallbackScac = upperScac || 'CZAR';
  return {
    carrierCode: fallbackScac.length > 8 ? fallbackScac.substring(0, 8) : fallbackScac,
    carrierScac: fallbackScac,
    carrierName: name?.trim() || fallbackScac,
  };
}

/**
 * Robust Date Parser for EDI (YYYYMMDD, YYMMDD) and OCR strings
 */
export function parseFlexibleDate(dateStr?: string | null): Date {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();

  // 8-digit EDI date: YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    const year = parseInt(trimmed.substring(0, 4), 10);
    const month = parseInt(trimmed.substring(4, 6), 10) - 1;
    const day = parseInt(trimmed.substring(6, 8), 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 6-digit EDI date: YYMMDD
  if (/^\d{6}$/.test(trimmed)) {
    const year = 2000 + parseInt(trimmed.substring(0, 2), 10);
    const month = parseInt(trimmed.substring(2, 4), 10) - 1;
    const day = parseInt(trimmed.substring(4, 6), 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // ISO or standard format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // US format: MM/DD/YYYY or MM-DD-YYYY
  const usMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (usMatch) {
    let year = parseInt(usMatch[3], 10);
    if (year < 100) year += 2000;
    const month = parseInt(usMatch[1], 10) - 1;
    const day = parseInt(usMatch[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Parses monetary string in EDI or OCR to exact integer cents
 */
export function parseCentsAmount(amountStr?: string | null): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[$,\s]/g, '').trim();
  if (!cleaned) return 0;

  if (cleaned.includes('.')) {
    return Math.round(parseFloat(cleaned) * 100);
  }

  const intVal = parseInt(cleaned, 10);
  if (isNaN(intVal)) return 0;
  return intVal;
}

/**
 * Maps standard accessorial codes from EDI/OCR to canonical codes
 */
export function mapAccessorialCode(
  rawCode: string,
  rawDescription?: string
): { code: string; description: string } {
  const codeUpper = (rawCode || '').trim().toUpperCase();
  const descUpper = (rawDescription || '').trim().toUpperCase();
  const combined = `${codeUpper} ${descUpper}`;

  if (
    codeUpper === 'LFT' ||
    codeUpper === 'LFG' ||
    combined.includes('LIFTGATE') ||
    combined.includes('HYDRAULIC')
  ) {
    return { code: 'LG_DEL', description: rawDescription?.trim() || 'Liftgate Delivery Service' };
  }
  if (
    codeUpper === 'RSD' ||
    codeUpper === 'RES' ||
    combined.includes('RESIDENTIAL') ||
    combined.includes('NON-COMMERCIAL')
  ) {
    return { code: 'RES_DEL', description: rawDescription?.trim() || 'Residential Delivery Service' };
  }
  if (
    codeUpper === 'INC' ||
    codeUpper === 'INS' ||
    codeUpper === 'IDL' ||
    combined.includes('INSIDE')
  ) {
    return { code: 'INS_DEL', description: rawDescription?.trim() || 'Inside Delivery Service' };
  }
  if (
    codeUpper === 'NOT' ||
    codeUpper === 'NTF' ||
    combined.includes('NOTIFY') ||
    combined.includes('APPOINTMENT') ||
    combined.includes('CALL BEFORE')
  ) {
    return { code: 'NOTIFY', description: rawDescription?.trim() || 'Delivery Notification / Appointment' };
  }
  if (
    codeUpper === 'LMA' ||
    codeUpper === 'LTD' ||
    codeUpper === 'LIM' ||
    combined.includes('LIMITED ACCESS') ||
    combined.includes('CONSTRUCTION') ||
    combined.includes('SITE')
  ) {
    return { code: 'LIM_ACC', description: rawDescription?.trim() || 'Limited Access Delivery' };
  }
  if (
    codeUpper === 'RWG' ||
    codeUpper === 'WTC' ||
    combined.includes('REWEIGH') ||
    combined.includes('WEIGHT VERIFICATION') ||
    combined.includes('SCALE')
  ) {
    return { code: 'REWEIGH', description: rawDescription?.trim() || 'Weight Verification & Scale Inspection' };
  }
  if (
    codeUpper === 'RCL' ||
    combined.includes('RECLASS') ||
    combined.includes('CLASS ADJUSTMENT') ||
    combined.includes('NMFC ADJUSTMENT') ||
    combined.includes('NMFC INSPECTION') ||
    combined.includes('RECLASSIFICATION')
  ) {
    return { code: 'RECLASSIFICATION', description: rawDescription?.trim() || 'NMFC Freight Reclassification Fee' };
  }
  if (
    codeUpper === 'DET' ||
    combined.includes('DETENTION') ||
    combined.includes('LAYOVER')
  ) {
    return { code: 'DETENTION', description: rawDescription?.trim() || 'Driver Detention Time' };
  }
  if (
    codeUpper === 'RED' ||
    codeUpper === 'RDL' ||
    combined.includes('REDELIVERY')
  ) {
    return { code: 'REDELIVERY', description: rawDescription?.trim() || 'Redelivery Surcharge' };
  }
  if (
    codeUpper === 'HM' ||
    codeUpper === 'HAZ' ||
    combined.includes('HAZMAT') ||
    combined.includes('HAZARDOUS')
  ) {
    return { code: 'HAZMAT', description: rawDescription?.trim() || 'Hazardous Materials Handling Fee' };
  }
  if (
    codeUpper === 'STO' ||
    codeUpper === 'STR' ||
    combined.includes('STORAGE')
  ) {
    return { code: 'STORAGE', description: rawDescription?.trim() || 'Terminal Storage Fee' };
  }

  return {
    code: codeUpper || 'OTHER_ACC',
    description: rawDescription?.trim() || `Accessorial (${codeUpper})`,
  };
}

/**
 * Phase 5.1: EDI 210 and PDF Carrier Invoice Ingestion Engine
 */
export class CarrierInvoiceParser {
  /**
   * Parse ASC X12 EDI 210 Motor Carrier Freight Details and Invoice
   */
  public static parseEdi210(ediText: string, tenantId: string): ParsedCarrierInvoice {
    if (!ediText || typeof ediText !== 'string') {
      throw new Error('Invalid EDI 210 payload: input text is empty or missing');
    }

    // Detect delimiters
    let elementDelim = '*';
    let segmentDelim = '~';

    if (ediText.startsWith('ISA')) {
      elementDelim = ediText.charAt(3) || '*';
      segmentDelim = ediText.charAt(105) || '~';
    }

    const rawSegments = ediText
      .split(new RegExp(`[${segmentDelim === '\n' ? '\\n' : '\\' + segmentDelim}\\r\\n]+`))
      .map((s) => s.trim())
      .filter(Boolean);

    let carrierInvoiceNumber = '';
    let proNumber = '';
    let bolNumber: string | null = null;
    let rawScac = '';
    let rawCarrierName = '';
    let invoiceDate: Date = new Date();
    let dueDate: Date | null = null;

    let invoicedLinehaulCents = 0;
    let invoicedFuelCents = 0;
    let invoicedTotalCents = 0;
    let invoicedWeightLbs: number | null = null;
    let invoicedClass: string | null = null;

    const accessorialBreakdown: CarrierInvoiceAccessorialItem[] = [];

    for (const segmentStr of rawSegments) {
      const el = segmentStr.split(elementDelim).map((item) => item.trim());
      const tag = el[0].toUpperCase();

      if (tag === 'B3') {
        // B3 segment: Motor Carrier Freight Details and Invoice Handling
        // B3*01:ShipmentQual*02:InvoiceNumber*03:ShipmentIdOrPro*04:PaymentMethod*05:WeightQual*06:Date*07:NetAmount*08:CorrectionCode*09:DeliveryDate*10:DateTimeQual*11:CarrierSCAC
        carrierInvoiceNumber = el[2] || carrierInvoiceNumber;

        const refVal = el[3] || '';
        if (refVal) {
          if (/^BOL/i.test(refVal) || refVal.startsWith('BL-') || refVal.startsWith('B-')) {
            bolNumber = refVal;
          } else {
            proNumber = refVal;
          }
        }

        if (el[6]) {
          invoiceDate = parseFlexibleDate(el[6]);
        }

        if (el[7]) {
          invoicedTotalCents = parseCentsAmount(el[7]);
        }

        if (el[9]) {
          dueDate = parseFlexibleDate(el[9]);
        }

        if (el[11]) {
          rawScac = el[11];
        }
      } else if (tag === 'N1') {
        // N1 segment: Name & Entity Identification
        const entityRole = el[1]?.toUpperCase();
        const entityName = el[2] || '';
        const idQual = el[3]?.toUpperCase();
        const idVal = el[4] || '';

        if (entityRole === 'CA') {
          rawCarrierName = entityName;
          if (idVal && (!rawScac || idQual === '92' || idQual === '2')) {
            rawScac = idVal;
          }
        }
      } else if (tag === 'N9') {
        // N9 segment: Reference Identification
        const refQual = el[1]?.toUpperCase();
        const refNum = el[2] || '';

        if (refQual === 'BM' || refQual === 'BOL') {
          bolNumber = refNum;
        } else if (refQual === 'CN' || refQual === 'PRO' || refQual === 'PR') {
          proNumber = refNum;
        }
      } else if (tag === 'L5') {
        // L5 segment: Commodity Description & NMFC Class
        if (el[3]) {
          invoicedClass = el[3];
        }
      } else if (tag === 'L0') {
        // L0 segment: Weight and Quantity
        if (el[2]) {
          const w = parseFloat(el[2]);
          if (!isNaN(w) && w > 0) {
            invoicedWeightLbs = w;
          }
        }
      } else if (tag === 'L1') {
        // L1 segment: Rate and Charge line items
        // E.g. L1*1*1150.00*FR*115000***400*Linehaul Freight Charge
        // Or   L1*5*100.00*FR*10000***RCL*NMFC Class Adjustment Fee
        const amountCents = parseCentsAmount(el[4] || el[2] || '0');

        // Extract special code and description from remaining elements
        let specialCode = '';
        let desc = '';

        const standardCodes = /^(400|LH|DEF|FR|BASE|LINEHAUL|FUE|FSC|FUEL|005|SUR|LFT|LFG|LG|RSD|RES|INC|INS|IDL|NOT|NTF|LMA|LIM|LTD|RWG|WTC|RCL|DET|RED|RDL|HM|HAZ|STO|STR)$/i;

        for (let i = 5; i < el.length; i++) {
          const part = el[i];
          if (!part) continue;
          if (!specialCode && standardCodes.test(part)) {
            specialCode = part.toUpperCase();
          } else if (!desc && part.length > 0) {
            desc = part;
          }
        }

        if (!specialCode && el[7]) specialCode = el[7].toUpperCase();
        if (!specialCode && el[8]) specialCode = el[8].toUpperCase();
        if (!desc && el[8] && el[8] !== specialCode) desc = el[8];
        if (!desc && el[9]) desc = el[9];

        const combined = `${specialCode} ${desc.toUpperCase()}`;

        if (
          specialCode === '400' ||
          specialCode === 'LH' ||
          specialCode === 'DEF' ||
          specialCode === 'FR' ||
          specialCode === 'BASE' ||
          combined.includes('LINEHAUL') ||
          combined.includes('BASE RATE') ||
          combined.includes('FREIGHT CHARGE')
        ) {
          invoicedLinehaulCents += amountCents;
        } else if (
          specialCode === 'FUE' ||
          specialCode === 'FSC' ||
          specialCode === 'FUEL' ||
          specialCode === '005' ||
          combined.includes('FUEL')
        ) {
          invoicedFuelCents += amountCents;
        } else {
          // Accessorial Charge
          const mapped = mapAccessorialCode(specialCode, desc);
          accessorialBreakdown.push({
            code: mapped.code,
            description: mapped.description,
            amountCents,
          });
        }
      } else if (tag === 'L3') {
        // L3 segment: Total Weight and Total Charges
        if (el[1] && (!invoicedWeightLbs || invoicedWeightLbs === 0)) {
          const w = parseFloat(el[1]);
          if (!isNaN(w) && w > 0) {
            invoicedWeightLbs = w;
          }
        }
        const totalCandidate = el[5] || el[7] || el[3];
        if (totalCandidate && invoicedTotalCents === 0) {
          invoicedTotalCents = parseCentsAmount(totalCandidate);
        }
      }
    }

    const carrierNorm = normalizeCarrierMetadata(rawScac, rawCarrierName);
    const invoicedAccessorialCents = accessorialBreakdown.reduce(
      (sum, item) => sum + item.amountCents,
      0
    );

    if (invoicedTotalCents === 0) {
      invoicedTotalCents =
        invoicedLinehaulCents + invoicedFuelCents + invoicedAccessorialCents;
    } else if (
      invoicedLinehaulCents === 0 &&
      invoicedTotalCents > invoicedFuelCents + invoicedAccessorialCents
    ) {
      invoicedLinehaulCents =
        invoicedTotalCents - (invoicedFuelCents + invoicedAccessorialCents);
    }

    if (!dueDate) {
      dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    return {
      tenantId,
      carrierCode: carrierNorm.carrierCode,
      carrierScac: carrierNorm.carrierScac,
      carrierName: carrierNorm.carrierName,
      carrierInvoiceNumber: carrierInvoiceNumber || `INV-${Date.now()}`,
      proNumber: proNumber || carrierInvoiceNumber || `PRO-${Date.now()}`,
      bolNumber: bolNumber || null,
      invoicedLinehaulCents,
      invoicedFuelCents,
      invoicedAccessorialCents,
      invoicedAccessorialBreakdown: accessorialBreakdown,
      invoicedTotalCents,
      invoicedWeightLbs: invoicedWeightLbs || null,
      invoicedClass: invoicedClass || null,
      invoiceDate,
      dueDate,
      sourceFormat: 'EDI_210',
      rawEdiPayload: ediText,
      rawOcrText: null,
    };
  }

  /**
   * Parse Carrier Final Invoice from OCR raw text stream
   */
  public static parseOcrText(rawText: string, tenantId: string): ParsedCarrierInvoice {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Invalid PDF OCR payload: input text is empty or missing');
    }

    // 1. Identify Carrier Name & SCAC
    let detectedScac: string | null = null;
    let detectedCarrierName: string | null = null;

    const scacMatch = rawText.match(/\b(?:SCAC|CARRIER\s*SCAC)\s*[:.\-]?\s*([A-Z0-9]{2,10})\b/i);
    if (scacMatch) {
      detectedScac = scacMatch[1].toUpperCase();
    }

    const carrierHeaderMatch = rawText.match(
      /(XPO\s*LOGISTICS|OLD\s*DOMINION|ESTES\s*EXPRESS|SAIA\s*LTL|ARCBEST|ABF\s*FREIGHT|R\+L\s*CARRIERS|FEDEX\s*FREIGHT|TFORCE\s*FREIGHT)/i
    );
    if (carrierHeaderMatch) {
      detectedCarrierName = carrierHeaderMatch[1];
    }

    const carrierNorm = normalizeCarrierMetadata(detectedScac, detectedCarrierName);

    // 2. Invoice Number
    let invoiceNumber = '';
    const invMatch = rawText.match(
      /(?:\bINVOICE\s*(?:NUMBER|NUM|NO\.?|#)\b|\bINV\s*(?:NUMBER|NUM|NO\.?|#)\b|\bINV#|\bINVOICE\s*[:#]|\bBILL\s*(?:NUMBER|NUM|NO\.?|#)\b|\bBILL\s*[:#])\s*[:.\-]?\s*([A-Z0-9\-]+)/i
    );
    if (
      invMatch &&
      invMatch[1] &&
      !['NUMBER', 'NUM', 'NO', 'FREIGHT', 'DATE', 'DUE'].includes(invMatch[1].toUpperCase())
    ) {
      invoiceNumber = invMatch[1].trim();
    }

    if (!invoiceNumber) {
      const fallbackInv = rawText.match(/\bINVOICE\s*[:.\-]\s*([A-Z0-9\-]+)/i);
      if (
        fallbackInv &&
        fallbackInv[1] &&
        !['NUMBER', 'NUM', 'NO', 'FREIGHT', 'DATE', 'DUE'].includes(fallbackInv[1].toUpperCase())
      ) {
        invoiceNumber = fallbackInv[1].trim();
      }
    }

    // 3. PRO Number
    let proNumber = '';
    const proMatch = rawText.match(
      /(?:\bPRO\s*(?:NUMBER|NUM|NO\.?|#)\b|\bPRO#|\bTRACKING\s*(?:NUMBER|NUM|NO\.?|#)\b|\bPRO\s*[:#])\s*[:.\-]?\s*([0-9A-Z\-]{6,24})/i
    );
    if (proMatch) {
      proNumber = proMatch[1].trim();
    }

    // 4. BOL Number
    let bolNumber: string | null = null;
    const bolMatch = rawText.match(
      /(?:\bBOL\s*(?:NUMBER|NUM|NO\.?|#)?\b|\bB\/L\s*(?:NUMBER|NUM|NO\.?|#)?\b|\bBILL\s*OF\s*LADING\s*(?:NUMBER|NUM|NO\.?|#)?\b|\bBOL\s*[:#])\s*[:.\-]?\s*([A-Z0-9\-]+)/i
    );
    if (
      bolMatch &&
      bolMatch[1] &&
      !['NUMBER', 'NUM', 'NO', 'LADING', 'DATE'].includes(bolMatch[1].toUpperCase())
    ) {
      bolNumber = bolMatch[1].trim();
    }

    // 5. Invoice Date & Due Date
    let invoiceDate: Date = new Date();
    let dueDate: Date | null = null;

    const dateMatch = rawText.match(
      /(?:INVOICE\s*DATE|DATE\s*OF\s*INVOICE|BILL\s*DATE|DATE)\s*[:.\-]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})/i
    );
    if (dateMatch) {
      invoiceDate = parseFlexibleDate(dateMatch[1]);
    }

    const dueMatch = rawText.match(
      /(?:DUE\s*DATE|PAYMENT\s*DUE|TERMS\s*DUE)\s*[:.\-]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})/i
    );
    if (dueMatch) {
      dueDate = parseFlexibleDate(dueMatch[1]);
    } else {
      dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // 6. Weight (lbs)
    let invoicedWeightLbs: number | null = null;
    const weightMatch = rawText.match(
      /(?:BILLED\s*WEIGHT|TOTAL\s*WEIGHT|WEIGHT|ACTUAL\s*WEIGHT)\s*[:.\-]?\s*([0-9,]+(?:\.\d+)?)\s*(?:LBS?|POUNDS?|LB)?/i
    );
    if (weightMatch) {
      const w = parseFloat(weightMatch[1].replace(/,/g, ''));
      if (!isNaN(w) && w > 0) invoicedWeightLbs = w;
    }

    // 7. Freight Class
    let invoicedClass: string | null = null;
    const classMatch = rawText.match(
      /(?:FREIGHT\s*CLASS|NMFC\s*CLASS|CLASS)\s*[:.\-]?\s*([0-9]{2,3}(?:\.[0-9])?)/i
    );
    if (classMatch) {
      invoicedClass = classMatch[1].trim();
    }

    // 8. Line-item financial breakdown
    let invoicedLinehaulCents = 0;
    let invoicedFuelCents = 0;
    let invoicedTotalCents = 0;
    const accessorialBreakdown: CarrierInvoiceAccessorialItem[] = [];

    // Linehaul
    const lhMatch = rawText.match(
      /(?:LINEHAUL(?:\s*FREIGHT)?(?:\s*CHARGE)?|BASE\s*RATE|FREIGHT\s*CHARGE|NET\s*FREIGHT|TRANSPORTATION\s*CHARGE)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i
    );
    if (lhMatch) {
      invoicedLinehaulCents = parseCentsAmount(lhMatch[1]);
    }

    // Fuel
    const fuelMatch = rawText.match(
      /(?:FUEL\s*SURCHARGE|FUEL\s*CHARGE|FUEL|FSC)\s*(?:\([^)]+\))?\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i
    );
    if (fuelMatch) {
      invoicedFuelCents = parseCentsAmount(fuelMatch[1]);
    }

    // Total Amount
    const totalMatch = rawText.match(
      /(?:TOTAL\s*(?:AMOUNT|DUE|CHARGES|INVOICE\s*AMOUNT)?|AMOUNT\s*DUE|NET\s*AMOUNT|BALANCE\s*DUE|NET\s*DUE)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i
    );
    if (totalMatch) {
      invoicedTotalCents = parseCentsAmount(totalMatch[1]);
    }

    // Accessorials scan per line / regex
    const accessorialPatterns: Array<{
      regex: RegExp;
      code: string;
      defaultDesc: string;
    }> = [
      {
        regex: /(?:LIFTGATE(?:\s*(?:PICKUP|DELIVERY|SERVICE|FEE))?|HYDRAULIC\s*GATE)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'LG_DEL',
        defaultDesc: 'Liftgate Delivery Service',
      },
      {
        regex: /(?:RESIDENTIAL(?:\s*(?:PICKUP|DELIVERY|SERVICE|FEE))?|NON-COMMERCIAL(?:\s*(?:PICKUP|DELIVERY))?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'RES_DEL',
        defaultDesc: 'Residential Delivery Service',
      },
      {
        regex: /(?:INSIDE(?:\s*(?:PICKUP|DELIVERY|SERVICE|FEE))?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'INS_DEL',
        defaultDesc: 'Inside Delivery Service',
      },
      {
        regex: /(?:LIMITED\s*ACCESS(?:\s*(?:PICKUP|DELIVERY|SERVICE|FEE))?|CONSTRUCTION\s*SITE)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'LIM_ACC',
        defaultDesc: 'Limited Access Service',
      },
      {
        regex: /(?:NOTIFICATION(?:\s*(?:BEFORE\s*DELIVERY|PRIOR\s*TO\s*DELIVERY|FEE|SERVICE|CHARGE))?|APPOINTMENT(?:\s*(?:BEFORE\s*DELIVERY|FEE|SERVICE))?|CALL\s*BEFORE(?:\s*DELIVERY)?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'NOTIFY',
        defaultDesc: 'Delivery Notification / Appointment',
      },
      {
        regex: /(?:REWEIGH(?:\s*(?:FEE|CHARGE|VERIFICATION|INSPECTION|SERVICE))?|WEIGHT\s*(?:VERIFICATION|INSPECTION|FEE|CHARGE))\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'REWEIGH',
        defaultDesc: 'Weight Verification & Scale Inspection',
      },
      {
        regex: /(?:RECLASSIFICATION(?:\s*(?:FEE|CHARGE|ADJUSTMENT))?|NMFC\s*(?:INSPECTION|ADJUSTMENT|FEE)|CLASS\s*ADJUSTMENT(?:\s*FEE)?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'RECLASSIFICATION',
        defaultDesc: 'NMFC Reclassification Fee',
      },
      {
        regex: /(?:HAZMAT(?:\s*(?:FEE|SURCHARGE|CHARGE))?|HAZARDOUS\s*MATERIAL(?:S)?(?:\s*(?:FEE|SURCHARGE|CHARGE|HANDLING))?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'HAZMAT',
        defaultDesc: 'Hazardous Materials Handling',
      },
      {
        regex: /(?:DETENTION(?:\s*(?:CHARGE|FEE|TIME))?|LAYOVER(?:\s*(?:CHARGE|FEE))?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'DETENTION',
        defaultDesc: 'Driver Detention Time',
      },
      {
        regex: /(?:REDELIVERY(?:\s*(?:CHARGE|FEE|ATTEMPT))?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'REDELIVERY',
        defaultDesc: 'Redelivery Surcharge',
      },
      {
        regex: /(?:STORAGE(?:\s*(?:FEE|CHARGE))?)\s*[:.\-]?\s*\$?\s*([0-9,]+(?:\.\d{2})?)/i,
        code: 'STORAGE',
        defaultDesc: 'Terminal Storage Fee',
      },
    ];

    for (const pat of accessorialPatterns) {
      const match = rawText.match(pat.regex);
      if (match && match[1]) {
        const amountCents = parseCentsAmount(match[1]);
        if (amountCents > 0) {
          accessorialBreakdown.push({
            code: pat.code,
            description: pat.defaultDesc,
            amountCents,
          });
        }
      }
    }

    const invoicedAccessorialCents = accessorialBreakdown.reduce(
      (sum, item) => sum + item.amountCents,
      0
    );

    if (invoicedTotalCents === 0) {
      invoicedTotalCents =
        invoicedLinehaulCents + invoicedFuelCents + invoicedAccessorialCents;
    } else if (
      invoicedLinehaulCents === 0 &&
      invoicedTotalCents > invoicedFuelCents + invoicedAccessorialCents
    ) {
      invoicedLinehaulCents =
        invoicedTotalCents - (invoicedFuelCents + invoicedAccessorialCents);
    }

    return {
      tenantId,
      carrierCode: carrierNorm.carrierCode,
      carrierScac: carrierNorm.carrierScac,
      carrierName: carrierNorm.carrierName,
      carrierInvoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      proNumber: proNumber || invoiceNumber || `PRO-${Date.now()}`,
      bolNumber: bolNumber || null,
      invoicedLinehaulCents,
      invoicedFuelCents,
      invoicedAccessorialCents,
      invoicedAccessorialBreakdown: accessorialBreakdown,
      invoicedTotalCents,
      invoicedWeightLbs: invoicedWeightLbs || null,
      invoicedClass: invoicedClass || null,
      invoiceDate,
      dueDate,
      sourceFormat: 'PDF_OCR',
      rawEdiPayload: null,
      rawOcrText: rawText,
    };
  }

  /**
   * Automatic Shipment Matcher & Invoice Ingestion Gateway
   */
  public static async matchAndIngestInvoice(params: {
    tenantId: string;
    rawPayload: string;
    format: 'EDI_210' | 'PDF_OCR';
  }): Promise<{ carrierInvoice: CarrierInvoice; matchedShipment: Shipment | null }> {
    const { tenantId, rawPayload, format } = params;

    dbClient.setTenantContext(tenantId);

    const parsed =
      format === 'EDI_210'
        ? this.parseEdi210(rawPayload, tenantId)
        : this.parseOcrText(rawPayload, tenantId);

    // Search internal shipments in dbClient
    let matchedShipment: Shipment | null = null;

    const cleanPro = parsed.proNumber.replace(/[-.\s]/g, '').toUpperCase();
    const cleanBol = (parsed.bolNumber || '').replace(/[-.\s]/g, '').toUpperCase();

    // 1. Check direct shipments referenceNumber
    for (const sh of dbClient.shipments.values()) {
      if (sh.tenantId === tenantId) {
        const cleanRef = sh.referenceNumber.replace(/[-.\s]/g, '').toUpperCase();
        if (
          (cleanBol && cleanRef === cleanBol) ||
          (cleanPro && cleanRef === cleanPro) ||
          (cleanBol && cleanRef.includes(cleanBol))
        ) {
          matchedShipment = sh;
          break;
        }
      }
    }

    // 2. Check Digital BOLs
    if (!matchedShipment) {
      for (const bol of dbClient.digitalBols.values()) {
        if (bol.tenantId === tenantId) {
          const bNum = bol.bolNumber.replace(/[-.\s]/g, '').toUpperCase();
          const mNum = bol.masterBolNumber.replace(/[-.\s]/g, '').toUpperCase();
          const pNum = (bol.proNumber || '').replace(/[-.\s]/g, '').toUpperCase();

          if (
            (cleanBol && (bNum === cleanBol || mNum === cleanBol)) ||
            (cleanPro && pNum === cleanPro)
          ) {
            const sh = await dbClient.getShipmentById(bol.shipmentId);
            if (sh) {
              matchedShipment = sh;
              break;
            }
          }
        }
      }
    }

    // 3. Check Carrier Tenders
    if (!matchedShipment) {
      for (const tender of dbClient.tenders.values()) {
        if (tender.tenantId === tenantId) {
          const tPro = (tender.proNumber || '').replace(/[-.\s]/g, '').toUpperCase();
          const tPick = (tender.pickupNumber || '').replace(/[-.\s]/g, '').toUpperCase();

          if (
            (cleanPro && tPro === cleanPro) ||
            (cleanBol && tPick === cleanBol)
          ) {
            const sh = await dbClient.getShipmentById(tender.shipmentId);
            if (sh) {
              matchedShipment = sh;
              break;
            }
          }
        }
      }
    }

    // 4. Check Customer Invoices
    if (!matchedShipment) {
      for (const cinv of dbClient.customerInvoices.values()) {
        if (cinv.tenantId === tenantId) {
          const cNum = cinv.invoiceNumber.replace(/[-.\s]/g, '').toUpperCase();
          const poNum = (cinv.customerPoNumber || '').replace(/[-.\s]/g, '').toUpperCase();

          if (
            (cleanBol && (cNum === cleanBol || poNum === cleanBol)) ||
            (cleanPro && (cNum === cleanPro || poNum === cleanPro))
          ) {
            const sh = await dbClient.getShipmentById(cinv.shipmentId);
            if (sh) {
              matchedShipment = sh;
              break;
            }
          }
        }
      }
    }

    // Insert Carrier Invoice into database
    const carrierInvoice = await dbClient.insertCarrierInvoice({
      tenantId,
      shipmentId: matchedShipment?.id || null,
      carrierCode: parsed.carrierCode,
      carrierScac: parsed.carrierScac,
      carrierName: parsed.carrierName,
      carrierInvoiceNumber: parsed.carrierInvoiceNumber,
      proNumber: parsed.proNumber,
      bolNumber: parsed.bolNumber || null,
      invoicedLinehaulCents: parsed.invoicedLinehaulCents,
      invoicedFuelCents: parsed.invoicedFuelCents,
      invoicedAccessorialCents: parsed.invoicedAccessorialCents,
      invoicedAccessorialBreakdown: parsed.invoicedAccessorialBreakdown,
      invoicedTotalCents: parsed.invoicedTotalCents,
      invoicedWeightLbs: parsed.invoicedWeightLbs || null,
      invoicedClass: parsed.invoicedClass || null,
      invoiceDate: parsed.invoiceDate,
      dueDate: parsed.dueDate || null,
      status: 'RECEIVED',
      rawEdiPayload: parsed.rawEdiPayload || null,
      rawOcrText: parsed.rawOcrText || null,
      sourceFormat: parsed.sourceFormat,
    });

    return {
      carrierInvoice,
      matchedShipment,
    };
  }
}
