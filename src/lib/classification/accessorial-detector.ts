import { AccessorialCode } from '../../db/schema';

export interface DetectedAccessorial {
  code: AccessorialCode;
  name: string;
  category: 'PICKUP' | 'DELIVERY' | 'ACCESS' | 'HANDLING' | 'COMPLIANCE' | 'SPECIAL';
  confidence: number;
  matchedPhrase: string;
  sourceTextSnippet: string;
  metadata?: Record<string, any>;
}

export interface AccessorialDetectionSummary {
  accessorials: AccessorialCode[];
  details: DetectedAccessorial[];
  hasHazmat: boolean;
  hazmatDetails?: {
    unNumber?: string;
    hazardClass?: string;
    properShippingName?: string;
  };
  hasOverlength: boolean;
  overlengthFeet?: number;
  totalEstimatedAccessorialFeesCents: number;
}

export class AccessorialDetector {
  /**
   * Standard Estimated Cost Lookup (Cents)
   */
  public static readonly DEFAULT_ACCESSORIAL_FEES: Record<AccessorialCode, number> = {
    LG_PU: 7500, // $75.00
    LG_DEL: 7500,
    RES_PU: 8500, // $85.00
    RES_DEL: 8500,
    LIM_ACC: 9500, // $95.00
    INS_DEL: 12000, // $120.00
    NOTIFY: 3500, // $35.00
    HAZMAT: 15000, // $150.00
    TRADESHOW: 25000, // $250.00
    SORT_SEG: 11000, // $110.00
    LAYOVER: 18000, // $180.00
    DETENTION: 8500, // $85.00
    REDELIVERY: 12500, // $125.00
  };

  /**
   * Accessorial Token Matchers & Rules
   */
  private static readonly RULES: Array<{
    code: AccessorialCode;
    name: string;
    category: 'PICKUP' | 'DELIVERY' | 'ACCESS' | 'HANDLING' | 'COMPLIANCE' | 'SPECIAL';
    regex: RegExp;
    confidence: number;
  }> = [
    {
      code: 'LG_PU',
      name: 'Liftgate Pickup',
      category: 'PICKUP',
      regex: /(?:pickup|origin|shipper).*?(?:lift\s*gate|hydraulic\s*gate|no\s*dock|ground\s*load)|(?:lift\s*gate|hydraulic\s*gate).*?(?:pickup|origin|shipper)/i,
      confidence: 0.95,
    },
    {
      code: 'LG_DEL',
      name: 'Liftgate Delivery',
      category: 'DELIVERY',
      regex: /lift\s*gate|hydraulic\s*gate|no\s*(?:loading\s*)?dock|ground\s*(?:level\s*)?delivery|ground\s*drop/i,
      confidence: 0.95,
    },
    {
      code: 'RES_PU',
      name: 'Residential Pickup',
      category: 'PICKUP',
      regex: /(?:pickup|origin|shipper).*?(?:res(?:idential)?|home\s*business|neighborhood)|(?:res(?:idential)?|home\s*business).*?(?:pickup|origin|shipper)/i,
      confidence: 0.94,
    },
    {
      code: 'RES_DEL',
      name: 'Residential Delivery',
      category: 'DELIVERY',
      regex: /res(?:idential)?(?:\s*delivery|\s*area|\s*address|\s*zone)?|home\s*business|neighborhood\s*drop|private\s*residence/i,
      confidence: 0.94,
    },
    {
      code: 'LIM_ACC',
      name: 'Limited Access Location',
      category: 'ACCESS',
      regex: /limited\s*access|construction\s*site|job\s*site|military\s*base|army\s*base|naval\s*station|school|university|campus|church|place\s*of\s*worship|storage\s*(?:unit|facility)|camp\s*ground|prison|correctional|mine\s*site|quarry|power\s*plant|hotel|hospital/i,
      confidence: 0.93,
    },
    {
      code: 'INS_DEL',
      name: 'Inside Delivery',
      category: 'DELIVERY',
      regex: /inside\s*del(?:ivery)?|bring\s*(?:it\s*)?inside|second\s*floor|upper\s*floor|stairs|elevator\s*delivery|past\s*(?:the\s*)?dock|inside\s*the\s*building/i,
      confidence: 0.96,
    },
    {
      code: 'NOTIFY',
      name: 'Notification / Appointment Required',
      category: 'SPECIAL',
      regex: /call\b.*?\b(?:ahead|prior|before|receiver|consignee)|notify\b.*?\b(?:receiver|prior|delivery|ahead)|appointment\s*(?:required|needed|must\s*be\s*made)|strict\s*delivery\s*window|24\s*h(?:our)?\s*notice/i,
      confidence: 0.92,
    },
    {
      code: 'HAZMAT',
      name: 'Hazardous Materials Handling',
      category: 'COMPLIANCE',
      regex: /hazmat|hazardous(?:\s*materials)?|dangerous\s*goods|un\s*\d{4}|un\s*number|dot\s*placard/i,
      confidence: 0.98,
    },
    {
      code: 'TRADESHOW',
      name: 'Convention / Tradeshow Delivery',
      category: 'SPECIAL',
      regex: /tradeshow|trade\s*show|convention\s*center|expo\s*hall|exhibition\s*hall|booth\s*(?:number|delivery)|marshalling\s*yard/i,
      confidence: 0.97,
    },
    {
      code: 'SORT_SEG',
      name: 'Sort & Segregate',
      category: 'HANDLING',
      regex: /sort\s*(?:&|and)\s*seg(?:regate)?|break\s*down\s*pallets|lumper(?:\s*service|\s*fee)?|sku\s*breakdown/i,
      confidence: 0.93,
    },
    {
      code: 'DETENTION',
      name: 'Driver Detention Time',
      category: 'HANDLING',
      regex: /driver\s*detention|wait\s*time\s*at\s*dock|extended\s*loading\s*delay/i,
      confidence: 0.88,
    },
    {
      code: 'REDELIVERY',
      name: 'Redelivery Attempt',
      category: 'DELIVERY',
      regex: /redeliv(?:ery|er)|attempted\s*delivery|return\s*and\s*redeliver/i,
      confidence: 0.90,
    },
  ];

  /**
   * Detect Accessorials from raw freight text
   */
  public static detectAccessorials(
    rawText: string,
    dimensions?: { lengthIn: number; widthIn: number; heightIn: number }[]
  ): AccessorialDetectionSummary {
    const text = rawText.replace(/\r\n/g, ' ');
    const detected: DetectedAccessorial[] = [];
    const detectedCodesSet = new Set<AccessorialCode>();

    for (const rule of this.RULES) {
      const match = text.match(rule.regex);
      if (match) {
        const matchedPhrase = match[0];
        const snippetStart = Math.max(0, match.index! - 25);
        const snippetEnd = Math.min(text.length, match.index! + matchedPhrase.length + 25);
        const sourceTextSnippet = text.substring(snippetStart, snippetEnd).trim();

        // Avoid duplicate codes
        if (!detectedCodesSet.has(rule.code)) {
          detectedCodesSet.add(rule.code);
          detected.push({
            code: rule.code,
            name: rule.name,
            category: rule.category,
            confidence: rule.confidence,
            matchedPhrase,
            sourceTextSnippet,
          });
        }
      }
    }

    // Specific Hazmat UN Number extraction
    let hasHazmat = detectedCodesSet.has('HAZMAT');
    let hazmatDetails: AccessorialDetectionSummary['hazmatDetails'];

    const unMatch = text.match(/\bUN\s*(\d{4})\b/i);
    const classMatch = text.match(/\b(?:class|hazard\s*class)\s*([1-9](?:\.\d)?)\b/i);

    if (unMatch || classMatch || hasHazmat) {
      hasHazmat = true;
      if (!detectedCodesSet.has('HAZMAT')) {
        detectedCodesSet.add('HAZMAT');
        detected.push({
          code: 'HAZMAT',
          name: 'Hazardous Materials Handling',
          category: 'COMPLIANCE',
          confidence: 0.95,
          matchedPhrase: unMatch ? unMatch[0] : 'Hazmat detected',
          sourceTextSnippet: text.substring(0, 100),
        });
      }
      hazmatDetails = {
        unNumber: unMatch ? `UN${unMatch[1]}` : undefined,
        hazardClass: classMatch ? classMatch[1] : undefined,
      };
    }

    // Overlength detection based on dimensions (Length > 8ft / 96in or > 12ft / 144in)
    let hasOverlength = false;
    let overlengthFeet: number | undefined;

    if (dimensions && dimensions.length > 0) {
      for (const dim of dimensions) {
        const maxDimensionInches = Math.max(dim.lengthIn, dim.widthIn, dim.heightIn);
        if (maxDimensionInches > 96) {
          hasOverlength = true;
          overlengthFeet = parseFloat((maxDimensionInches / 12).toFixed(1));
          break;
        }
      }
    } else {
      // Regex overlength fallback: e.g. "12 ft pipe", "10 foot pallet"
      const overlengthMatch = text.match(/\b(8|9|10|11|12|14|16|20)\s*(?:ft|feet|foot)\b/i);
      if (overlengthMatch) {
        hasOverlength = true;
        overlengthFeet = parseFloat(overlengthMatch[1]);
      }
    }

    // Calculate total estimated accessorial fee cents
    let totalEstimatedAccessorialFeesCents = 0;
    for (const code of detectedCodesSet) {
      totalEstimatedAccessorialFeesCents += this.DEFAULT_ACCESSORIAL_FEES[code] || 7500;
    }

    return {
      accessorials: Array.from(detectedCodesSet),
      details: detected,
      hasHazmat,
      hazmatDetails,
      hasOverlength,
      overlengthFeet,
      totalEstimatedAccessorialFeesCents,
    };
  }
}
