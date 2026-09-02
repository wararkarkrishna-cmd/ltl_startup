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

    const acctNum = request.carrierCredentials?.accountNumber;
    const sourceTag = isWholesale
      ? `[PLATFORM WHOLESALE: 86.0% TIER]`
      : (acctNum ? `[DIRECT: R+L #${acctNum}]` : `[DIRECT: R+L TARIFF]`);


    if (request.carrierCredentials?.apiKey && process.env.RL_API_URL) {
      try {
        const liveRes = await fetch(process.env.RL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': request.carrierCredentials.apiKey,
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
              quoteNumber: liveData.quoteNumber || `RL-${Date.now().toString().slice(-6)}`,
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
        serviceLevel: 'BUSINESS_LTL',
        appliedTariff: 'CzarLite 2021 Base',
      },
    };
  }
}

