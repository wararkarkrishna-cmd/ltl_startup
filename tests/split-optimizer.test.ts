import { describe, it, expect } from 'vitest';
import { CombinatorialSplitOptimizer } from '../src/lib/optimization/split-optimizer';
import { RateRequest, RateItem } from '../src/lib/rating/carrier-adapter.interface';

describe('Phase 2.6: Combinatorial Split Optimizer Algorithm', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  it('generates all valid non-trivial bipartite partitions for single multi-pallet line item', () => {
    const items: RateItem[] = [
      { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 1000, quantity: 6, nmfcClass: '70' },
    ];

    const partitions = CombinatorialSplitOptimizer.generateBipartitePartitions(items);
    expect(partitions.length).toBe(3); // (1+5), (2+4), (3+3)

    expect(partitions[0][0][0].quantity).toBe(1);
    expect(partitions[0][1][0].quantity).toBe(5);

    expect(partitions[1][0][0].quantity).toBe(2);
    expect(partitions[1][1][0].quantity).toBe(4);

    expect(partitions[2][0][0].quantity).toBe(3);
    expect(partitions[2][1][0].quantity).toBe(3);
  });

  it('evaluates multi-carrier split pricing against single carrier baseline', async () => {
    const multiPalletRequest: Omit<RateRequest, 'accountType'> = {
      tenantId,
      originZip: '90001',
      originCity: 'Los Angeles',
      originState: 'CA',
      destZip: '60601',
      destCity: 'Chicago',
      destState: 'IL',
      pickupDate: '2026-09-01',
      items: [
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 1200, quantity: 4, nmfcClass: '70' },
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 800, quantity: 3, nmfcClass: '85' },
      ],
      accessorials: ['LIFTGATE_DELIVERY'],
    };

    const result = await CombinatorialSplitOptimizer.optimizeShipment(multiPalletRequest);

    expect(result.isSplitFeasible).toBe(true);
    expect(result.singleCarrierQuote).toBeDefined();
    expect(result.subShipmentA).toBeDefined();
    expect(result.subShipmentB).toBeDefined();
    expect(result.subShipmentA!.totalPallets + result.subShipmentB!.totalPallets).toBe(7);
    expect(result.combinedSplitCarrierCostCents).toBeGreaterThan(0);
    expect(result.plainLanguageHeadline).toBeDefined();
  });
});
