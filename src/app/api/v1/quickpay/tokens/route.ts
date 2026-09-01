import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbClient } from '../../../../../db/client';
import { generateUuidV7 } from '../../../../../lib/uuidv7';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const token = `qp_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const record = await dbClient.insertQuickPayToken({
      tenantId,
      shipmentId: body.shipmentId || generateUuidV7(),
      carrierAccountId: body.carrierAccountId || null,
      token,
      carrierScac: body.carrierScac || 'SAIA',
      carrierName: body.carrierName || 'SAIA LTL Freight',
      carrierEmail: body.carrierEmail || 'billing@saia.com',
      proNumber: body.proNumber || 'PRO-984210',
      bolNumber: body.bolNumber || 'BOL-2026-001',
      grossAmountCents: body.grossAmountCents || 80000,
      defaultTier: body.defaultTier || 'INSTANT_SAME_DAY',
      bankName: body.bankName || 'JPMorgan Chase',
      routingNumberMasked: body.routingNumberMasked || '*****0021',
      accountNumberMasked: body.accountNumberMasked || '*****4829',
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      tokenRecord: record,
      portalUrl: `/quickpay/${token}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create QuickPay token' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);
    const tokens = Array.from(dbClient.quickpayTokens.values()).filter((t) => t.tenantId === tenantId);

    return NextResponse.json({
      success: true,
      tokens,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve tokens' },
      { status: 500 }
    );
  }
}
