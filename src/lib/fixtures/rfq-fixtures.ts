export interface RfqFixture {
  fixtureId: string;
  name: string;
  category: 'CLEAN_PDF' | 'MIXED_DIMS' | 'SCANNED_RECEIPT' | 'SPREADSHEET' | 'IMPLICIT_ACCESSORIALS' | 'HAZMAT' | 'OVERLENGTH' | 'RECLASS_RISK' | 'TRADESHOW' | 'VOLUME_LTL';
  rawText: string;
  expectedData: {
    originZip: string;
    destZip: string;
    totalWeightLbs: number;
    totalUnits: number;
    recommendedClass: number;
    hasOverlength: boolean;
    hasHazmat: boolean;
    hasAccessorials: string[];
  };
}

export const RFQ_10_TEST_FIXTURES: RfqFixture[] = [
  // 1. Clean PDF RFQ
  {
    fixtureId: 'FIX-01-CLEAN-PDF',
    name: 'Clean Standard Palletized PDF RFQ',
    category: 'CLEAN_PDF',
    rawText: `PACIFIC INDUSTRIAL SUPPLY CO.\nQUOTE REQUEST: #RFQ-84920\nOrigin: 100 Main St, Los Angeles CA 90001\nDestination: 500 N Michigan Ave, Chicago IL 60601\nCommodity: Electric Motors NOIBN\nItems: 2 Pallets 48x40x48 @ 1000 lbs each (Total: 2000 lbs)\nReady Date: 2026-09-01`,
    expectedData: {
      originZip: '90001',
      destZip: '60601',
      totalWeightLbs: 2000,
      totalUnits: 2,
      recommendedClass: 70,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: [],
    },
  },

  // 2. Multi-Pallet Mixed-Dimension Load
  {
    fixtureId: 'FIX-02-MIXED-DIMS',
    name: 'Multi-Pallet Mixed-Dimension Freight',
    category: 'MIXED_DIMS',
    rawText: `Mixed Pallet Shipment from Dallas TX 75201 to Atlanta GA 30301.\nLine 1: 1 Pallet 48x40x48 @ 800 lbs\nLine 2: 2 Pallets 48x40x60 @ 1200 lbs each (2400 lbs)\nLine 3: 1 Pallet 48x40x72 @ 1500 lbs\nTotal Weight: 4700 lbs. Total Pallets: 4.`,
    expectedData: {
      originZip: '75201',
      destZip: '30301',
      totalWeightLbs: 4700,
      totalUnits: 4,
      recommendedClass: 70,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: [],
    },
  },

  // 3. Handwritten / Scanned Receipt Format
  {
    fixtureId: 'FIX-03-SCANNED-RECEIPT',
    name: 'Scanned Dock Receipt with Handwriting OCR',
    category: 'SCANNED_RECEIPT',
    rawText: `DOCK RECEIPT - PACIFIC TERMINAL\nShipper ZIP: 98101 (Seattle WA)\nConsignee ZIP: 33101 (Miami FL)\nPiece Count: 1 skid\nDimensions: 48*40*48\nWeight: 1,450 lbs\nCommodity: Steel Castings\nNotes: Dock open 8am-4pm`,
    expectedData: {
      originZip: '98101',
      destZip: '33101',
      totalWeightLbs: 1450,
      totalUnits: 1,
      recommendedClass: 65,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: [],
    },
  },

  // 4. Industrial Machinery Spreadsheet Manifest (CSV/XLSX)
  {
    fixtureId: 'FIX-04-SPREADSHEET',
    name: 'Industrial Machinery Spreadsheet Manifest',
    category: 'SPREADSHEET',
    rawText: `Item_ID,Packaging,Length_in,Width_in,Height_in,Weight_lbs,Origin_ZIP,Dest_ZIP\nCRATE-1,CRATE,60,40,50,1800,48201,37201\nCRATE-2,CRATE,60,40,50,1800,48201,37201\nTotal Weight: 3600 lbs from Detroit MI 48201 to Nashville TN 37201`,
    expectedData: {
      originZip: '48201',
      destZip: '37201',
      totalWeightLbs: 3600,
      totalUnits: 2,
      recommendedClass: 65,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: [],
    },
  },

  // 5. Free-Text Email with Implicit Accessorials
  {
    fixtureId: 'FIX-05-EMAIL-ACCESSORIALS',
    name: 'Forwarded Email with Liftgate & Residential Delivery',
    category: 'IMPLICIT_ACCESSORIALS',
    rawText: `Hey Dave,\nCan you get a quote on 3 skids of printing equipment from Boston MA 02108 to Phoenix AZ 85001?\nTotal weight: 2400 lbs.\nThe receiver is a residential bakery with no loading dock so we need hydraulic liftgate delivery and please call them prior to delivery.\nThanks,\nTom`,
    expectedData: {
      originZip: '02108',
      destZip: '85001',
      totalWeightLbs: 2400,
      totalUnits: 3,
      recommendedClass: 70,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: ['LIFTGATE_DELIVERY', 'NOTIFY_BEFORE_DELIVERY'],
    },
  },

  // 6. Hazardous Materials Shipment (UN 1993 Class 3)
  {
    fixtureId: 'FIX-06-HAZMAT',
    name: 'DOT Hazmat Flammable Liquid Chemical Drums',
    category: 'HAZMAT',
    rawText: `HAZARDOUS FREIGHT QUOTE\nOrigin: Houston TX 77001\nDestination: New York NY 10001\nItems: 5 drums 48x40x40 total weight: 2250 lbs.\nCommodity: UN 1993 Flammable Liquids N.O.S., Hazard Class 3, PG II.\nEmergency contact: 800-535-5053`,
    expectedData: {
      originZip: '77001',
      destZip: '10001',
      totalWeightLbs: 2250,
      totalUnits: 5,
      recommendedClass: 100,
      hasOverlength: false,
      hasHazmat: true,
      hasAccessorials: ['HAZMAT'],
    },
  },

  // 7. Overlength Bundle Freight (>96 inches)
  {
    fixtureId: 'FIX-07-OVERLENGTH',
    name: 'Overlength Industrial Steel Tubes (120 Inches)',
    category: 'OVERLENGTH',
    rawText: `Overlength Freight RFQ:\n1 bundle 120x40x48 @ 2200 lbs from Philadelphia PA 19102 to Charlotte NC 28202.\nCommodity: Extruded Steel Piping.\nOverlength surcharge applies (>8ft).`,
    expectedData: {
      originZip: '19102',
      destZip: '28202',
      totalWeightLbs: 2200,
      totalUnits: 1,
      recommendedClass: 70,
      hasOverlength: true,
      hasHazmat: false,
      hasAccessorials: [],
    },
  },

  // 8. High Reclassification Risk (Declared Class 50 vs Calculated Class 250)
  {
    fixtureId: 'FIX-08-RECLASS-RISK',
    name: 'High Reclassification Risk Lightweight Freight',
    category: 'RECLASS_RISK',
    rawText: `Shipper declared Class 50 for 2 pallets 48x40x60 weighing only 300 lbs each (Total: 600 lbs).\nOrigin: St. Louis MO 63101 to Denver CO 80202.\nCommodity: Empty Plastic Enclosures.`,
    expectedData: {
      originZip: '63101',
      destZip: '80202',
      totalWeightLbs: 600,
      totalUnits: 2,
      recommendedClass: 250,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: [],
    },
  },

  // 9. Tradeshow Exhibition Freight
  {
    fixtureId: 'FIX-09-TRADESHOW',
    name: 'Tradeshow Exhibition Booth to Las Vegas Convention Center',
    category: 'TRADESHOW',
    rawText: `Quote needed for 2 crates 48x40x50, 1800 lbs total.\nOrigin: Minneapolis MN 55401\nDestination: Las Vegas Convention Center, Expo Hall Booth #412, Las Vegas NV 89109.\nDirect to show site convention delivery.`,
    expectedData: {
      originZip: '55401',
      destZip: '89109',
      totalWeightLbs: 1800,
      totalUnits: 2,
      recommendedClass: 70,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: ['TRADESHOW'],
    },
  },

  // 10. Heavy Volume-LTL 8-Pallet Load
  {
    fixtureId: 'FIX-10-VOLUME-LTL',
    name: 'Volume-LTL 8-Pallet Heavy Shipment (16 Linear Feet)',
    category: 'VOLUME_LTL',
    rawText: `Volume LTL Quote:\n8 Pallets 48x40x48 @ 1000 lbs each (Total: 8000 lbs).\nOrigin: Portland OR 97201\nDestination: Salt Lake City UT 84101.\nNon-stackable heavy industrial valves.`,
    expectedData: {
      originZip: '97201',
      destZip: '84101',
      totalWeightLbs: 8000,
      totalUnits: 8,
      recommendedClass: 70,
      hasOverlength: false,
      hasHazmat: false,
      hasAccessorials: [],
    },
  },
];
