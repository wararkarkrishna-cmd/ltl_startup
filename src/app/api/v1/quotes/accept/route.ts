import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '../../../../../db/client';
import { QuoteDeliveryEngine } from '../../../../../lib/quoting/quote-delivery-engine';
import { AuditEngine } from '../../../../../lib/audit/audit-engine';

const AcceptQuoteSchema = z.object({
  token: z.string().min(1),
  poNumber: z.string().optional().default(''),
  specialInstructions: z.string().optional().default(''),
  signerName: z.string().min(1).default('Authorized Shipper Agent'),
  signerEmail: z.string().email().optional().default('shipper@customer.com'),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing quote action token' }, { status: 400 });
    }

    const verification = QuoteDeliveryEngine.verifyActionToken(token);
    if (!verification.isValid || !verification.payload) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid or expired quote action token' },
        { status: 400 }
      );
    }

    const tenantId = verification.payload.tenantId;
    dbClient.setTenantContext(tenantId);

    const tokenRecord = await dbClient.getQuoteActionToken(token);
    const isAlreadyUsed = tokenRecord?.isUsed || false;

    // Fetch quote & shipment if available
    const quote = dbClient.quotes.get(verification.payload.quoteId);
    const shipment = verification.payload.shipmentId
      ? dbClient.shipments.get(verification.payload.shipmentId)
      : null;

    return NextResponse.json({
      success: true,
      isUsed: isAlreadyUsed,
      payload: verification.payload,
      quote: quote || null,
      shipment: shipment || null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AcceptQuoteSchema.parse(body);

    const verification = QuoteDeliveryEngine.verifyActionToken(parsed.token);
    if (!verification.isValid || !verification.payload) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid or expired action token' },
        { status: 400 }
      );
    }

    const tenantId = verification.payload.tenantId;
    dbClient.setTenantContext(tenantId);

    // Check if token already used
    const existingToken = await dbClient.getQuoteActionToken(parsed.token);
    if (existingToken?.isUsed) {
      return NextResponse.json(
        { success: false, error: 'This quote action token has already been redeemed and booked' },
        { status: 409 }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Mark token as used
    await dbClient.markTokenUsed(parsed.token, clientIp, parsed.poNumber);

    // Update quote & shipment status
    const quote = dbClient.quotes.get(verification.payload.quoteId);
    if (quote) {
      quote.isSelected = true;
      dbClient.quotes.set(quote.id, quote);
    }

    let shipment = verification.payload.shipmentId
      ? dbClient.shipments.get(verification.payload.shipmentId)
      : null;

    if (shipment) {
      shipment.status = 'QUOTED';
      shipment.specialInstructions = parsed.specialInstructions || shipment.specialInstructions;
      dbClient.shipments.set(shipment.id, shipment);
    }

    // Append cryptographic audit log
    await AuditEngine.recordEvent({
      tenantId,
      shipmentId: verification.payload.shipmentId || verification.payload.quoteId,
      userId: parsed.signerEmail,
      fieldName: 'status',
      oldValue: 'QUOTED',
      newValue: 'BOOKED',
      source: 'USER_OVERRIDE',
    });

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully! Shipment is confirmed for dispatch.',
      bookingConfirmationNumber: `BK-${Date.now().toString().slice(-6)}`,
      shipmentId: verification.payload.shipmentId,
      quoteId: verification.payload.quoteId,
      bookedPriceDollars: parseFloat((verification.payload.quotedPriceCents / 100).toFixed(2)),
      bookedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
