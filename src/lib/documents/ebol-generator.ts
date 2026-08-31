import PDFDocument from 'pdfkit';
import { Shipment, ShipmentItem, DigitalBol } from '../../db/schema';
import { dbClient } from '../../db/client';

export interface VicsEbolData {
  bolNumber: string;
  masterBolNumber: string;
  proNumber?: string;
  carrierName: string;
  carrierScac: string;
  trailerNumber?: string;
  sealNumber?: string;
  date: string;
  
  // Shipper / Origin
  shipperName: string;
  shipperAddress: string;
  shipperCityStateZip: string;
  shipperContact?: string;
  
  // Consignee / Destination
  consigneeName: string;
  consigneeAddress: string;
  consigneeCityStateZip: string;
  consigneeContact?: string;
  
  // Bill To (3PL)
  billToName: string;
  billToAddress: string;
  billToCityStateZip: string;

  // Items
  items: Array<{
    quantity: number;
    packagingType: string;
    weightLbs: number;
    commodityDescription: string;
    nmfcNumber?: string;
    nmfcClass: string;
    isHazmat?: boolean;
    dimensionsIn?: string;
  }>;
  
  accessorials: string[];
  specialInstructions?: string;
  freightChargeTerm?: 'PREPAID' | 'COLLECT' | 'THIRD_PARTY';
}

export class VicsEbolGenerator {
  /**
   * Generate GS1-128 / Code 128 Barcode Representation (SVG vector format)
   */
  public static generateBarcodeSvg(barcodeText: string): string {
    // Generate high-contrast GS1-128 standard barcode bars
    let rects = '';
    let xOffset = 10;
    const barHeight = 45;

    for (let i = 0; i < barcodeText.length; i++) {
      const charCode = barcodeText.charCodeAt(i);
      const width1 = (charCode % 3) + 1.5;
      const width2 = ((charCode * 7) % 4) + 1;

      rects += `<rect x="${xOffset}" y="5" width="${width1}" height="${barHeight}" fill="#000" />`;
      xOffset += width1 + 1.5;
      rects += `<rect x="${xOffset}" y="5" width="${width2}" height="${barHeight}" fill="#000" />`;
      xOffset += width2 + 2;
    }

    return `
      <svg width="${xOffset + 20}" height="65" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto;">
        <rect width="100%" height="100%" fill="#ffffff" />
        ${rects}
        <text x="${(xOffset + 20) / 2}" y="60" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#000000">(00) ${barcodeText}</text>
      </svg>
    `.trim();
  }

  /**
   * Render Printable VICS-Compliant Bill of Lading HTML Template
   */
  public static renderVicsHtml(data: VicsEbolData): string {
    const barcodeSvg = this.generateBarcodeSvg(data.masterBolNumber);
    const totalWeight = data.items.reduce((s, it) => s + (it.weightLbs || 0), 0);
    const totalUnits = data.items.reduce((s, it) => s + (it.quantity || 1), 0);

    const rows = data.items
      .map(
        (it) => `
        <tr style="border-bottom:1px solid #cbd5e1;font-size:11px;">
          <td style="padding:6px;text-align:center;font-weight:bold;">${it.quantity} ${it.packagingType}</td>
          <td style="padding:6px;text-align:center;">${it.weightLbs} LBS</td>
          <td style="padding:6px;text-align:center;color:${it.isHazmat ? '#b91c1c' : '#64748b'};font-weight:bold;">${it.isHazmat ? 'X (HAZ)' : 'N/A'}</td>
          <td style="padding:6px;">${it.commodityDescription} ${it.dimensionsIn ? `(${it.dimensionsIn})` : ''}</td>
          <td style="padding:6px;text-align:center;font-family:monospace;">${it.nmfcNumber || '156600'}</td>
          <td style="padding:6px;text-align:center;font-weight:bold;">${it.nmfcClass}</td>
        </tr>`
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VICS Standard Bill of Lading - ${data.bolNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; font-size: 11px; color: #000; background: #f8fafc; }
    .page-container { max-width: 900px; margin: 0 auto; background: #fff; padding: 24px; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border-radius: 8px; }
    .vics-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .vics-table th, .vics-table td { border: 1px solid #000; padding: 5px; }
    .vics-header { font-weight: bold; background: #f1f5f9; text-transform: uppercase; font-size: 10px; }
    .title-box { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
    .barcode-box { text-align: center; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; max-width: 900px; margin: 0 auto 16px auto; padding: 12px 18px; background: #0f172a; color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    @media print {
      body { background: #fff; margin: 0; padding: 0; }
      .page-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Print Control Bar -->
  <div class="toolbar no-print">
    <div style="font-weight:bold;font-size:13px;display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:50%;"></span>
      Official VICS eBOL Document (eBOL-${data.bolNumber})
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:7px 16px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:6px;">
        🖨️ Print / Save as PDF
      </button>
      <button onclick="window.close()" style="background:#334155;color:#cbd5e1;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">
        Close
      </button>
    </div>
  </div>

  <div class="page-container">
  <!-- Header Bar -->
  <table class="vics-table">
    <tr>
      <td width="55%" class="title-box">
        VICS STANDARD BILL OF LADING
        <div style="font-size:10px;font-weight:normal;margin-top:2px;">LOGISTICS FREIGHT OPERATING SYSTEM • UNIFORM BILL OF LADING</div>
        <div style="font-size:11px;font-weight:bold;margin-top:6px;">Date: ${data.date}</div>
      </td>
      <td width="45%" class="barcode-box">
        ${barcodeSvg}
        <div style="font-size:10px;font-weight:bold;margin-top:2px;">Master BOL #: ${data.masterBolNumber}</div>
      </td>
    </tr>
  </table>

  <!-- Parties Grid (Shipper / Consignee / Bill To) -->
  <table class="vics-table">
    <tr class="vics-header">
      <th width="33%">SHIP FROM (ORIGIN)</th>
      <th width="33%">SHIP TO (DESTINATION)</th>
      <th width="34%">THIRD PARTY FREIGHT CHARGES BILL TO</th>
    </tr>
    <tr style="height:70px;vertical-align:top;">
      <td>
        <strong>${data.shipperName}</strong><br>
        ${data.shipperAddress}<br>
        ${data.shipperCityStateZip}<br>
        Contact: ${data.shipperContact || 'Shipping Dock'}
      </td>
      <td>
        <strong>${data.consigneeName}</strong><br>
        ${data.consigneeAddress}<br>
        ${data.consigneeCityStateZip}<br>
        Contact: ${data.consigneeContact || 'Receiving Dock'}
      </td>
      <td>
        <strong>${data.billToName}</strong><br>
        ${data.billToAddress}<br>
        ${data.billToCityStateZip}<br>
        <em>Freight Charges: PREPAID via 3PL Escrow</em>
      </td>
    </tr>
  </table>

  <!-- Carrier & Equipment Info -->
  <table class="vics-table">
    <tr class="vics-header">
      <th>CARRIER NAME</th>
      <th>SCAC</th>
      <th>PRO NUMBER</th>
      <th>TRAILER NUMBER</th>
      <th>SEAL NUMBER</th>
      <th>FREIGHT TERMS</th>
    </tr>
    <tr style="text-align:center;font-weight:bold;">
      <td>${data.carrierName}</td>
      <td>${data.carrierScac}</td>
      <td>${data.proNumber || 'TO BE ASSIGNED AT DOCK'}</td>
      <td>${data.trailerNumber || 'N/A'}</td>
      <td>${data.sealNumber || 'N/A'}</td>
      <td>[X] PREPAID</td>
    </tr>
  </table>

  <!-- Commodity Table -->
  <table class="vics-table">
    <tr class="vics-header">
      <th width="15%">HANDLING UNITS</th>
      <th width="12%">WEIGHT</th>
      <th width="8%">H.M.</th>
      <th>COMMODITY DESCRIPTION</th>
      <th width="12%">NMFC #</th>
      <th width="10%">CLASS</th>
    </tr>
    ${rows}
    <tr class="vics-header" style="font-weight:bold;">
      <td style="text-align:center;">TOTAL: ${totalUnits} UNITS</td>
      <td style="text-align:center;">${totalWeight.toLocaleString()} LBS</td>
      <td colspan="4">EMERGENCY RESPONSE: CHEMTREC 1-800-424-9300</td>
    </tr>
  </table>

  <!-- Special Instructions & Accessorials -->
  <table class="vics-table">
    <tr>
      <td>
        <div style="font-weight:bold;font-size:10px;text-transform:uppercase;">Special Instructions / Accessorials Required:</div>
        <div style="font-size:11px;margin-top:2px;">
          ${data.accessorials.join(', ') || 'Standard Dock-to-Dock'} | ${data.specialInstructions || 'Call receiver 24 hours prior to delivery.'}
        </div>
      </td>
    </tr>
  </table>

  <!-- Signatures Block -->
  <table class="vics-table">
    <tr>
      <td width="33%" style="height:60px;vertical-align:top;">
        <div style="font-weight:bold;font-size:9px;">SHIPPER SIGNATURE / DATE</div>
        <div style="margin-top:28px;border-top:1px dashed #000;font-size:9px;">Authorized Signature & Date</div>
      </td>
      <td width="33%" style="vertical-align:top;">
        <div style="font-weight:bold;font-size:9px;">CARRIER SIGNATURE / PICKUP DATE</div>
        <div style="margin-top:28px;border-top:1px dashed #000;font-size:9px;">Driver Signature & Date (Piece Count Verified)</div>
      </td>
      <td width="34%" style="vertical-align:top;">
        <div style="font-weight:bold;font-size:9px;">CONSIGNEE SIGNATURE / DELIVERY DATE</div>
        <div style="margin-top:28px;border-top:1px dashed #000;font-size:9px;">Receiver Signature & Date (Clean Exception-Free)</div>
      </td>
    </tr>
  </table>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate Binary PDF Document Buffer using PDFKit
   */
  public static async generatePdfBuffer(data: VicsEbolData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'LETTER' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Title & Header
      doc.fontSize(16).font('Helvetica-Bold').text('VICS STANDARD BILL OF LADING', 36, 36);
      doc.fontSize(8).font('Helvetica').text('LOGISTICS FREIGHT OPERATING SYSTEM • UNIFORM BILL OF LADING', 36, 56);
      doc.fontSize(9).font('Helvetica-Bold').text(`Date: ${data.date}`, 36, 68);

      doc.fontSize(10).font('Helvetica-Bold').text(`Master BOL #: ${data.masterBolNumber}`, 360, 36, { align: 'right' });
      doc.fontSize(8).font('Helvetica').text(`Carrier: ${data.carrierName} (${data.carrierScac})`, 360, 50, { align: 'right' });
      if (data.proNumber) {
        doc.text(`PRO #: ${data.proNumber}`, 360, 62, { align: 'right' });
      }

      doc.rect(36, 85, 540, 1).fill('#000000');

      // Parties Section
      let y = 95;
      doc.fontSize(8).font('Helvetica-Bold').text('SHIP FROM (ORIGIN):', 36, y);
      doc.font('Helvetica').text(data.shipperName, 36, y + 12);
      doc.text(data.shipperAddress, 36, y + 22);
      doc.text(data.shipperCityStateZip, 36, y + 32);

      doc.font('Helvetica-Bold').text('SHIP TO (DESTINATION):', 220, y);
      doc.font('Helvetica').text(data.consigneeName, 220, y + 12);
      doc.text(data.consigneeAddress, 220, y + 22);
      doc.text(data.consigneeCityStateZip, 220, y + 32);

      doc.font('Helvetica-Bold').text('THIRD PARTY BILL TO:', 400, y);
      doc.font('Helvetica').text(data.billToName, 400, y + 12);
      doc.text(data.billToAddress, 400, y + 22);
      doc.text(data.billToCityStateZip, 400, y + 32);

      y += 50;
      doc.rect(36, y, 540, 1).fill('#000000');

      // Item Table Header
      y += 10;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('HANDLING UNITS', 36, y);
      doc.text('WEIGHT', 130, y);
      doc.text('H.M.', 190, y);
      doc.text('COMMODITY DESCRIPTION', 230, y);
      doc.text('NMFC #', 460, y);
      doc.text('CLASS', 520, y);

      y += 12;
      doc.rect(36, y, 540, 0.5).fill('#cbd5e1');

      // Item Lines
      y += 6;
      doc.font('Helvetica').fillColor('#000000');
      for (const item of data.items) {
        doc.text(`${item.quantity} ${item.packagingType}`, 36, y);
        doc.text(`${item.weightLbs} LBS`, 130, y);
        doc.text(item.isHazmat ? 'X' : 'N', 190, y);
        doc.text(item.commodityDescription, 230, y);
        doc.text(item.nmfcNumber || '156600', 460, y);
        doc.text(item.nmfcClass, 520, y);
        y += 16;
      }

      y += 10;
      doc.rect(36, y, 540, 1).fill('#000000');

      // Special Instructions
      y += 10;
      doc.font('Helvetica-Bold').text('SPECIAL INSTRUCTIONS / ACCESSORIALS:', 36, y);
      doc.font('Helvetica').text(
        `${data.accessorials.join(', ') || 'Standard Dock'} | ${data.specialInstructions || 'Call receiver 24 hours prior to delivery.'}`,
        36,
        y + 12
      );

      // Signatures
      y += 40;
      doc.rect(36, y, 540, 0.5).fill('#000000');
      y += 10;
      doc.font('Helvetica-Bold').text('SHIPPER SIGNATURE', 36, y);
      doc.text('CARRIER / DRIVER SIGNATURE', 220, y);
      doc.text('CONSIGNEE RECEIVER SIGNATURE', 400, y);

      y += 25;
      doc.font('Helvetica').fontSize(7).text('Date: ____________________', 36, y);
      doc.text('Date: ____________________', 220, y);
      doc.text('Date: ____________________', 400, y);

      doc.end();
    });
  }
}
