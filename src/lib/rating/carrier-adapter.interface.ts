import { CarrierCode, CarrierAccountType } from '../../db/schema';

export interface RateItem {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLbs: number;
  quantity: number;
  nmfcClass: string;
  isHazmat?: boolean;
  isStackable?: boolean;
  commodityDescription?: string;
}

export interface RateRequest {
  tenantId: string;
  shipmentId?: string;
  originZip: string;
  originCity: string;
  originState: string;
  destZip: string;
  destCity: string;
  destState: string;
  pickupDate: string; // YYYY-MM-DD
  items: RateItem[];
  accessorials: string[];
  accountType: CarrierAccountType;
  carrierCredentials?: {
    accountNumber?: string;
    apiKey?: string;
    password?: string;
    clientSecret?: string;
  };
}

export interface CarrierQuoteResult {
  carrierCode: CarrierCode;
  carrierName: string;
  carrierScac: string;
  accountType: CarrierAccountType;
  sourceTag: string; // e.g. "[DIRECT: SAIA #84920]" or "[PLATFORM WHOLESALE: 86% TIER]"
  quoteNumber: string;
  linehaulCostCents: number;
  fuelSurchargeCents: number;
  accessorialCostCents: number;
  accessorialBreakdown: Record<string, number>; // code -> cost in cents
  totalCostCents: number;
  transitDays: number;
  isGuaranteed: boolean;
  rawResponse?: Record<string, any>;
  timestamp: string;
}

export interface ICarrierRatingAdapter {
  readonly carrierCode: CarrierCode;
  readonly carrierName: string;
  readonly carrierScac: string;

  rate(request: RateRequest): Promise<CarrierQuoteResult>;
}
