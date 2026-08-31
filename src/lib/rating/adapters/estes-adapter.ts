import {
  ICarrierRatingAdapter,
  RateRequest,
  CarrierQuoteResult,
} from '../carrier-adapter.interface';
import { CzarLiteTariffEngine } from '../czarlite-engine';

export class EstesRatingAdapter implements ICarrierRatingAdapter {
  public readonly carrierCode = 'ESTES';
  public readonly carrierName = 'Estes Express Lines';
  public readonly carrierScac = 'EXLA';

  public async rate(request: RateRequest): Promise<CarrierQuoteResult> {
    const isWholesale = request.accountType === 'PLATFORM_WHOLESALE';
    const discount = isWholesale ? 0.870 : 0.790;
    const amc = isWholesale ? 14500 : 17000;

    const tariff = CzarLiteTariffEngine.calculateTariff(request, discount, amc);

    const estesFuelRate = 0.280;
    const fuelCostCents = Math.round(tariff.discountedLinehaulCents * estesFuelRate);
    const totalCostCents = tariff.discountedLinehaulCents + fuelCostCents + tariff.totalAccessorialCostCents;

    const acctNum = request.carrierCredentials?.accountNumber || (isWholesale ? 'MSTR-EXLA-994' : 'EXLA-BYOC-01');
    const sourceTag = isWholesale ? `[PLATFORM WHOLESALE: 87.0% TIER]` : `[DIRECT: ESTES #${acctNum}]`;

    return {
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      carrierScac: this.carrierScac,
      accountType: request.accountType,
      sourceTag,
      quoteNumber: `ESTES-${Date.now().toString().slice(-6)}`,
      linehaulCostCents: tariff.discountedLinehaulCents,
      fuelSurchargeCents: fuelCostCents,
      accessorialCostCents: tariff.totalAccessorialCostCents,
      accessorialBreakdown: tariff.accessorialFees,
      totalCostCents,
      transitDays: tariff.estimatedTransitDays,
      isGuaranteed: false,
      timestamp: new Date().toISOString(),
      rawResponse: {
        apiEndpoint: 'https://api.estes-express.com/ratequote/v1',
        serviceLevel: 'STANDARD_LTL',
      },
    };
  }
}
