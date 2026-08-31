import PDFDocument from 'pdfkit';
import { Shipment, Quote } from '../../db/schema';
import { dbClient } from '../../db/client';

export interface RateConfirmationData {
  rateConfirmationNumber: string;
  loadReference: string;
  date: string;
  carrierName: string;
  carrierScac: string;
  carrierContact?: string;
  driverPhone?: string;
  
  originName: string;
  originAddress: string;
  originCityStateZip: string;
  pickupDate: string;
  pickupNumber: string;
  
  destName: string;
  destAddress: string;
  destCityStateZip: string;
  deliveryDateEst: string;
  
  totalPallets: number;
  totalWeightLbs: number;
  commodityDescription: string;
  
  linehaulAgreedCents: number;
  fuelAgreedCents: number;
  accessorialAgreedCents: number;
  totalAgreedCarrierRateCents: number;
  
  specialInstructions?: string;
  ebolUrl: string;
}

export interface DispatchNotificationPayload {
  smsMessage: string;
  emailSubject: string;
  emailBodyHtml: string;
  recipientEmail: string;
  recipientPhone?: string;
  rateConfirmationNumber: string;
}

export class DispatchNotificationEngine {
  /**
   * Generate Binary PDF Rate Confirmation document
   */
  public static async generateRateConfirmationPdf(data: RateConfirmationData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'LETTER' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text('CARRIER RATE CONFIRMATION & DISPATCH ORDER', 36, 36);
      doc.fontSize(9).font('Helvetica').text('APEX FREIGHT LOGISTICS • BROKER-CARRIER CONTRACT', 36, 56);
      doc.fontSize(10).font('Helvetica-Bold').text(`Confirmation #: ${data.rateConfirmationNumber}`, 360, 36, { align: 'right' });
      doc.fontSize(9).font('Helvetica').text(`Load Ref: ${data.loadReference}`, 360, 50, { align: 'right' });

      doc.rect(36, 75, 540, 1).fill('#000000');

      // Agreed Financials Box
      let y = 85;
      doc.rect(36, y, 540, 50).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text('AGREED CARRIER COMPENSATION:', 48, y + 10);
      
      const rateDollars = (data.totalAgreedCarrierRateCents / 100).toFixed(2);
      const lhDollars = (data.linehaulAgreedCents / 100).toFixed(2);
      const fuelDollars = (data.fuelAgreedCents / 100).toFixed(2);
      const accDollars = (data.accessorialAgreedCents / 100).toFixed(2);

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#059669').text(`TOTAL RATE: $${rateDollars} USD`, 48, y + 25);
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`(Linehaul: $${lhDollars} | Fuel: $${fuelDollars} | Accessorials: $${accDollars})`, 280, y + 28);

      // Stop-off Details
      y += 65;
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('1. ORIGIN PICKUP LOCATION', 36, y);
      doc.fontSize(9).font('Helvetica').text(data.originName, 36, y + 15);
      doc.text(data.originAddress, 36, y + 27);
      doc.text(data.originCityStateZip, 36, y + 39);
      doc.font('Helvetica-Bold').text(`Pickup Date: ${data.pickupDate} • Pickup #: ${data.pickupNumber}`, 36, y + 51);

      doc.fontSize(10).font('Helvetica-Bold').text('2. DESTINATION DELIVERY LOCATION', 300, y);
      doc.fontSize(9).font('Helvetica').text(data.destName, 300, y + 15);
      doc.text(data.destAddress, 300, y + 27);
      doc.text(data.destCityStateZip, 300, y + 39);
      doc.font('Helvetica-Bold').text(`Est. Delivery: ${data.deliveryDateEst}`, 300, y + 51);

      y += 75;
      doc.rect(36, y, 540, 1).fill('#000000');

      // Cargo Specs
      y += 10;
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text('CARGO & EQUIPMENT SPECS:', 36, y);
      doc.fontSize(8).font('Helvetica').text(
        `${data.totalPallets} Pallets • ${data.totalWeightLbs.toLocaleString()} lbs • ${data.commodityDescription}`,
        36,
        y + 14
      );

      // Special Instructions & eBOL link
      y += 35;
      doc.fontSize(9).font('Helvetica-Bold').text('DISPATCH INSTRUCTIONS & DIGITAL BOL:', 36, y);
      doc.fontSize(8).font('Helvetica').text(
        data.specialInstructions || 'Standard dock procedures. Driver must verify piece counts before departure.',
        36,
        y + 14
      );
      doc.font('Helvetica-Bold').fillColor('#2563eb').text(`Digital eBOL Link: ${data.ebolUrl}`, 36, y + 28);

      // Signature clause
      y += 50;
      doc.rect(36, y, 540, 0.5).fill('#94a3b8');
      y += 10;
      doc.fillColor('#000000').fontSize(7).font('Helvetica').text(
        'By accepting this rate confirmation, carrier agrees to all terms and conditions of Broker-Carrier Agreement. Double-brokering is strictly prohibited and results in immediate forfeiture of payment.',
        36,
        y,
        { width: 540 }
      );

      doc.end();
    });
  }

  /**
   * Build complete SMS and Email dispatch notification packet
   */
  public static buildDispatchNotifications(data: RateConfirmationData, recipientEmail: string, recipientPhone?: string): DispatchNotificationPayload {
    const rateDollars = (data.totalAgreedCarrierRateCents / 100).toFixed(2);

    const smsMessage = `DISPATCH ALERT: Load #${data.loadReference} confirmed for ${data.carrierName} ($${rateDollars}). Pickup: ${data.originAddress}, ${data.originCityStateZip} on ${data.pickupDate}. Pickup #: ${data.pickupNumber}. eBOL: ${data.ebolUrl}`;

    const emailSubject = `DISPATCH ORDER & RATE CONFIRMATION: ${data.loadReference} - ${data.carrierName} - ${data.originCityStateZip} to ${data.destCityStateZip}`;

    const emailBodyHtml = `
      <div style="font-family:sans-serif;color:#1e293b;padding:20px;">
        <h2 style="color:#1e1b4b;">Carrier Dispatch & Rate Confirmation</h2>
        <p>Dear ${data.carrierName} Dispatch Team,</p>
        <p>Your load confirmation <strong>#${data.rateConfirmationNumber}</strong> (Load Ref: <strong>#${data.loadReference}</strong>) is confirmed at the agreed rate of <strong>$${rateDollars} USD</strong>.</p>
        
        <table style="width:100%;border:1px solid #cbd5e1;padding:12px;margin:15px 0;">
          <tr><td><strong>Pickup Facility:</strong> ${data.originName} (${data.originAddress}, ${data.originCityStateZip})</td></tr>
          <tr><td><strong>Pickup Date:</strong> ${data.pickupDate}</td></tr>
          <tr><td><strong>Pickup Confirmation #:</strong> <span style="font-family:monospace;font-size:14px;color:#2563eb;font-weight:bold;">${data.pickupNumber}</span></td></tr>
          <tr><td><strong>Destination Facility:</strong> ${data.destName} (${data.destAddress}, ${data.destCityStateZip})</td></tr>
          <tr><td><strong>Cargo Specs:</strong> ${data.totalPallets} Pallets • ${data.totalWeightLbs.toLocaleString()} lbs</td></tr>
          <tr><td><strong>Special Instructions:</strong> ${data.specialInstructions || 'None'}</td></tr>
        </table>

        <p><a href="${data.ebolUrl}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">View & Print Digital eBOL</a></p>
        <p style="font-size:12px;color:#64748b;">Rate confirmation PDF is attached for your records.</p>
      </div>
    `.trim();

    return {
      smsMessage,
      emailSubject,
      emailBodyHtml,
      recipientEmail,
      recipientPhone,
      rateConfirmationNumber: data.rateConfirmationNumber,
    };
  }
}
