import { describe, it, expect } from 'vitest';
import { AccessorialDetector } from '../src/lib/classification/accessorial-detector';

describe('Phase 1.5: Accessorial Detection & Normalization Engine', () => {
  describe('Standard Accessorial Codes Detection', () => {
    it('detects Liftgate Pickup and Delivery', () => {
      const text = 'Shipper has ground load, need hydraulic gate at origin and lift gate delivery at destination.';
      const res = AccessorialDetector.detectAccessorials(text);

      expect(res.accessorials).toContain('LG_PU');
      expect(res.accessorials).toContain('LG_DEL');
      expect(res.totalEstimatedAccessorialFeesCents).toBeGreaterThanOrEqual(15000);
    });

    it('detects Residential Delivery and Inside Delivery', () => {
      const text = 'Deliver to private residence in residential neighborhood. Driver must bring it inside second floor.';
      const res = AccessorialDetector.detectAccessorials(text);

      expect(res.accessorials).toContain('RES_DEL');
      expect(res.accessorials).toContain('INS_DEL');
    });

    it('detects Limited Access Locations', () => {
      const text1 = 'Destination is an active construction job site with security checkpoint.';
      expect(AccessorialDetector.detectAccessorials(text1).accessorials).toContain('LIM_ACC');

      const text2 = 'Deliver to St. Mary Church and parochial school campus.';
      expect(AccessorialDetector.detectAccessorials(text2).accessorials).toContain('LIM_ACC');

      const text3 = 'Delivery to Fort Hood military base.';
      expect(AccessorialDetector.detectAccessorials(text3).accessorials).toContain('LIM_ACC');
    });

    it('detects Tradeshow & Convention Hall deliveries', () => {
      const text = 'Ship to Las Vegas Convention Center, Expo Hall Booth #412.';
      const res = AccessorialDetector.detectAccessorials(text);

      expect(res.accessorials).toContain('TRADESHOW');
      expect(res.details.find((d) => d.code === 'TRADESHOW')?.category).toBe('SPECIAL');
    });

    it('detects Sort & Segregate / Lumper services', () => {
      const text = 'Grocery DC requires lumper fee for sort and segregate of 400 cases.';
      const res = AccessorialDetector.detectAccessorials(text);

      expect(res.accessorials).toContain('SORT_SEG');
    });

    it('detects Call Prior / Appointment Notification', () => {
      const text = 'Consignee requires 24 hour notice prior to delivery, must call ahead.';
      const res = AccessorialDetector.detectAccessorials(text);

      expect(res.accessorials).toContain('NOTIFY');
    });
  });

  describe('Hazmat UN Number & Hazard Class Extraction', () => {
    it('extracts UN number and flags hazmat compliance', () => {
      const text = 'Contains hazardous flammable liquids, UN 1993, Hazard Class 3, Packing Group II.';
      const res = AccessorialDetector.detectAccessorials(text);

      expect(res.hasHazmat).toBe(true);
      expect(res.accessorials).toContain('HAZMAT');
      expect(res.hazmatDetails?.unNumber).toBe('UN1993');
      expect(res.hazmatDetails?.hazardClass).toBe('3');
    });
  });

  describe('Overlength Freight Surcharge Detection', () => {
    it('detects overlength based on piece dimensions > 96 inches', () => {
      const dimensions = [
        { lengthIn: 120, widthIn: 40, heightIn: 48 }, // 10 feet long
      ];
      const res = AccessorialDetector.detectAccessorials('1 bundle of steel tubes', dimensions);

      expect(res.hasOverlength).toBe(true);
      expect(res.overlengthFeet).toBe(10.0);
    });
  });
});
