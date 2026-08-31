import * as crypto from 'crypto';
import { Quote, QuoteActionToken } from '../../db/schema';
import { dbClient } from '../../db/client';

export interface GenerateActionTokenParams {
  tenantId: string;
  quoteId: string;
  shipmentId: string;
  customerId?: string | null;
  quotedPriceCents: number;
  expiresInDays?: number;
}

export interface RenderQuoteEmailParams {
  quote: Quote;
  originCity: string;
  originState: string;
  originZip: string;
  destCity: string;
  destState: string;
  destZip: string;
  pickupDate: string;
  totalPallets: number;
  totalWeightLbs: number;
  accessorials: string[];
  shipperCompanyName?: string;
  brokerCompanyName?: string;
  brokerAgentName?: string;
  actionUrl: string;
}

export class QuoteDeliveryEngine {
  private static readonly TOKEN_SECRET =
    process.env.QUOTE_TOKEN_SECRET || 'ltl-os-quote-token-secret-signature-2026-production';

  /**
   * Generate secure HMAC-SHA256 signed Action Token for 1-Click Customer Booking
   */
  public static generateActionToken(params: GenerateActionTokenParams): QuoteActionToken {
    const expiresAt = new Date(Date.now() + (params.expiresInDays || 7) * 24 * 60 * 60 * 1000);
    const nonce = crypto.randomBytes(16).toString('hex');
    const rawPayload = `${params.tenantId}:${params.quoteId}:${params.shipmentId}:${params.quotedPriceCents}:${expiresAt.getTime()}:${nonce}`;

    const signature = crypto
      .createHmac('sha256', this.TOKEN_SECRET)
      .update(rawPayload)
      .digest('hex');

    const token = `${Buffer.from(rawPayload).toString('base64url')}.${signature}`;

    const record: QuoteActionToken = {
      token,
      tenantId: params.tenantId,
      quoteId: params.quoteId,
      shipmentId: params.shipmentId,
      customerId: params.customerId || null,
      quotedPriceCents: params.quotedPriceCents,
      expiresAt,
      isUsed: false,
      usedAt: null,
      bookedByIp: null,
      poNumber: null,
    };

    return record;
  }

  /**
   * Verify and decode Quote Action Token
   */
  public static verifyActionToken(tokenString: string): {
    isValid: boolean;
    isExpired: boolean;
    payload?: {
      tenantId: string;
      quoteId: string;
      shipmentId: string;
      quotedPriceCents: number;
      expiresAt: Date;
    };
    error?: string;
  } {
    try {
      const [encodedPayload, signature] = tokenString.split('.');
      if (!encodedPayload || !signature) {
        return { isValid: false, isExpired: false, error: 'Malformed token structure' };
      }

      const rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      const expectedSignature = crypto
        .createHmac('sha256', this.TOKEN_SECRET)
        .update(rawPayload)
        .digest('hex');

      if (signature !== expectedSignature) {
        return { isValid: false, isExpired: false, error: 'Invalid cryptographic signature' };
      }

      const [tenantId, quoteId, shipmentId, priceCentsStr, expiresAtMsStr] = rawPayload.split(':');
      const expiresAt = new Date(parseInt(expiresAtMsStr, 10));

      if (Date.now() > expiresAt.getTime()) {
        return { isValid: false, isExpired: true, error: 'Quote action token has expired' };
      }

      return {
        isValid: true,
        isExpired: false,
        payload: {
          tenantId,
          quoteId,
          shipmentId,
          quotedPriceCents: parseInt(priceCentsStr, 10),
          expiresAt,
        },
      };
    } catch (err: any) {
      return { isValid: false, isExpired: false, error: err.message };
    }
  }

  /**
   * Render Branded HTML Email Template for Shipper Quote Delivery
   */
  public static renderHtmlEmail(params: RenderQuoteEmailParams): string {
    const priceDollars = (params.quote.quotedCustomerPriceCents / 100).toFixed(2);
    const brokerName = params.brokerCompanyName || 'Apex Freight Logistics';
    const agentName = params.brokerAgentName || 'Dispatch Logistics Desk';

    const accessorialBadges =
      params.accessorials.length > 0
        ? params.accessorials
            .map(
              (a) =>
                `<span style="display:inline-block;background:#334155;color:#e2e8f0;font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;margin-right:4px;">${a}</span>`
            )
            .join(' ')
        : '<span style="color:#94a3b8;font-size:12px;">Standard Dock</span>';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Rate Quote: ${params.originCity}, ${params.originState} to ${params.destCity}, ${params.destState}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:40px 10px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#1e1b4b,#312e81);border-bottom:1px solid #4338ca;">
              <table width="100%">
                <tr>
                  <td>
                    <h1 style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${brokerName}</h1>
                    <p style="margin:4px 0 0;font-size:12px;color:#a5b4fc;">LTL Freight Operating System • Formal Rate Quote</p>
                  </td>
                  <td align="right">
                    <span style="background:#4338ca;color:#ffffff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;font-family:monospace;">${params.quote.quoteNumber}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Price & Hero -->
          <tr>
            <td style="padding:32px;border-bottom:1px solid #334155;text-align:center;">
              <div style="font-size:13px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Guaranteed Customer Rate</div>
              <div style="font-size:42px;font-weight:900;color:#10b981;margin:8px 0;font-family:monospace;">$${priceDollars}</div>
              <div style="font-size:13px;color:#cbd5e1;">Carrier: <strong>${params.quote.carrierName}</strong> (${params.quote.carrierScac}) • Transit: <strong>${params.quote.transitDays} Business Days</strong></div>
              
              <div style="margin-top:24px;">
                <a href="${params.actionUrl}" target="_blank" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.3);">
                  ✓ Book This Shipment (1-Click)
                </a>
              </div>
            </td>
          </tr>

          <!-- Lane Details -->
          <tr>
            <td style="padding:28px 32px;border-bottom:1px solid #334155;">
              <table width="100%">
                <tr>
                  <td width="48%" style="vertical-align:top;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Origin Pickup</div>
                    <div style="font-size:16px;font-weight:700;color:#ffffff;margin-top:4px;">${params.originCity}, ${params.originState} ${params.originZip}</div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Target Pickup: ${params.pickupDate}</div>
                  </td>
                  <td width="4%" style="text-align:center;color:#64748b;font-size:20px;">➔</td>
                  <td width="48%" style="vertical-align:top;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Destination Delivery</div>
                    <div style="font-size:16px;font-weight:700;color:#ffffff;margin-top:4px;">${params.destCity}, ${params.destState} ${params.destZip}</div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Est. Transit: ${params.quote.transitDays} Days</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipment Cargo Specs -->
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #334155;background-color:#1e293b;">
              <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:10px;">Declared Cargo & Handling Specs</div>
              <table width="100%" style="font-size:13px;color:#e2e8f0;">
                <tr>
                  <td><strong>Handling Units:</strong> ${params.totalPallets} Pallets</td>
                  <td><strong>Total Weight:</strong> ${params.totalWeightLbs.toLocaleString()} lbs</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:8px;">
                    <strong>Accessorials:</strong> ${accessorialBadges}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;font-size:12px;color:#64748b;text-align:center;">
              Quote valid for 7 days. Rate subject to standard NMFC verification. Questions? Contact ${agentName}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
