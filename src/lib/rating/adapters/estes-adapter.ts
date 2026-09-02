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

    const acctNum = request.carrierCredentials?.accountNumber;
    const sourceTag = isWholesale
      ? `[PLATFORM WHOLESALE: 87.0% TIER]`
      : (acctNum ? `[DIRECT: ESTES #${acctNum}]` : `[DIRECT: ESTES TARIFF]`);


    if (request.carrierCredentials?.apiKey && process.env.ESTES_API_URL) {
      try {
        const liveRes = await fetch(process.env.ESTES_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${request.carrierCredentials.accountNumber}:${request.carrierCredentials.apiKey}`).toString('base64')}`,
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
              quoteNumber: liveData.quoteNumber || `ESTES-${Date.now().toString().slice(-6)}`,
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
        serviceLevel: 'STANDARD_LTL',
        appliedTariff: 'CzarLite 2021 Base',
      },
    };
  }
}

