import React from 'react';
import { FastReviewBoard } from '@/components/review/FastReviewBoard';
import { RfqExtractionResult } from '@/lib/schema/rfq-extraction-schema';

export default function ReviewShipmentPage({
  params,
}: {
  params: { id: string };
}) {
  const sampleRfq: RfqExtractionResult = {
    shipperReference: `RFQ-${params.id.slice(0, 6)}`,
    origin: {
      name: 'PacWest Industrial Logistics',
      address1: '1420 Olympic Blvd',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90015',
      country: 'US',
    },
    destination: {
      name: 'Midwest Distribution Hub',
      address1: '500 N Michigan Ave',
      city: 'Chicago',
      state: 'IL',
      zip: '60611',
      country: 'US',
    },
    items: [
      {
        quantity: 4,
        packagingType: 'PALLET',
        lengthIn: 48,
        widthIn: 40,
        heightIn: 48,
        unitWeightLbs: 1200,
        totalWeightLbs: 4800,
        commodityDescription: 'Automotive Stamping Dies & Machine Parts',
        isStackable: false,
        isHazmat: false,
        nmfcClass: '70',
      },
    ],
    totalPallets: 4,
    totalWeightLbs: 4800,
    accessorials: ['LG_DEL', 'RES_DEL'],
    pickupDateReady: '2026-09-01',
    confidenceScores: {
      originZip: 0.98,
      destZip: 0.98,
      totalWeight: 0.95,
      palletCount: 0.95,
      dimensions: 0.94,
      accessorials: 0.92,
      overall: 0.95,
    },
    requiresHumanReview: false,
    extractedAt: new Date().toISOString(),
  };

  const sampleRawText = `RFQ QUOTE REQUEST
From: logistics@pacwestsupplies.com
To: quotes@freightos.app
Date: August 31, 2026

Please provide an LTL spot rate for the following freight:
- Origin: 1420 Olympic Blvd, Los Angeles, CA 90015
- Destination: 500 N Michigan Ave, Chicago, IL 60611
- Freight Details: 4 pallets 48x40x48 @ 1200# each (Total Weight: 4,800 lbs)
- Commodity: Automotive Stamping Dies & Machine Parts
- Accessorial Requirements: Needs liftgate delivery at residential location.

Ready for immediate pickup.`;

  return (
    <FastReviewBoard
      shipmentId={params.id}
      initialRfq={sampleRfq}
      rawDocumentText={sampleRawText}
      fileName="PacWest_RFQ_August2026.pdf"
      mimeType="application/pdf"
      sha256Hash="9b73c68f784f198f5e9d61c0b8912e4309a80b7c12de4f67b43a908a28e3b012"
    />
  );
}
