import { describe, it, expect } from 'vitest';
import { DamageDetectorEngine, DAMAGE_KEYWORDS } from '../src/lib/pod/damage-detector-engine';

describe('Phase 4.3: Damage & Exception Detection Engine (DamageDetectorEngine)', () => {
  it('detects clean delivery with zero exceptions and matching piece counts', () => {
    const result = DamageDetectorEngine.inspect({
      ocrRawText: 'Received in good order and condition. 4 pallets delivered.',
      driverNotes: 'Dock clear, forklift unloaded quickly.',
      consigneeNotes: 'All skids shrinkwrapped and intact.',
      receivedPieces: 4,
      expectedPieces: 4,
    });

    expect(result.hasException).toBe(false);
    expect(result.severity).toBe('NONE');
    expect(result.detectedKeywords).toHaveLength(0);
    expect(result.piecesShort).toBe(0);
    expect(result.shortagePercentage).toBe(0);
    expect(result.recommendedAction).toContain('CLEAN DELIVERY');
  });

  it('scans all required keywords across OCR text and driver notes', () => {
    const testCases: Array<{ text: string; expectedKeyword: string; expectedCategory?: string }> = [
      { text: 'Outer carton is Damaged upon arrival', expectedKeyword: 'Damaged' },
      { text: 'Noticeable Dmg on corner of skid', expectedKeyword: 'Damaged' },
      { text: 'Received 3 of 4, 1 piece Short on delivery', expectedKeyword: 'Short' },
      { text: 'Reported piece Shortage at dock', expectedKeyword: 'Shortage' },
      { text: 'Box #4 is Missing from pallet', expectedKeyword: 'Missing' },
      { text: 'Consignee Refused delivery due to order cancellation', expectedKeyword: 'Refused' },
      { text: 'Top cartons are Wet from trailer roof leak', expectedKeyword: 'Wet' },
      { text: 'Severe Water Damage to master cartons', expectedKeyword: 'Water Damage' },
      { text: 'Pallet was Crushed under heavy cargo', expectedKeyword: 'Crushed' },
      { text: 'Wood skid Broken and collapsed', expectedKeyword: 'Broken' },
      { text: 'Shrinkwrap is Torn and loose', expectedKeyword: 'Torn' },
      { text: 'Side panel is Dented on unit', expectedKeyword: 'Dented' },
      { text: 'Barrel is Leaking chemical fluid', expectedKeyword: 'Leaking' },
      { text: 'Accepted Subject to Count by receiving lead', expectedKeyword: 'Subject to Count' },
      { text: 'Signed STC dock count pending', expectedKeyword: 'STC' },
      { text: 'Trailer arrived with Broken Seal #9942', expectedKeyword: 'Broken Seal' },
      { text: 'Security lock was Tampered with in transit', expectedKeyword: 'Tampered' },
    ];

    for (const { text, expectedKeyword } of testCases) {
      const res = DamageDetectorEngine.inspect({
        ocrRawText: text,
        driverNotes: '',
        consigneeNotes: '',
        receivedPieces: 4,
        expectedPieces: 4,
      });

      expect(res.hasException).toBe(true);
      expect(res.detectedKeywords).toContain(expectedKeyword);
      expect(res.notationSnippets.length).toBeGreaterThan(0);
    }
  });

  it('automatically classifies piece count delta as shortage exception when received < expected', () => {
    const result = DamageDetectorEngine.inspect({
      ocrRawText: 'Dock stamp verified.',
      driverNotes: '',
      consigneeNotes: '',
      receivedPieces: 3,
      expectedPieces: 5,
    });

    expect(result.hasException).toBe(true);
    expect(result.isShortage).toBe(true);
    expect(result.piecesShort).toBe(2);
    expect(result.shortagePercentage).toBe(40);
    expect(result.severity).toBe('HIGH');
    expect(result.detectedKeywords).toContain('Shortage');
    expect(result.notationSnippets[0]).toContain('Piece count shortage: Received 3 of 5');
  });

  describe('5-Tier Severity Classification', () => {
    it('classifies CRITICAL for refused delivery', () => {
      const result = DamageDetectorEngine.inspect({
        ocrRawText: 'Consignee Refused shipment due to wrong part delivery.',
        driverNotes: 'Receiver refused to unload.',
        receivedPieces: 4,
        expectedPieces: 4,
      });

      expect(result.hasException).toBe(true);
      expect(result.severity).toBe('CRITICAL');
      expect(result.isRefusal).toBe(true);
      expect(result.recommendedAction).toContain('CRITICAL REFUSAL');
    });

    it('classifies CRITICAL for cargo shortage > 50%', () => {
      const result = DamageDetectorEngine.inspect({
        ocrRawText: 'Received 1 skid only.',
        driverNotes: 'Only 1 on trailer.',
        receivedPieces: 1,
        expectedPieces: 4, // 75% shortage
      });

      expect(result.hasException).toBe(true);
      expect(result.severity).toBe('CRITICAL');
      expect(result.piecesShort).toBe(3);
      expect(result.shortagePercentage).toBe(75);
      expect(result.recommendedAction).toContain('CRITICAL SHORTAGE (>50%)');
    });

    it('classifies CRITICAL for hazardous leaks or complete destruction', () => {
      const result = DamageDetectorEngine.inspect({
        ocrRawText: 'Hazardous leak discovered during unloading.',
        driverNotes: 'Drums leaking hazmat chemical on dock floor.',
        receivedPieces: 4,
        expectedPieces: 4,
      });

      expect(result.hasException).toBe(true);
      expect(result.severity).toBe('CRITICAL');
      expect(result.recommendedAction).toContain('CRITICAL EXCEPTION');
    });

    it('classifies HIGH for visible pallet damage, piece shortage <= 50%, or broken seal', () => {
      // Visible damage
      const dmgRes = DamageDetectorEngine.inspect({
        ocrRawText: 'Forklift blade puncture and pallet damage on skid #2.',
        receivedPieces: 4,
        expectedPieces: 4,
      });
      expect(dmgRes.severity).toBe('HIGH');
      expect(dmgRes.recommendedAction).toContain('FREIGHT DAMAGE EXCEPTION');

      // Broken seal
      const sealRes = DamageDetectorEngine.inspect({
        ocrRawText: 'Trailer arrived with Broken Seal. Driver had no explanation.',
        receivedPieces: 4,
        expectedPieces: 4,
      });
      expect(sealRes.severity).toBe('HIGH');
      expect(sealRes.isSealViolation).toBe(true);
      expect(sealRes.recommendedAction).toContain('SECURITY SEAL VIOLATION');

      // Piece shortage <= 50%
      const shortRes = DamageDetectorEngine.inspect({
        ocrRawText: 'Count short 1 carton.',
        receivedPieces: 3,
        expectedPieces: 4,
      });
      expect(shortRes.severity).toBe('HIGH');
      expect(shortRes.piecesShort).toBe(1);
    });

    it('classifies MEDIUM for torn shrinkwrap, box dents, or STC notation', () => {
      const tornRes = DamageDetectorEngine.inspect({
        ocrRawText: 'Torn shrinkwrap on top layer of pallet.',
        receivedPieces: 4,
        expectedPieces: 4,
      });
      expect(tornRes.severity).toBe('MEDIUM');
      expect(tornRes.recommendedAction).toContain('MEDIUM EXCEPTION');

      const stcRes = DamageDetectorEngine.inspect({
        ocrRawText: 'Signed Subject to Count by receiving lead.',
        receivedPieces: 4,
        expectedPieces: 4,
      });
      expect(stcRes.severity).toBe('MEDIUM');
    });

    it('classifies LOW for minor superficial scuffs', () => {
      const scuffRes = DamageDetectorEngine.inspect({
        ocrRawText: 'Minor superficial cosmetic scuff on exterior cardboard box.',
        receivedPieces: 4,
        expectedPieces: 4,
      });
      expect(scuffRes.severity).toBe('LOW');
      expect(scuffRes.recommendedAction).toContain('LOW NOTATION');
    });
  });
});
