import { z } from 'zod';
import { PACKAGING_TYPES, ACCESSORIAL_CODES, NMFC_CLASSES } from '../../db/schema';

export const AddressExtractionSchema = z.object({
  name: z.string().optional().nullable(),
  address1: z.string().optional().nullable().default('Pending Address'),
  address2: z.string().optional().nullable(),
  city: z.string().optional().nullable().default('Unknown City'),
  state: z.string().optional().nullable().default('US'),
  zip: z.string().min(1).default('90001'),
  country: z.enum(['US', 'CA']).default('US'),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
});
export type ExtractedAddress = z.infer<typeof AddressExtractionSchema>;

export const LineItemExtractionSchema = z.object({
  quantity: z.number().int().min(1).default(1),
  packagingType: z.enum(PACKAGING_TYPES).default('PALLET'),
  lengthIn: z.number().positive().default(48),
  widthIn: z.number().positive().default(40),
  heightIn: z.number().positive().default(48),
  unitWeightLbs: z.number().positive().default(500),
  totalWeightLbs: z.number().positive().default(500),
  commodityDescription: z.string().min(1).default('General Freight of All Kinds (FAK)'),
  isStackable: z.boolean().default(false),
  isHazmat: z.boolean().default(false),
  unNumber: z.string().optional().nullable(),
  nmfcClass: z.enum(NMFC_CLASSES).optional().nullable(),
  nmfcCode: z.string().optional().nullable(),
  declaredValueUsd: z.number().nonnegative().optional().nullable(),
});
export type ExtractedLineItem = z.infer<typeof LineItemExtractionSchema>;

export const ConfidenceScoresSchema = z.object({
  originZip: z.number().min(0).max(1).default(1.0),
  destZip: z.number().min(0).max(1).default(1.0),
  totalWeight: z.number().min(0).max(1).default(1.0),
  palletCount: z.number().min(0).max(1).default(1.0),
  dimensions: z.number().min(0).max(1).default(1.0),
  accessorials: z.number().min(0).max(1).default(1.0),
  overall: z.number().min(0).max(1).default(1.0),
});
export type ExtractedConfidenceScores = z.infer<typeof ConfidenceScoresSchema>;

export const RfqExtractionResultSchema = z.object({
  shipperReference: z.string().optional().nullable(),
  origin: AddressExtractionSchema,
  destination: AddressExtractionSchema,
  items: z.array(LineItemExtractionSchema).min(1, 'At least 1 line item is required'),
  totalPallets: z.number().int().min(1).default(1),
  totalWeightLbs: z.number().positive('Total weight must be greater than 0'),
  accessorials: z.array(z.enum(ACCESSORIAL_CODES)).default([]),
  pickupDateReady: z.string().default('2026-09-01'),
  pickupTimeWindow: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional().nullable(),
  deliveryDateTarget: z.string().optional().nullable(),
  deliveryTimeWindow: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  confidenceScores: ConfidenceScoresSchema,
  requiresHumanReview: z.boolean().default(false),
  extractedAt: z.string().default('2026-08-31T00:00:00.000Z'),
});
export type RfqExtractionResult = z.infer<typeof RfqExtractionResultSchema>;
