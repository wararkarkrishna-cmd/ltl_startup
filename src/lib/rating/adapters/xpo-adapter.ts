import {
  ICarrierRatingAdapter,
  RateRequest,
  CarrierQuoteResult,
} from '../carrier-adapter.interface';
import { CzarLiteTariffEngine } from '../czarlite-engine';

export class XpoRatingAdapter implements ICarrierRatingAdapter {
  public readonly carrierCode = 'XPO';
  public readonly carrierName = 'XPO Logistics';
  public readonly carrierScac = 'CNWY';

  public async rate(request: RateRequest): Promise<CarrierQuoteResult> {
    const isWholesale = request.accountType === 'PLATFORM_WHOLESALE';
    const discount = isWholesale ? 0.865 : 0.785;
    const amc = isWholesale ? 14600 : 17200;

    const tariff = CzarLiteTariffEngine.calculateTariff(request, discount, amc);

    // XPO specific fuel adjustment
    const xpoFuelRate = 0.290;
    const fuelCostCents = Math.round(tariff.discountedLinehaulCents * xpoFuelRate);
    const totalCostCents = tariff.discountedLinehaulCents + fuelCostCents + tariff.totalAccessorialCostCents;

    const acctNum = request.carrierCredentials?.accountNumber || (isWholesale ? 'MSTR-XPO-882' : 'XPO-BYOC-01');
    const sourceTag = isWholesale ? `[PLATFORM WHOLESALE: 86.5% TIER]` : `[DIRECT: XPO #${acctNum}]`;

    return {
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      carrierScac: this.carrierScac,
      accountType: request.accountType,
      sourceTag,
      quoteNumber: `XPO-${Date.now().toString().slice(-6)}`,
      linehaulCostCents: tariff.discountedLinehaulCents,
      fuelSurchargeCents: fuelCostCents,
      accessorialCostCents: tariff.totalAccessorialCostCents,
      accessorialBreakdown: tariff.accessorialFees,
      totalCostCents,
      transitDays: tariff.estimatedTransitDays,
      isGuaranteed: false,
      timestamp: new Date().toISOString(),
      rawResponse: {
        apiEndpoint: 'https://api.xpo.com/rating/v2/quote',
        serviceLevel: 'STANDARD_LTL',
        directLinehaul: tariff.discountedLinehaulCents,
      },
    };
  }
}
