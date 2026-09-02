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

    const acctNum = request.carrierCredentials?.accountNumber;
    const sourceTag = isWholesale
      ? `[PLATFORM WHOLESALE: 86.5% TIER]`
      : (acctNum ? `[DIRECT: XPO #${acctNum}]` : `[DIRECT: XPO TARIFF]`);


    // In live production, if live API credentials and endpoint are present:
    if (request.carrierCredentials?.apiKey && process.env.XPO_API_URL) {
      try {
        const liveRes = await fetch(process.env.XPO_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${request.carrierCredentials.apiKey}`,
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
              quoteNumber: liveData.quoteNumber || `XPO-${Date.now().toString().slice(-6)}`,
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
        serviceLevel: 'STANDARD_LTL',
        appliedTariff: 'CzarLite 2021 Base',
      },
    };
  }
}

