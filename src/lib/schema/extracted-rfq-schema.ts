import { z } from 'zod';

export const ORIGIN_ACCESSORIALS = [
  'LIFTGATE_PICKUP',
  'INSIDE_PICKUP',
  'LIMITED_ACCESS_PICKUP',
  'APPOINTMENT_PICKUP',
] as const;
export type OriginAccessorial = (typeof ORIGIN_ACCESSORIALS)[number];

export const DESTINATION_ACCESSORIALS = [
  'LIFTGATE_DELIVERY',
  'INSIDE_DELIVERY',
  'LIMITED_ACCESS_DELIVERY',
  'APPOINTMENT_DELIVERY',
  'NOTIFY_BEFORE_DELIVERY',
] as const;
export type DestinationAccessorial = (typeof DESTINATION_ACCESSORIALS)[number];

export const PACKAGING_TYPE_ENUM = [
  'PALLET',
  'SKID',
  'CRATE',
  'DRUM',
  'BOX',
  'LOOSE',
  'ROLL',
  'BUNDLE',
  'OTHER',
] as const;
export type PackagingTypeEnum = (typeof PACKAGING_TYPE_ENUM)[number];

export const ExtractedItemSchema = z.object({
  item_id: z.string(),
  packaging_type: z.enum(PACKAGING_TYPE_ENUM).default('PALLET'),
  handling_units: z.number().int().min(1).default(1),
  length_inches: z.number().positive(),
  width_inches: z.number().positive(),
  height_inches: z.number().positive(),
  total_weight_lbs: z.number().positive(),
  declared_class: z.number().optional().nullable(),
  nmfc_code: z.string().optional().nullable(),
  commodity_description: z.string().min(1).default('Freight of All Kinds (FAK)'),
  is_hazardous: z.boolean().default(false),
  is_stackable: z.boolean().default(false),
});
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

export const ExtractedRFQSchema = z.object({
  shipper_reference_id: z.string().optional().nullable(),
  origin: z.object({
    zip: z.string().min(1).max(10),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    is_residential: z.boolean().default(false),
    has_dock: z.boolean().default(true),
    accessorials: z.array(z.enum(ORIGIN_ACCESSORIALS)).default([]),
  }),
  destination: z.object({
    zip: z.string().min(1).max(10),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    is_residential: z.boolean().default(false),
    has_dock: z.boolean().default(true),
    accessorials: z.array(z.enum(DESTINATION_ACCESSORIALS)).default([]),
  }),
  pickup_date_ready: z.string(),
  delivery_date_target: z.string().optional().nullable(),
  items: z.array(ExtractedItemSchema).min(1, 'At least 1 item is required'),
});
export type ExtractedRFQ = z.infer<typeof ExtractedRFQSchema>;
