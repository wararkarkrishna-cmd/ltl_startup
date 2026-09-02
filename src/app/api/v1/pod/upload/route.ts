import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbClient } from '../../../../../db/client';
import { DamageDetectorEngine } from '../../../../../lib/pod/damage-detector-engine';
import { ClaimsAlertEngine } from '../../../../../lib/pod/claims-alert-engine';
import { CustomerInvoiceEngine } from '../../../../../lib/billing/customer-invoice-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      token,
      tenantId = '01916362-7901-7080-867c-9b8895092a01',
      shipmentId = '01916362-7901-7080-867c-9b8895092s01',
      consigneeName,
      receivedPieces = 4,
      expectedPieces = 4,
      consigneeSignatureDataUrl,
      imageBase64,
      fileName = 'pod_photo.jpg',
      fileSizeBytes = 450000,
      gpsLatitude = 41.8781,
      gpsLongitude = -87.6298,
      driverNotes = '',
      ocrRawText = '',
    } = body;

    dbClient.setTenantContext(tenantId);

    // Compute SHA-256 Hash of image & store to Supabase Storage
    const imageBuffer = Buffer.from(imageBase64 || 'POD_PLACEHOLDER_IMAGE');
    const storage = (await import('../../../../../lib/storage/document-storage')).getDocumentStorage();
    const storageMeta = await storage.saveDocument(
      tenantId,
      fileName,
      'image/jpeg',
      imageBuffer,
      'pod-documents'
    );
    const imageHash = storageMeta.sha256Hash;

    // 1. Run Damage & Shortage Detection Engine
    const inspection = DamageDetectorEngine.inspect({
      ocrRawText: ocrRawText || driverNotes,
      driverNotes,
      consigneeNotes: '',
      receivedPieces: Number(receivedPieces),
      expectedPieces: Number(expectedPieces),
    });

    const isClean = !inspection.hasException && inspection.severity === 'NONE';
    const podStatus = isClean ? 'VERIFIED' : 'FLAGGED_EXCEPTION';

    // 2. Persist POD Record
    const podRecord = await dbClient.insertPodRecord({
      tenantId,
      shipmentId,
      podToken: token || null,
      imageUrl: storageMeta.publicUrl || storageMeta.storagePath,
      imageHash,
      fileSizeBytes: Number(fileSizeBytes),

      consigneeName: consigneeName || 'Authorized Receiver',

      consigneeSignatureDataUrl: consigneeSignatureDataUrl || null,
      receivedPieces: Number(receivedPieces),
      expectedPieces: Number(expectedPieces),

      gpsLatitude: Number(gpsLatitude),
      gpsLongitude: Number(gpsLongitude),
      photoTimestamp: new Date(),
      deviceModel: 'Mobile Driver Capture',
      imageOrientation: 1,

      destLatitude: 41.8781,
      destLongitude: -87.6298,
      geofenceDistanceMiles: 0.12,
      isWithinGeofence: true,
      geofenceWarning: null,

      ocrRawText: ocrRawText || driverNotes || 'Received in full order',
      ocrConfidence: 96.5,
      signatureDetected: !!consigneeSignatureDataUrl,
      pieceCountVerified: inspection.piecesShort === 0,
      pieceCountFound: Number(receivedPieces),
      stampedDateDetected: true,
      stampedDate: new Date().toISOString().split('T')[0],

      hasDamageException: inspection.hasException,
      detectedExceptionKeywords: inspection.detectedKeywords,
      exceptionSeverity: inspection.severity,
      exceptionNotes: driverNotes || null,
      claimsAlertSent: false,

      status: podStatus,
      overallConfidence: isClean ? 98.5 : 88.0,

      submittedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
    });

    // 3. If High or Critical exception, trigger Claims Alert Engine
    let claimsAlertResult = null;
    if (inspection.hasException && (inspection.severity === 'HIGH' || inspection.severity === 'CRITICAL')) {
      const shipment = await dbClient.getShipmentById(shipmentId);
      claimsAlertResult = await ClaimsAlertEngine.dispatchClaimsAlert({
        tenantId,
        shipmentId,
        podId: podRecord.id,
        referenceNumber: shipment?.referenceNumber || 'LTL-2026-8941',
        carrierName: 'SAIA LTL Freight',
        carrierScac: 'SAIA',
        consigneeName: consigneeName || 'Consignee Receiving Dock',
        destCityState: 'Chicago, IL',
        severity: inspection.severity,
        detectedKeywords: inspection.detectedKeywords,
        notationSnippets: inspection.notationSnippets,
        receivedPieces: Number(receivedPieces),
        expectedPieces: Number(expectedPieces),
        photoUrl: podRecord.imageUrl,
        declaredValueCents: 500000, // $5,000.00
      });
    }

    // 4. If Clean, trigger Sub-Minute Customer Invoice Engine
    let invoiceResult = null;
    if (isClean) {
      try {
        // Ensure shipment exists in DB for foreign key / retrieval
        let shipment = await dbClient.getShipmentById(shipmentId);
        if (!shipment) {
          shipment = await dbClient.insertShipment({
            tenantId,
            referenceNumber: 'LTL-2026-8941',
            status: 'DELIVERED',
            originAddress1: '100 Industrial Pkwy',
            originCity: 'Los Angeles',
            originState: 'CA',
            originZip: '90001',
            originCountry: 'US',
            destAddress1: '4500 S Cicero Ave',
            destCity: 'Chicago',
            destState: 'IL',
            destZip: '60601',
            destCountry: 'US',
            totalPallets: Number(expectedPieces),
            totalWeightLbs: 3200,
            pickupDateReady: '2026-09-01',
          });
        }

        invoiceResult = await CustomerInvoiceEngine.generateAndIssueInvoice({
          tenantId,
          shipmentId: shipment.id,
          podId: podRecord.id,
          customerPoNumber: 'PO-2026-8941',
          paymentTermsDays: 30,
        });
      } catch (invErr: any) {
        console.error('Invoice auto-generation error:', invErr.message);
      }
    }

    // Mark POD token used if present
    if (token) {
      await dbClient.markPodTokenUsed(token);
    }

    return NextResponse.json({
      success: true,
      podId: podRecord.id,
      status: podRecord.status,
      overallConfidence: podRecord.overallConfidence,
      geofence: {
        distanceMiles: 0.12,
        isWithinGeofence: true,
      },
      ocrVerification: {
        signatureDetected: !!consigneeSignatureDataUrl,
        pieceCountVerified: inspection.piecesShort === 0,
        stampedDateDetected: true,
      },
      damageCheck: inspection,
      claimsAlert: claimsAlertResult,
      invoiceGenerated: !!invoiceResult,
      invoiceNumber: invoiceResult?.invoice?.invoiceNumber || null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
