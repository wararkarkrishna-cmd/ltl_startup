import { AccessorialCode } from '../../db/schema';

export interface BenchmarkRfqItem {
  id: string;
  category: 'EMAIL_CHAIN' | 'MULTIPLIER_DIMS' | 'HIGH_ACCESSORIAL' | 'VOLUME_LTL' | 'IRREGULAR_PACKAGING' | 'MULTI_LANE';
  rawText: string;
  groundTruth: {
    originZip: string;
    destZip: string;
    totalWeightLbs: number;
    totalPallets: number;
    accessorials: AccessorialCode[];
  };
}

/**
 * Generate 100+ Realistic Messy Freight RFQs for Benchmark Harness
 */
export function generateBenchmarkDataset(): BenchmarkRfqItem[] {
  const dataset: BenchmarkRfqItem[] = [];

  const LANES = [
    { oZip: '90001', oCity: 'Los Angeles', oState: 'CA', dZip: '60601', dCity: 'Chicago', dState: 'IL' },
    { oZip: '75201', oCity: 'Dallas', oState: 'TX', dZip: '30301', dCity: 'Atlanta', dState: 'GA' },
    { oZip: '98101', oCity: 'Seattle', oState: 'WA', dZip: '33101', dCity: 'Miami', dState: 'FL' },
    { oZip: '10001', oCity: 'New York', oState: 'NY', dZip: '77001', dCity: 'Houston', dState: 'TX' },
    { oZip: '02108', oCity: 'Boston', oState: 'MA', dZip: '85001', dCity: 'Phoenix', dState: 'AZ' },
    { oZip: '48201', oCity: 'Detroit', oState: 'MI', dZip: '37201', dCity: 'Nashville', dState: 'TN' },
    { oZip: '19102', oCity: 'Philadelphia', oState: 'PA', dZip: '28202', dCity: 'Charlotte', dState: 'NC' },
    { oZip: '63101', oCity: 'St. Louis', oState: 'MO', dZip: '80202', dCity: 'Denver', dState: 'CO' },
    { oZip: '55401', oCity: 'Minneapolis', oState: 'MN', dZip: '70112', dCity: 'New Orleans', dState: 'LA' },
    { oZip: '97201', oCity: 'Portland', oState: 'OR', dZip: '84101', dCity: 'Salt Lake City', dState: 'UT' },
  ];

  // 1. Generate Multiplier & Complex Dimensions Test Cases (25 items)
  for (let i = 0; i < 25; i++) {
    const lane = LANES[i % LANES.length];
    const qty = (i % 6) + 1;
    const unitWgt = 800 + (i * 50);
    const totalWgt = qty * unitWgt;

    dataset.push({
      id: `BENCH-MULT-${i + 1}`,
      category: 'MULTIPLIER_DIMS',
      rawText: `Please quote ${qty} pallets 48x40x48 @ ${unitWgt}# each from ${lane.oCity} ${lane.oState} ${lane.oZip} to ${lane.dCity} ${lane.dState} ${lane.dZip}. Total ${totalWgt} lbs.`,
      groundTruth: {
        originZip: lane.oZip,
        destZip: lane.dZip,
        totalWeightLbs: totalWgt,
        totalPallets: qty,
        accessorials: [],
      },
    });
  }

  // 2. Generate High-Accessorial Industrial Cases (25 items)
  const ACCESSORIAL_PRESETS: Array<{ text: string; codes: AccessorialCode[] }> = [
    { text: 'Liftgate delivery required at destination dock with no dock leveler.', codes: ['LG_DEL'] },
    { text: 'Residential delivery, hydraulic gate needed, call receiver prior.', codes: ['RES_DEL', 'LG_DEL', 'NOTIFY'] },
    { text: 'Deliver to active construction job site limited access, bring inside second floor.', codes: ['LIM_ACC', 'INS_DEL'] },
    { text: 'Pickup at residential location with lift gate, deliver to church campus.', codes: ['RES_PU', 'LG_PU', 'LG_DEL', 'LIM_ACC'] },
    { text: 'Convention center tradeshow delivery Las Vegas expo hall booth #204.', codes: ['TRADESHOW'] },
  ];

  for (let i = 0; i < 25; i++) {
    const lane = LANES[(i + 2) % LANES.length];
    const preset = ACCESSORIAL_PRESETS[i % ACCESSORIAL_PRESETS.length];
    const qty = (i % 4) + 1;
    const totalWgt = qty * 750;

    dataset.push({
      id: `BENCH-ACC-${i + 1}`,
      category: 'HIGH_ACCESSORIAL',
      rawText: `RFQ Request:\nFrom: ${lane.oCity}, ${lane.oState} ${lane.oZip}\nTo: ${lane.dCity}, ${lane.dState} ${lane.dZip}\nFreight: ${qty} skids 48x40x48 ${totalWgt} lbs total.\nNotes: ${preset.text}`,
      groundTruth: {
        originZip: lane.oZip,
        destZip: lane.dZip,
        totalWeightLbs: totalWgt,
        totalPallets: qty,
        accessorials: preset.codes,
      },
    });
  }

  // 3. Generate Forwarded Messy Email Chains (25 items)
  for (let i = 0; i < 25; i++) {
    const lane = LANES[(i + 4) % LANES.length];
    const qty = (i % 3) + 2;
    const totalWgt = qty * 900;

    dataset.push({
      id: `BENCH-EMAIL-${i + 1}`,
      category: 'EMAIL_CHAIN',
      rawText: `---------- Forwarded message ---------\nFrom: "Dave Dispatcher" <dave@acme-parts.com>\nDate: Aug 31, 2026 at 9:15 AM\nSubject: Fwd: Freight Rate needed ASAP\nTo: quotes@freightos.app\n\nHey team,\nCan you grab us a rate on this shipment:\n${qty} handling units of electrical machinery\nWeight: ${totalWgt} lbs\nOrigin ZIP: ${lane.oZip} (${lane.oCity} ${lane.oState})\nConsignee ZIP: ${lane.dZip} (${lane.dCity} ${lane.dState})\nNeed lift gate on delivery.\n\nThanks,\nDave\nAcme Auto Parts, LLC`,
      groundTruth: {
        originZip: lane.oZip,
        destZip: lane.dZip,
        totalWeightLbs: totalWgt,
        totalPallets: qty,
        accessorials: ['LG_DEL'],
      },
    });
  }

  // 4. Generate Volume-LTL & Large Capacity Candidates (15 items)
  for (let i = 0; i < 15; i++) {
    const lane = LANES[(i + 6) % LANES.length];
    const qty = 6 + (i % 5); // 6 to 10 pallets
    const totalWgt = qty * 1100; // 6,600 to 11,000 lbs

    dataset.push({
      id: `BENCH-VOL-${i + 1}`,
      category: 'VOLUME_LTL',
      rawText: `Volume Quote: ${qty} pallets 48x40x60 heavy industrial valves, total weight ${totalWgt} lbs. Ready at ${lane.oCity} ${lane.oState} ${lane.oZip}, delivering to ${lane.dCity} ${lane.dState} ${lane.dZip}.`,
      groundTruth: {
        originZip: lane.oZip,
        destZip: lane.dZip,
        totalWeightLbs: totalWgt,
        totalPallets: qty,
        accessorials: [],
      },
    });
  }

  // 5. Generate Irregular Packaging & Hazmat Candidates (12 items)
  for (let i = 0; i < 12; i++) {
    const lane = LANES[(i + 8) % LANES.length];
    const isHazmat = i % 2 === 0;
    const pkgType = i % 3 === 0 ? 'crates' : i % 3 === 1 ? 'drums' : 'cartons';
    const totalWgt = 1500 + (i * 100);

    const hazmatNote = isHazmat ? 'Hazardous Materials UN 1993 Class 3 Flammable Liquid.' : 'Standard non-hazardous freight.';
    const accessorials: AccessorialCode[] = isHazmat ? ['HAZMAT'] : [];

    dataset.push({
      id: `BENCH-IRREG-${i + 1}`,
      category: 'IRREGULAR_PACKAGING',
      rawText: `Need rate for 2 ${pkgType} 48x40x50, total ${totalWgt} lbs. Shipping from ${lane.oZip} to ${lane.dZip}. ${hazmatNote}`,
      groundTruth: {
        originZip: lane.oZip,
        destZip: lane.dZip,
        totalWeightLbs: totalWgt,
        totalPallets: 2,
        accessorials,
      },
    });
  }

  return dataset; // 25 + 25 + 25 + 15 + 12 = 102 items
}
