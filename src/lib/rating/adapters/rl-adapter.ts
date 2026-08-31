import {
  ICarrierRatingAdapter,
  RateRequest,
  CarrierQuoteResult,
} from '../carrier-adapter.interface';
import { CzarLiteTariffEngine } from '../czarlite-engine';

export class RlRatingAdapter implements ICarrierRatingAdapter {
  public readonly carrierCode = 'RL';
  public readonly carrierName = 'R+L Carriers';
  public readonly carrierScac = 'RLCA';

  public async rate(request: RateRequest): Promise<CarrierQuoteResult> {
    const isWholesale = request.accountType === 'PLATFORM_WHOLESALE';
    const discount = isWholesale ? 0.860 : 0.800;
    const amc = isWholesale ? 14800 : 17500;

    const tariff = CzarLiteTariffEngine.calculateTariff(request, discount, amc);

    const rlFuelRate = 0.285;
    const fuelCostCents = Math.round(tariff.discountedLinehaulCents * rlFuelRate);
    const totalCostCents = tariff.discountedLinehaulCents + fuelCostCents + tariff.totalAccessorialCostCents;

    const acctNum = request.carrierCredentials?.accountNumber || (isWholesale ? 'MSTR-RLCA-442' : 'RLCA-BYOC-01');
    const sourceTag = isWholesale ? `[PLATFORM WHOLESALE: 86.0% TIER]` : `[DIRECT: R+L #${acctNum}]`;

    return {
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      carrierScac: this.carrierScac,
      accountType: request.accountType,
      sourceTag,
      quoteNumber: `RL-${Date.now().toString().slice(-6)}`,
      linehaulCostCents: tariff.discountedLinehaulCents,
      fuelSurchargeCents: fuelCostCents,
      accessorialCostCents: tariff.totalAccessorialCostCents,
      accessorialBreakdown: tariff.accessorialFees,
      totalCostCents,
      transitDays: tariff.estimatedTransitDays,
      isGuaranteed: false,
      timestamp: new Date().toISOString(),
      rawResponse: {
        apiEndpoint: 'https://api.rlcarriers.com/ratequote/v1',
        serviceLevel: 'BUSINESS_LTL',
      },
    };
  }
}
