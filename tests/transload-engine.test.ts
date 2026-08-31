import { describe, it, expect } from 'vitest';
import {
  PortTransloadEngine,
  IngestContainerParams,
  DeconsolidationPlanLeg,
} from '../src/lib/transload/transload-engine';

describe('Phase 3.7: Port Transload & Deconsolidation Manifest Generator', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  const containerParams: IngestContainerParams = {
    tenantId,
    containerNumber: 'MSKU1984201',
    vesselName: 'EVER GIVEN V.042W',
    portOfDischarge: 'USLAX',
    steamshipLine: 'MAERSK',
    lastFreeDay: '2026-09-05',
    sealNumber: 'SL-884920',
    stagingLane: 'STAGING-A4',
    totalCartons: 1200,
    totalPalletsDevanned: 24,
    totalGrossWeightLbs: 38000,
  };

  it('ingests ocean container and generates Devanning Stripping manifest', async () => {
    const container = await PortTransloadEngine.ingestContainer(containerParams);

    expect(container.id).toBeDefined();
    expect(container.containerNumber).toBe('MSKU1984201');
    expect(container.status).toBe('DEVANNED');
    expect(container.stagingLane).toBe('STAGING-A4');
  });

  it('deconsolidates ocean container into multi-LTL outbound shipment legs', async () => {
    const container = await PortTransloadEngine.ingestContainer(containerParams);

    const legs: DeconsolidationPlanLeg[] = [
      {
        destCity: 'Chicago',
        destState: 'IL',
        destZip: '60601',
        destAddress1: '500 Commerce Way',
        consigneeName: 'Midwest Retail Hub',
        pallets: 8,
        weightLbs: 12500,
        commodityDescription: 'IMPORTED ELECTRONICS APPAREL',
        assignedCarrierScac: 'SAIA',
      },
      {
        destCity: 'Dallas',
        destState: 'TX',
        destZip: '75201',
        destAddress1: '1200 Logistics Blvd',
        consigneeName: 'Southwest Distribution Center',
        pallets: 10,
        weightLbs: 16000,
        commodityDescription: 'IMPORTED ELECTRONICS APPAREL',
        assignedCarrierScac: 'XPOL',
      },
      {
        destCity: 'Atlanta',
        destState: 'GA',
        destZip: '30301',
        destAddress1: '800 Freight Pkwy',
        consigneeName: 'Southeast Hub Depot',
        pallets: 6,
        weightLbs: 9500,
        commodityDescription: 'IMPORTED ELECTRONICS APPAREL',
        assignedCarrierScac: 'EXLA',
      },
    ];

    const result = await PortTransloadEngine.deconsolidateContainer(tenantId, container, legs);

    expect(result.manifestNumber).toContain('TL-MANIFEST-MSKU1984201');
    expect(result.outboundLegs.length).toBe(3);
    expect(result.totalOutboundPallets).toBe(24);
    expect(result.totalOutboundWeightLbs).toBe(38000);
    expect(result.container.status).toBe('DECONSOLIDATED');
  });
});
