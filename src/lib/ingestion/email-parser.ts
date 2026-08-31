import { calculateSha256 } from '../storage/document-storage';

export interface ParsedEmailAttachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  content: Buffer;
}

export interface ParsedEmailPayload {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  plainTextBody: string;
  htmlBody?: string;
  messageId?: string;
  receivedAt: Date;
  attachments: ParsedEmailAttachment[];
  headers?: Record<string, string>;
}

export class InboundEmailParser {
  /**
   * Parse SendGrid Inbound Parse Webhook Payload
   */
  public static parseSendGridWebhook(
    body: Record<string, any>,
    files?: Array<{ originalname: string; mimetype: string; buffer: Buffer }>
  ): ParsedEmailPayload {
    const fromStr = body.from || '';
    const fromMatch = fromStr.match(/(.*?)(?:<(.+@.+)>)?$/);
    const fromName = fromMatch ? (fromMatch[1] || '').replace(/\"/g, '').trim() : '';
    const fromEmail = fromMatch && fromMatch[2] ? fromMatch[2].trim() : fromStr.trim();

    const attachments: ParsedEmailAttachment[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        attachments.push({
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.buffer.length,
          sha256Hash: calculateSha256(file.buffer),
          content: file.buffer,
        });
      }
    }

    return {
      fromEmail,
      fromName: fromName || fromEmail,
      toEmail: body.to || '',
      subject: body.subject || 'RFQ Request',
      plainTextBody: body.text || body.html || '',
      htmlBody: body.html,
      messageId: body.messageId || body['message-id'],
      receivedAt: new Date(),
      attachments,
    };
  }

  /**
   * Parse Mailgun Inbound Webhook Payload
   */
  public static parseMailgunWebhook(
    body: Record<string, any>,
    files?: Array<{ originalname: string; mimetype: string; buffer: Buffer }>
  ): ParsedEmailPayload {
    const attachments: ParsedEmailAttachment[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        attachments.push({
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.buffer.length,
          sha256Hash: calculateSha256(file.buffer),
          content: file.buffer,
        });
      }
    }

    return {
      fromEmail: body.sender || body.from || '',
      fromName: body['from-name'] || body.sender || '',
      toEmail: body.recipient || body.to || '',
      subject: body.subject || 'RFQ Request',
      plainTextBody: body['body-plain'] || body['stripped-text'] || '',
      htmlBody: body['body-html'] || body['stripped-html'],
      messageId: body['Message-Id'],
      receivedAt: new Date(),
      attachments,
    };
  }

  /**
   * Parse Raw RFC 822 / Plain Text Freight Email
   */
  public static parseRawEmailText(rawText: string): ParsedEmailPayload {
    const lines = rawText.split(/\r?\n/);
    let fromEmail = 'unknown@shipper.com';
    let fromName = 'Shipper';
    let subject = 'Freight Quote Request';
    let bodyStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().startsWith('from:')) {
        const val = line.substring(5).trim();
        const match = val.match(/(.*?)(?:<(.+@.+)>)?$/);
        fromName = match ? (match[1] || '').replace(/\"/g, '').trim() : val;
        fromEmail = match && match[2] ? match[2].trim() : val;
      } else if (line.toLowerCase().startsWith('subject:')) {
        subject = line.substring(8).trim();
      } else if (line === '') {
        bodyStartIndex = i + 1;
        break;
      }
    }

    const plainTextBody = lines.slice(bodyStartIndex).join('\n').trim() || rawText;

    return {
      fromEmail,
      fromName: fromName || fromEmail,
      toEmail: 'quotes@freightos.app',
      subject,
      plainTextBody,
      receivedAt: new Date(),
      attachments: [],
    };
  }
}
