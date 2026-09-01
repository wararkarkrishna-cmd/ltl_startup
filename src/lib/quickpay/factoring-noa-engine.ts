import { z } from 'zod';
import crypto from 'crypto';
import { dbClient } from '../../db/client';
import { generateUuidV7 } from '../uuidv7';
import {
  FactoringCompany,
  FactoringCompanySchema,
  CarrierNoaRecord,
  CarrierNoaRecordSchema,
  FactoringWaiver,
  FactoringWaiverSchema,
  CarrierPayout,
  QuickPayAgreement,
} from '../../db/schema';

export interface FactoringEvaluationResult {
  carrierScac: string;
  isFactored: boolean;
  noaStatus: 'NONE' | 'ACTIVE' | 'RELEASED' | 'REVOKED' | 'CONDITIONAL_WAIVER';
  factoringCompany: FactoringCompany | null;
  noaRecord: CarrierNoaRecord | null;
  hasActiveWaiver: boolean;
  waiver: FactoringWaiver | null;
  payoutRoutingMode: 'DIRECT_CARRIER' | 'REDIRECT_FACTORING_LOCKBOX' | 'QUICKPAY_WITH_WAIVER';
  isQuickPayAllowed: boolean;
  routingDecisionReason: string;
  remittanceDestination: {
    recipientName: string;
    bankName: string;
    routingNumber: string;
    accountNumberMasked: string;
    remittanceEmail: string;
    lockboxAddress?: string;
  };
}

export interface CreateWaiverInput {
  tenantId: string;
  shipmentId: string;
  carrierScac: string;
  factoringCompanyId: string;
  authorizedBy: string;
  durationDays?: number;
}

export interface FactoringRemittancePayload {
  edi820Header: {
    transactionSetId: '820';
    controlNumber: string;
    timestamp: string;
  };
  factoringCompany: {
    name: string;
    routingNumber: string;
    accountNumber: string;
    remittanceEmail: string;
  };
  carrier: {
    scac: string;
    name: string;
    taxIdEin?: string | null;
  };
  shipment: {
    shipmentId: string;
    proNumber?: string | null;
    bolNumber?: string | null;
  };
  settlement: {
    grossAmountCents: number;
    feePercentage: number;
    feeAmountCents: number;
    netRemittedCents: number;
    payoutRail: string;
    waiverAuthorizationCode?: string | null;
    settledAt: string;
  };
}

export class FactoringNoaEngine {
  private static isPreSeeded = false;

  /**
   * Seed standard major freight factoring companies if not present
   */
  public static async seedStandardFactoringCompanies(tenantId: string): Promise<void> {
    dbClient.setTenantContext(tenantId);
    const existing = await dbClient.getFactoringCompanies(tenantId);
    if (existing.length > 0) return;

    const standardCompanies: Array<Omit<z.input<typeof FactoringCompanySchema>, 'id' | 'tenantId'>> = [
      {
        companyName: 'Triumph Financial / Triumph Factoring, LLC',
        remittanceEmail: 'remittance@triumphbancorp.com',
        remittancePhone: '866-487-4867',
        lockboxAddress: 'PO Box 844781, Dallas, TX 75284-4781',
        routingNumber: '111900659',
        accountNumber: '88291048201',
        bankName: 'Triumph Bank',
        apiEndpoint: 'https://api.triumph.com/v2/remittance/webhooks',
        supportsElectronicWaiver: true,
      },
      {
        companyName: 'RTS Financial Service, Inc.',
        remittanceEmail: 'remit@rtsfinancial.com',
        remittancePhone: '800-274-8889',
        lockboxAddress: 'PO Box 505581, St. Louis, MO 63150-5581',
        routingNumber: '101000187',
        accountNumber: '77291049281',
        bankName: 'Commerce Bank',
        apiEndpoint: 'https://api.rtsfinancial.com/remittance',
        supportsElectronicWaiver: true,
      },
      {
        companyName: 'OTR Capital LLC',
        remittanceEmail: 'notices@otrcapital.com',
        remittancePhone: '770-882-0124',
        lockboxAddress: 'PO Box 102431, Atlanta, GA 30368-2431',
        routingNumber: '061000104',
        accountNumber: '66182940192',
        bankName: 'Wells Fargo Bank, N.A.',
        apiEndpoint: 'https://api.otrcapital.com/remit-hooks',
        supportsElectronicWaiver: true,
      },
      {
        companyName: 'Apex Capital Corp',
        remittanceEmail: 'remittance@apexcapitalcorp.com',
        remittancePhone: '800-511-2739',
        lockboxAddress: 'PO Box 935564, Atlanta, GA 31193-5564',
        routingNumber: '111000025',
        accountNumber: '55192049182',
        bankName: 'Bank of America',
        apiEndpoint: 'https://api.apexcapitalcorp.com/v1/noa/remit',
        supportsElectronicWaiver: true,
      },
    ];

    for (const comp of standardCompanies) {
      await dbClient.insertFactoringCompany({
        ...comp,
        tenantId,
      });
    }
  }

  /**
   * Evaluate carrier factoring status and determine UCC Article 9 compliant payout routing
   */
  public static async evaluateCarrierFactoringStatus(
    tenantId: string,
    carrierScac: string,
    shipmentId: string,
    carrierDirectBankInfo?: {
      bankName: string;
      routingNumber: string;
      accountNumberMasked: string;
      email: string;
    }
  ): Promise<FactoringEvaluationResult> {
    dbClient.setTenantContext(tenantId);
    await this.seedStandardFactoringCompanies(tenantId);

    const noaRecord = await dbClient.getCarrierNoaByScac(tenantId, carrierScac);

    // 1. Non-Factored Carrier
    if (!noaRecord || noaRecord.noaStatus !== 'ACTIVE') {
      return {
        carrierScac,
        isFactored: false,
        noaStatus: noaRecord ? noaRecord.noaStatus : 'NONE',
        factoringCompany: null,
        noaRecord: noaRecord || null,
        hasActiveWaiver: false,
        waiver: null,
        payoutRoutingMode: 'DIRECT_CARRIER',
        isQuickPayAllowed: true,
        routingDecisionReason: 'No active Notice of Assignment (NOA) on file. Direct carrier disbursement authorized.',
        remittanceDestination: {
          recipientName: carrierScac,
          bankName: carrierDirectBankInfo?.bankName || 'JPMorgan Chase',
          routingNumber: carrierDirectBankInfo?.routingNumber || '*****0021',
          accountNumberMasked: carrierDirectBankInfo?.accountNumberMasked || '*****4829',
          remittanceEmail: carrierDirectBankInfo?.email || 'billing@carrier.com',
        },
      };
    }

    // Carrier is Factored - load factoring company details
    const factoringCompany = await dbClient.getFactoringCompanyById(noaRecord.factoringCompanyId);
    if (!factoringCompany) {
      throw new Error(`Factoring company ${noaRecord.factoringCompanyId} not found`);
    }

    // Check for active QuickPay waiver for this specific load
    const activeWaiver = await dbClient.getFactoringWaiverByShipment(tenantId, shipmentId);

    // 2. Factored Carrier WITH Active QuickPay Waiver
    if (activeWaiver && activeWaiver.waiverStatus === 'APPROVED') {
      return {
        carrierScac,
        isFactored: true,
        noaStatus: 'CONDITIONAL_WAIVER',
        factoringCompany,
        noaRecord,
        hasActiveWaiver: true,
        waiver: activeWaiver,
        payoutRoutingMode: 'QUICKPAY_WITH_WAIVER',
        isQuickPayAllowed: true,
        routingDecisionReason: `Carrier is factored with ${factoringCompany.companyName}, but valid QuickPay Waiver (${activeWaiver.authorizationCode}) is active. Payout authorized to carrier.`,
        remittanceDestination: {
          recipientName: carrierScac,
          bankName: carrierDirectBankInfo?.bankName || 'JPMorgan Chase',
          routingNumber: carrierDirectBankInfo?.routingNumber || '*****0021',
          accountNumberMasked: carrierDirectBankInfo?.accountNumberMasked || '*****4829',
          remittanceEmail: carrierDirectBankInfo?.email || 'billing@carrier.com',
        },
      };
    }

    // 3. Factored Carrier WITHOUT Active Waiver -> UCC Article 9 Lockbox Redirect
    return {
      carrierScac,
      isFactored: true,
      noaStatus: 'ACTIVE',
      factoringCompany,
      noaRecord,
      hasActiveWaiver: false,
      waiver: null,
      payoutRoutingMode: 'REDIRECT_FACTORING_LOCKBOX',
      isQuickPayAllowed: false,
      routingDecisionReason: `UCC Article 9 Notice of Assignment active with ${factoringCompany.companyName}. QuickPay disabled. All settlement funds must route to Factoring Lockbox.`,
      remittanceDestination: {
        recipientName: factoringCompany.companyName,
        bankName: factoringCompany.bankName,
        routingNumber: factoringCompany.routingNumber,
        accountNumberMasked: `*****${factoringCompany.accountNumber.slice(-4)}`,
        remittanceEmail: factoringCompany.remittanceEmail,
        lockboxAddress: factoringCompany.lockboxAddress,
      },
    };
  }

  /**
   * Issue a QuickPay Factoring Waiver for an individual load
   */
  public static async issueFactoringWaiver(input: CreateWaiverInput): Promise<FactoringWaiver> {
    dbClient.setTenantContext(input.tenantId);

    const durationDays = input.durationDays || 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const authCode = `QPW-${input.carrierScac.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const waiver = await dbClient.insertFactoringWaiver({
      tenantId: input.tenantId,
      shipmentId: input.shipmentId,
      carrierScac: input.carrierScac,
      factoringCompanyId: input.factoringCompanyId,
      waiverStatus: 'APPROVED',
      authorizedBy: input.authorizedBy,
      authorizationCode: authCode,
      grantedAt: new Date(),
      expiresAt,
    });

    return waiver;
  }

  /**
   * Generate EDI 820 Remittance Payload for factoring company integration
   */
  public static generateRemittanceAdvicePayload(
    payout: CarrierPayout,
    factoringCompany: FactoringCompany,
    waiver?: FactoringWaiver | null
  ): FactoringRemittancePayload {
    const now = new Date();
    return {
      edi820Header: {
        transactionSetId: '820',
        controlNumber: `CTL_${Date.now()}`,
        timestamp: now.toISOString(),
      },
      factoringCompany: {
        name: factoringCompany.companyName,
        routingNumber: factoringCompany.routingNumber,
        accountNumber: factoringCompany.accountNumber,
        remittanceEmail: factoringCompany.remittanceEmail,
      },
      carrier: {
        scac: payout.carrierScac,
        name: payout.carrierName,
        taxIdEin: payout.carrierTin,
      },
      shipment: {
        shipmentId: payout.shipmentId,
        proNumber: payout.proNumber,
        bolNumber: payout.bolNumber,
      },
      settlement: {
        grossAmountCents: payout.grossAmountCents,
        feePercentage: payout.feePercentage,
        feeAmountCents: payout.feeAmountCents,
        netRemittedCents: payout.netPayoutCents,
        payoutRail: payout.payoutRail,
        waiverAuthorizationCode: waiver?.authorizationCode || null,
        settledAt: payout.settledAt ? payout.settledAt.toISOString() : now.toISOString(),
      },
    };
  }
}
