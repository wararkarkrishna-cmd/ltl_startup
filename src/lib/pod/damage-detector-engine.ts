import { z } from 'zod';
import { ExceptionSeverity, EXCEPTION_SEVERITIES } from '../../db/schema';

// ============================================================================
// DAMAGE & EXCEPTION KEYWORDS & REGEX PATTERNS
// ============================================================================

export const DAMAGE_KEYWORDS = [
  'Damaged',
  'Damage',
  'Dmg',
  'Short',
  'Shortage',
  'Missing',
  'Refused',
  'Wet',
  'Water Damage',
  'Crushed',
  'Broken',
  'Torn',
  'Dented',
  'Leaking',
  'Subject to Count',
  'STC',
  'Broken Seal',
  'Tampered',
] as const;

export interface DamageKeywordMatch {
  keyword: string;
  matchedText: string;
  category: 'DAMAGE' | 'SHORTAGE' | 'REFUSAL' | 'SEAL_TAMPER' | 'CONDITIONAL';
  severity: ExceptionSeverity;
  snippet: string;
}

export const DamageDetectorInputSchema = z.object({
  ocrRawText: z.string().optional().nullable(),
  driverNotes: z.string().optional().nullable(),
  consigneeNotes: z.string().optional().nullable(),
  receivedPieces: z.number().int().nonnegative(),
  expectedPieces: z.number().int().positive(),
  declaredValueCents: z.number().int().nonnegative().optional(),
});
export type DamageDetectorInput = z.infer<typeof DamageDetectorInputSchema>;

export const DamageInspectionResultSchema = z.object({
  hasException: z.boolean(),
  severity: z.enum(EXCEPTION_SEVERITIES),
  detectedKeywords: z.array(z.string()),
  notationSnippets: z.array(z.string()),
  piecesExpected: z.number().int(),
  piecesReceived: z.number().int(),
  piecesShort: z.number().int(),
  shortagePercentage: z.number(),
  recommendedAction: z.string(),
  isShortage: z.boolean(),
  isDamage: z.boolean(),
  isRefusal: z.boolean(),
  isSealViolation: z.boolean(),
  details: z.array(
    z.object({
      keyword: z.string(),
      category: z.string(),
      severity: z.enum(EXCEPTION_SEVERITIES),
      snippet: z.string(),
    })
  ),
});
export type DamageInspectionResult = z.infer<typeof DamageInspectionResultSchema>;

// Keyword definition patterns with severity and category
interface PatternRule {
  pattern: RegExp;
  keyword: string;
  category: 'DAMAGE' | 'SHORTAGE' | 'REFUSAL' | 'SEAL_TAMPER' | 'CONDITIONAL';
  severity: ExceptionSeverity;
}

const EXCEPTION_RULES: PatternRule[] = [
  // CRITICAL SEVERITY RULES
  {
    pattern: /\b(refus(?:ed|al)|reject(?:ed)?(?:\s+delivery)?|delivery\s+refused)\b/i,
    keyword: 'Refused',
    category: 'REFUSAL',
    severity: 'CRITICAL',
  },
  {
    pattern: /\b(haz(?:ardous)?\s*(?:leak|spill|mat)|chemical\s+leak|toxic\s+spill|leaking\s+hazmat)\b/i,
    keyword: 'Leaking',
    category: 'DAMAGE',
    severity: 'CRITICAL',
  },
  {
    pattern: /\b(total(?:ly)?\s+destroy(?:ed)?|complete\s+(?:destruction|loss)|crushed\s+flat|destroyed)\b/i,
    keyword: 'Crushed',
    category: 'DAMAGE',
    severity: 'CRITICAL',
  },

  // HIGH SEVERITY RULES
  {
    pattern: /\b(water\s*damage(?:d)?|submerged|soak(?:ed)?|standing\s+water)\b/i,
    keyword: 'Water Damage',
    category: 'DAMAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(pallet\s*damage(?:d)?|forklift\s*(?:puncture|blade|spear|hit)|crushed\s+pallet)\b/i,
    keyword: 'Damaged',
    category: 'DAMAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(broken\s+seal|seal\s+broken|tamper(?:ed)?|cut\s+seal|seal\s+intact\s*:\s*no|tampered\s+seal)\b/i,
    keyword: 'Broken Seal',
    category: 'SEAL_TAMPER',
    severity: 'HIGH',
  },
  {
    pattern: /\b(tamper(?:ed)?|unauthorized\s+entry)\b/i,
    keyword: 'Tampered',
    category: 'SEAL_TAMPER',
    severity: 'HIGH',
  },
  {
    pattern: /\b(broken|smashed|punctur(?:ed|e)|cracked|collapsed\s+skid)\b/i,
    keyword: 'Broken',
    category: 'DAMAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(crush(?:ed)?|smashed|caved\s*in)\b/i,
    keyword: 'Crushed',
    category: 'DAMAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(leak(?:ing|age)?|fluid\s+leak|wet\s+boxes?)\b/i,
    keyword: 'Leaking',
    category: 'DAMAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(wet)\b/i,
    keyword: 'Wet',
    category: 'DAMAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(short(?:age)?|short\s+count|piece(?:s)?\s+short|missing\s+pallet(?:s)?)\b/i,
    keyword: 'Shortage',
    category: 'SHORTAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(short)\b/i,
    keyword: 'Short',
    category: 'SHORTAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(missing|unaccounted\s+for|lost\s+piece(?:s)?)\b/i,
    keyword: 'Missing',
    category: 'SHORTAGE',
    severity: 'HIGH',
  },
  {
    pattern: /\b(dmg|damag(?:ed|e|ing)?)\b/i,
    keyword: 'Damaged',
    category: 'DAMAGE',
    severity: 'HIGH',
  },

  // MEDIUM SEVERITY RULES
  {
    pattern: /\b(torn\s*(?:shrink\s*)?wrap(?:ping)?|shrink\s*wrap\s*torn|ripped\s*wrap)\b/i,
    keyword: 'Torn',
    category: 'DAMAGE',
    severity: 'MEDIUM',
  },
  {
    pattern: /\b(torn|tear|ripped)\b/i,
    keyword: 'Torn',
    category: 'DAMAGE',
    severity: 'MEDIUM',
  },
  {
    pattern: /\b(dent(?:ed)?|dented\s+carton|corner\s+dent)\b/i,
    keyword: 'Dented',
    category: 'DAMAGE',
    severity: 'MEDIUM',
  },
  {
    pattern: /\b(subject\s+to\s+count|s\.?t\.?c\.?)\b/i,
    keyword: 'Subject to Count',
    category: 'CONDITIONAL',
    severity: 'MEDIUM',
  },
  {
    pattern: /\b(stc)\b/i,
    keyword: 'STC',
    category: 'CONDITIONAL',
    severity: 'MEDIUM',
  },

  // LOW SEVERITY RULES
  {
    pattern: /\b(scuff(?:ed)?|minor\s+scuff|superficial|cosmetic\s+scuff|surface\s+scratch)\b/i,
    keyword: 'Dented',
    category: 'DAMAGE',
    severity: 'LOW',
  },
];

export class DamageDetectorEngine {
  /**
   * Scan OCR raw text and consignee/driver notes for freight damage, shortage, and exception keywords.
   * Performs piece count delta calculation and assigns structured severity and recommended actions.
   */
  public static inspect(input: DamageDetectorInput): DamageInspectionResult {
    // Validate input schema
    DamageDetectorInputSchema.parse(input);

    const received = input.receivedPieces;
    const expected = input.expectedPieces;
    const piecesShort = Math.max(0, expected - received);
    const shortagePercentage = expected > 0 ? (piecesShort / expected) * 100 : 0;
    const isShortageByCount = piecesShort > 0;

    // Combine all textual input sources
    const combinedTexts: Array<{ source: string; text: string }> = [];
    if (input.ocrRawText && input.ocrRawText.trim().length > 0) {
      combinedTexts.push({ source: 'OCR Raw Text', text: input.ocrRawText.trim() });
    }
    if (input.driverNotes && input.driverNotes.trim().length > 0) {
      combinedTexts.push({ source: 'Driver Notes', text: input.driverNotes.trim() });
    }
    if (input.consigneeNotes && input.consigneeNotes.trim().length > 0) {
      combinedTexts.push({ source: 'Consignee Notes', text: input.consigneeNotes.trim() });
    }

    const detectedMatches: DamageKeywordMatch[] = [];
    const detectedKeywordsSet = new Set<string>();
    const notationSnippets: string[] = [];

    // Scan text across all sources
    for (const { text } of combinedTexts) {
      for (const rule of EXCEPTION_RULES) {
        const match = rule.pattern.exec(text);
        if (match) {
          const matchedText = match[0];
          const snippet = this.extractSnippet(text, match.index, matchedText.length);

          if (!detectedKeywordsSet.has(rule.keyword)) {
            detectedKeywordsSet.add(rule.keyword);
            notationSnippets.push(snippet);
          }

          detectedMatches.push({
            keyword: rule.keyword,
            matchedText,
            category: rule.category,
            severity: rule.severity,
            snippet,
          });
        }
      }
    }

    // If shortage occurred by piece count, ensure Shortage keyword and snippet are added
    if (isShortageByCount) {
      if (!detectedKeywordsSet.has('Shortage') && !detectedKeywordsSet.has('Short')) {
        detectedKeywordsSet.add('Shortage');
        notationSnippets.push(
          `Piece count shortage: Received ${received} of ${expected} expected handling units (${piecesShort} short).`
        );
      }
    }

    // Determine Boolean Flags
    const isRefusal = detectedMatches.some((m) => m.category === 'REFUSAL');
    const isSealViolation = detectedMatches.some((m) => m.category === 'SEAL_TAMPER');
    const isDamage = detectedMatches.some((m) => m.category === 'DAMAGE');
    const isShortage = isShortageByCount || detectedMatches.some((m) => m.category === 'SHORTAGE');

    // Calculate Overall Severity
    let severity: ExceptionSeverity = 'NONE';

    // 1. Check CRITICAL conditions
    if (
      isRefusal ||
      detectedMatches.some((m) => m.severity === 'CRITICAL') ||
      shortagePercentage > 50.0 // missing >50% cargo
    ) {
      severity = 'CRITICAL';
    }
    // 2. Check HIGH conditions
    else if (
      isSealViolation ||
      isShortageByCount ||
      detectedMatches.some((m) => m.severity === 'HIGH')
    ) {
      severity = 'HIGH';
    }
    // 3. Check MEDIUM conditions
    else if (detectedMatches.some((m) => m.severity === 'MEDIUM')) {
      severity = 'MEDIUM';
    }
    // 4. Check LOW conditions
    else if (detectedMatches.some((m) => m.severity === 'LOW')) {
      severity = 'LOW';
    }

    const hasException = severity !== 'NONE';

    // Determine Recommended Action based on severity & exception type
    const recommendedAction = this.deriveRecommendedAction(
      severity,
      isRefusal,
      isShortage,
      isSealViolation,
      isDamage,
      piecesShort,
      expected
    );

    return {
      hasException,
      severity,
      detectedKeywords: Array.from(detectedKeywordsSet),
      notationSnippets,
      piecesExpected: expected,
      piecesReceived: received,
      piecesShort,
      shortagePercentage: Number(shortagePercentage.toFixed(2)),
      recommendedAction,
      isShortage,
      isDamage,
      isRefusal,
      isSealViolation,
      details: detectedMatches.map((m) => ({
        keyword: m.keyword,
        category: m.category,
        severity: m.severity,
        snippet: m.snippet,
      })),
    };
  }

  /**
   * Helper: Extract contextual text snippet around matched pattern index
   */
  private static extractSnippet(text: string, matchIndex: number, matchLength: number): string {
    const padding = 35;
    const start = Math.max(0, matchIndex - padding);
    const end = Math.min(text.length, matchIndex + matchLength + padding);

    let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Helper: Derive standard operational SOP action based on severity and findings
   */
  private static deriveRecommendedAction(
    severity: ExceptionSeverity,
    isRefusal: boolean,
    isShortage: boolean,
    isSealViolation: boolean,
    isDamage: boolean,
    piecesShort: number,
    piecesExpected: number
  ): string {
    switch (severity) {
      case 'CRITICAL':
        if (isRefusal) {
          return 'CRITICAL REFUSAL: Hold freight in carrier custody, immediately contact Shipper & Consignee dispatch leads, and arrange expedited return/reconsignment.';
        }
        if (piecesShort > piecesExpected * 0.5) {
          return `CRITICAL SHORTAGE (>50%): ${piecesShort} of ${piecesExpected} units missing. Alert Carrier Claims Dept and dispatch immediate terminal dock search.`;
        }
        return 'CRITICAL EXCEPTION: Complete cargo destruction or hazardous leak detected. Escalate immediately to Risk Management and lock carrier settlement.';

      case 'HIGH':
        if (isSealViolation) {
          return 'SECURITY SEAL VIOLATION: Broken or missing security seal detected. Perform 100% itemized inventory inspection and file immediate OS&D report.';
        }
        if (isShortage) {
          return `SHORTAGE EXCEPTION: ${piecesShort} piece(s) short on delivery. File preliminary OS&D shortage claim with carrier within 48 hours.`;
        }
        if (isDamage) {
          return 'FREIGHT DAMAGE EXCEPTION: Visible pallet/box destruction detected. Issue high-priority claims notice to carrier and request joint inspection.';
        }
        return 'HIGH PRIORITY EXCEPTION: File preliminary OS&D report with carrier within 48h and hold automated carrier payment.';

      case 'MEDIUM':
        return 'MEDIUM EXCEPTION: Minor carton dent or torn shrinkwrap noted. Log notation in carrier scorecard and notify customer service for conditional acceptance.';

      case 'LOW':
        return 'LOW NOTATION: Superficial scuff/cosmetic notation recorded on receipt. No claims filing required; clear for standard billing.';

      case 'NONE':
      default:
        return 'CLEAN DELIVERY: Clean proof of delivery verified. Release customer invoice and settle carrier freight payment.';
    }
  }
}
