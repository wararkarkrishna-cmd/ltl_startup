import { generateUuidV7 } from '../uuidv7';
import { TransloadContainer, Shipment } from '../../db/schema';
import { dbClient } from '../../db/client';

export interface IngestContainerParams {
  tenantId: string;
  containerNumber: string;
  vesselName: string;
  portOfDischarge: string;
  steamshipLine: string;
  lastFreeDay: string; // YYYY-MM-DD
  sealNumber: string;
  stagingLane: string;
  totalCartons: number;
  totalPalletsDevanned: number;
  totalGrossWeightLbs: number;
}

export interface DeconsolidationPlanLeg {
  destCity: string;
  destState: string;
  destZip: string;
  destAddress1: string;
  consigneeName: string;
  pallets: number;
  weightLbs: number;
  commodityDescription: string;
  assignedCarrierScac: string;
}

export interface TransloadManifestResult {
  manifestId: string;
  manifestNumber: string;
  container: TransloadContainer;
  outboundLegs: Array<{
    legNumber: number;
    shipmentId: string;
    referenceNumber: string;
    destCityStateZip: string;
    pallets: number;
    weightLbs: number;
    carrierScac: string;
    masterBolNumber: string;
  }>;
  totalOutboundPallets: number;
  totalOutboundWeightLbs: number;
  generatedAt: string;
}

export class PortTransloadEngine {
  /**
   * Ingest and register an incoming ocean container into the transload facility
   */
  public static async ingestContainer(params: IngestContainerParams): Promise<TransloadContainer> {
    dbClient.setTenantContext(params.tenantId);

    const record: TransloadContainer = {
      id: generateUuidV7(),
      tenantId: params.tenantId,
      containerNumber: params.containerNumber.toUpperCase(),
      vesselName: params.vesselName,
      portOfDischarge: params.portOfDischarge.toUpperCase(),
      steamshipLine: params.steamshipLine.toUpperCase(),
      lastFreeDay: params.lastFreeDay,
      stagingLane: params.stagingLane.toUpperCase(),
      sealNumber: params.sealNumber,
      totalCartons: params.totalCartons,
      totalPalletsDevanned: params.totalPalletsDevanned,
      totalGrossWeightLbs: params.totalGrossWeightLbs,
      outboundShipmentIds: [],
      status: 'DEVANNED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return record;
  }

  /**
   * Generate Transload Stripping Manifest & Deconsolidate into Multi-LTL Outbound Shipments
   */
  public static async deconsolidateContainer(
    tenantId: string,
    container: TransloadContainer,
    legs: DeconsolidationPlanLeg[]
  ): Promise<TransloadManifestResult> {
    dbClient.setTenantContext(tenantId);

    const manifestNumber = `TL-MANIFEST-${container.containerNumber}-${Date.now().toString().slice(-4)}`;
    const outboundResults = [];
    const outboundShipmentIds: string[] = [];

    let totalPalletsSum = 0;
    let totalWeightSum = 0;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const legNum = i + 1;
      const refNum = `TL-${container.containerNumber.slice(-4)}-L${legNum}`;

      // Insert outbound LTL shipment into DB
      const shipment = await dbClient.insertShipment({
        tenantId,
        referenceNumber: refNum,
        status: 'QUOTED',
        originName: `Transload Facility (${container.portOfDischarge} Terminal)`,
        originAddress1: '2200 E Pacific Coast Hwy',
        originAddress2: `Staging Lane ${container.stagingLane}`,
        originCity: 'Long Beach',
        originState: 'CA',
        originZip: '90810',
        originCountry: 'US',
        originContactName: 'Transload Warehouse Supervisor',
        originContactPhone: '562-555-0144',
        destName: leg.consigneeName,
        destAddress1: leg.destAddress1,
        destAddress2: null,
        destCity: leg.destCity,
        destState: leg.destState,
        destZip: leg.destZip,
        destCountry: 'US',
        destContactName: 'Receiving Dock Lead',
        destContactPhone: '555-0188',
        totalPallets: leg.pallets,
        totalWeightLbs: leg.weightLbs,
        totalLinearFeet: Math.ceil(leg.pallets / 2) * 4,
        totalCubeCuft: leg.pallets * 64,
        pickupDateReady: container.lastFreeDay,
        pickupTimeStart: '08:00',
        pickupTimeEnd: '17:00',
        specialInstructions: `Port Transload from Ocean Container #${container.containerNumber}. Last Free Day: ${container.lastFreeDay}.`,
      });

      outboundShipmentIds.push(shipment.id);
      totalPalletsSum += leg.pallets;
      totalWeightSum += leg.weightLbs;

      outboundResults.push({
        legNumber: legNum,
        shipmentId: shipment.id,
        referenceNumber: refNum,
        destCityStateZip: `${leg.destCity}, ${leg.destState} ${leg.destZip}`,
        pallets: leg.pallets,
        weightLbs: leg.weightLbs,
        carrierScac: leg.assignedCarrierScac,
        masterBolNumber: `BOL-${refNum}`,
      });
    }

    container.status = 'DECONSOLIDATED';
    container.outboundShipmentIds = outboundShipmentIds;

    return {
      manifestId: generateUuidV7(),
      manifestNumber,
      container,
      outboundLegs: outboundResults,
      totalOutboundPallets: totalPalletsSum,
      totalOutboundWeightLbs: totalWeightSum,
      generatedAt: new Date().toISOString(),
    };
  }
}
