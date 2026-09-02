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

    const acctNum = request.carrierCredentials?.accountNumber;
    const sourceTag = isWholesale
      ? `[PLATFORM WHOLESALE: 88.0% TIER]`
      : (acctNum ? `[DIRECT: SAIA #${acctNum}]` : `[DIRECT: SAIA TARIFF]`);


    if (request.carrierCredentials?.apiKey && process.env.SAIA_API_URL) {
      try {
        const liveRes = await fetch(process.env.SAIA_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Token': request.carrierCredentials.apiKey,
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
              quoteNumber: liveData.quoteNumber || `SAIA-${Date.now().toString().slice(-6)}`,
              linehaulCostCents: liveData.linehaulChargeCents || tariff.discountedLinehaulCents,
              fuelSurchargeCents: liveData.fuelSurchargeCents || fuelCostCents,
              accessorialCostCents: liveData.accessorialChargesCents || tariff.totalAccessorialCostCents,
              accessorialBreakdown: liveData.accessorials || tariff.accessorialFees,
              totalCostCents: liveData.totalNetChargeCents,
              transitDays: liveData.transitDays || Math.max(1, tariff.estimatedTransitDays - 1),
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
      quoteNumber: `SAIA-${Date.now().toString().slice(-6)}`,
      linehaulCostCents: tariff.discountedLinehaulCents,
      fuelSurchargeCents: fuelCostCents,
      accessorialCostCents: tariff.totalAccessorialCostCents,
      accessorialBreakdown: tariff.accessorialFees,
      totalCostCents,
      transitDays: Math.max(1, tariff.estimatedTransitDays - 1),
      isGuaranteed: false,
      timestamp: new Date().toISOString(),
      rawResponse: {
        serviceLevel: 'DIRECT_LTL',
        appliedTariff: 'CzarLite 2021 Base',
      },
    };
  }
}

