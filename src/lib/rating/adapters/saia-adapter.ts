import {
  ICarrierRatingAdapter,
  RateRequest,
  CarrierQuoteResult,
} from '../carrier-adapter.interface';
import { CzarLiteTariffEngine } from '../czarlite-engine';

export class SaiaRatingAdapter implements ICarrierRatingAdapter {
  public readonly carrierCode = 'SAIA';
  public readonly carrierName = 'SAIA LTL Freight';
  public readonly carrierScac = 'SAIA';

  public async rate(request: RateRequest): Promise<CarrierQuoteResult> {
    const isWholesale = request.accountType === 'PLATFORM_WHOLESALE';
    const discount = isWholesale ? 0.880 : 0.810;
    const amc = isWholesale ? 14200 : 16500;

    const tariff = CzarLiteTariffEngine.calculateTariff(request, discount, amc);

    const saiaFuelRate = 0.275;
    const fuelCostCents = Math.round(tariff.discountedLinehaulCents * saiaFuelRate);
    const totalCostCents = tariff.discountedLinehaulCents + fuelCostCents + tariff.totalAccessorialCostCents;

    const acctNum = request.carrierCredentials?.accountNumber || (isWholesale ? 'MSTR-SAIA-84920' : 'SAIA-BYOC-01');
    const sourceTag = isWholesale ? `[PLATFORM WHOLESALE: 88.0% TIER]` : `[DIRECT: SAIA #${acctNum}]`;

    return {
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      carrierScac: this.carrierScac,
      accountType: request.accountType,
      sourceTag,
      quoteNumber: `SAIA-${Date.now().toString().slice(-6)}`,
      linehaulCostCents: tariff.discountedLinehaulCents,
      fuelSurchargeCents: fuelCostCents,
      accessorialCostCents: tariff.totalAccessorialCostCents,
      accessorialBreakdown: tariff.accessorialFees,
      totalCostCents,
      transitDays: Math.max(1, tariff.estimatedTransitDays - 1), // Fast regional transit
      isGuaranteed: false,
      timestamp: new Date().toISOString(),
      rawResponse: {
        apiEndpoint: 'https://api.saia.com/rates/v1',
        serviceLevel: 'DIRECT_LTL',
      },
    };
  }
}
