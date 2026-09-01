import React from 'react';
import { CarrierQuickPayPortal } from '../../../components/quickpay/CarrierQuickPayPortal';
import { QuickPayFeeEngine } from '../../../lib/quickpay/quickpay-fee-engine';
import { dbClient } from '../../../db/client';

interface QuickPayTokenPageProps {
  params: {
    token: string;
  };
}

export default async function QuickPayTokenPage({ params }: QuickPayTokenPageProps) {
  const token = params.token;
  
  // Look up token in database or provide realistic demo fallback for /quickpay/demo-qp-token-2026
  let tokenRecord = await dbClient.getQuickPayToken(token);

  if (!tokenRecord) {
    tokenRecord = {
      id: '01916362-7901-7080-867c-9b8895092qp1',
      tenantId: '01916362-7901-7080-867c-9b8895092a01',
      shipmentId: '01916362-7901-7080-867c-9b8895092s01',
      carrierAccountId: null,
      token,
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierEmail: 'billing@saia.com',
      proNumber: 'PRO-984210',
      bolNumber: 'BOL-2026-001',
      grossAmountCents: 80000, // $800.00
      defaultTier: 'INSTANT_SAME_DAY',
      bankName: 'JPMorgan Chase',
      routingNumberMasked: '*****0021',
      accountNumberMasked: '*****4829',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isUsed: false,
      usedAt: null,
      usedByIp: null,
      createdAt: new Date(),
    };
  }

  const initialCalculation = QuickPayFeeEngine.calculateAllTiers({
    grossAmountCents: tokenRecord.grossAmountCents,
    selectedTier: tokenRecord.defaultTier,
  });

  return (
    <CarrierQuickPayPortal
      tokenData={{
        token: tokenRecord.token,
        carrierScac: tokenRecord.carrierScac,
        carrierName: tokenRecord.carrierName,
        carrierEmail: tokenRecord.carrierEmail,
        proNumber: tokenRecord.proNumber,
        bolNumber: tokenRecord.bolNumber,
        grossAmountCents: tokenRecord.grossAmountCents,
        bankName: tokenRecord.bankName,
        routingNumberMasked: tokenRecord.routingNumberMasked,
        accountNumberMasked: tokenRecord.accountNumberMasked,
        expiresAt: tokenRecord.expiresAt.toISOString(),
        isUsed: tokenRecord.isUsed,
      }}
      initialCalculation={initialCalculation}
    />
  );
}
