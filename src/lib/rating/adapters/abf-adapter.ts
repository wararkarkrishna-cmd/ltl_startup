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

    const acctNum = request.carrierCredentials?.accountNumber;
    const sourceTag = isWholesale
      ? `[PLATFORM WHOLESALE: 84.5% TIER]`
      : (acctNum ? `[DIRECT: ABF #${acctNum}]` : `[DIRECT: ABF TARIFF]`);


    if (request.carrierCredentials?.apiKey && process.env.ABF_API_URL) {
      try {
        const liveRes = await fetch(process.env.ABF_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-ArcBest-Key': request.carrierCredentials.apiKey,
          },
          body: JSON.stringify({
            originPostalCode: request.originZip,
            destinationPostalCode: request.destZip,
            items: request.items,
          }),
        });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData.totalNetChargeCents) {
            return {
              carrierCode: this.carrierCode,
              carrierName: this.carrierName,
              carrierScac: this.carrierScac,
              accountType: request.accountType,
              sourceTag,
              quoteNumber: liveData.quoteNumber || `ABF-${Date.now().toString().slice(-6)}`,
              linehaulCostCents: liveData.linehaulChargeCents || tariff.discountedLinehaulCents,
              fuelSurchargeCents: liveData.fuelSurchargeCents || fuelCostCents,
              accessorialCostCents: liveData.accessorialChargesCents || tariff.totalAccessorialCostCents,
              accessorialBreakdown: liveData.accessorials || tariff.accessorialFees,
              totalCostCents: liveData.totalNetChargeCents,
              transitDays: liveData.transitDays || tariff.estimatedTransitDays,
              isGuaranteed: liveData.isGuaranteed || false,
              timestamp: new Date().toISOString(),
              rawResponse: liveData,
            };
          }
        }
      } catch {
        // Fallback gracefully to algorithmic CzarLite tariff
      }
    }

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
        serviceLevel: 'PREMIUM_LTL',
        appliedTariff: 'CzarLite 2021 Base',
      },
    };
  }
}

