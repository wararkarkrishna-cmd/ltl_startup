import {
  ICarrierRatingAdapter,
  RateRequest,
  CarrierQuoteResult,
} from '../carrier-adapter.interface';
import { CzarLiteTariffEngine } from '../czarlite-engine';

export class AbfRatingAdapter implements ICarrierRatingAdapter {
  public readonly carrierCode = 'ABF';
  public readonly carrierName = 'ArcBest / ABF Freight';
  public readonly carrierScac = 'ABFS';

  public async rate(request: RateRequest): Promise<CarrierQuoteResult> {
    const isWholesale = request.accountType === 'PLATFORM_WHOLESALE';
    const discount = isWholesale ? 0.845 : 0.760;
    const amc = isWholesale ? 15200 : 18500;

    const tariff = CzarLiteTariffEngine.calculateTariff(request, discount, amc);

    const abfFuelRate = 0.295;
    const fuelCostCents = Math.round(tariff.discountedLinehaulCents * abfFuelRate);
    const totalCostCents = tariff.discountedLinehaulCents + fuelCostCents + tariff.totalAccessorialCostCents;

    const acctNum = request.carrierCredentials?.accountNumber || (isWholesale ? 'MSTR-ABFS-710' : 'ABFS-BYOC-01');
    const sourceTag = isWholesale ? `[PLATFORM WHOLESALE: 84.5% TIER]` : `[DIRECT: ABF #${acctNum}]`;

    return {
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      carrierScac: this.carrierScac,
      accountType: request.accountType,
      sourceTag,
      quoteNumber: `ABF-${Date.now().toString().slice(-6)}`,
      linehaulCostCents: tariff.discountedLinehaulCents,
      fuelSurchargeCents: fuelCostCents,
      accessorialCostCents: tariff.totalAccessorialCostCents,
      accessorialBreakdown: tariff.accessorialFees,
      totalCostCents,
      transitDays: tariff.estimatedTransitDays,
      isGuaranteed: false,
      timestamp: new Date().toISOString(),
      rawResponse: {
        apiEndpoint: 'https://api.arcbest.com/rating/v1',
        serviceLevel: 'PREMIUM_LTL',
      },
    };
  }
}
