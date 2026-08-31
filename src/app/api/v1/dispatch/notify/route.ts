import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DispatchNotificationEngine, RateConfirmationData } from '../../../../../lib/dispatch/dispatch-notification-engine';

const NotifySchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  recipientEmail: z.string().email(),
  recipientPhone: z.string().optional(),
  rateConfirmationData: z.object({
    rateConfirmationNumber: z.string(),
    loadReference: z.string(),
    date: z.string(),
    carrierName: z.string(),
    carrierScac: z.string(),
    originName: z.string(),
    originAddress: z.string(),
    originCityStateZip: z.string(),
    pickupDate: z.string(),
    pickupNumber: z.string(),
    destName: z.string(),
    destAddress: z.string(),
    destCityStateZip: z.string(),
    deliveryDateEst: z.string(),
    totalPallets: z.number(),
    totalWeightLbs: z.number(),
    commodityDescription: z.string(),
    linehaulAgreedCents: z.number(),
    fuelAgreedCents: z.number(),
    accessorialAgreedCents: z.number(),
    totalAgreedCarrierRateCents: z.number(),
    specialInstructions: z.string().optional(),
    ebolUrl: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = NotifySchema.parse(body);

    const notifications = DispatchNotificationEngine.buildDispatchNotifications(
      parsed.rateConfirmationData as RateConfirmationData,
      parsed.recipientEmail,
      parsed.recipientPhone
    );

    const pdfBuffer = await DispatchNotificationEngine.generateRateConfirmationPdf(
      parsed.rateConfirmationData as RateConfirmationData
    );

    return NextResponse.json({
      success: true,
      notifications,
      pdfGenerated: true,
      pdfSizeBytes: pdfBuffer.length,
      sentAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
