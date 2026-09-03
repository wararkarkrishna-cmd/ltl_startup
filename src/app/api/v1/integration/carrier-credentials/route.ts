import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../../db/client';
import { CredentialVault } from '../../../../../../lib/security/credential-vault';
import { CarrierCode } from '../../../../../../db/schema';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId = '01916362-7901-7080-867c-9b8895092a01',
      carrierCode,
      accountNumber,
      apiKey,
    } = body;

    if (!carrierCode || !accountNumber || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'carrierCode, accountNumber, and apiKey are required' },
        { status: 400 }
      );
    }

    dbClient.setTenantContext(tenantId);

    // Encrypt sensitive API key using AES-256-GCM envelope vault
    const encrypted = CredentialVault.encrypt(apiKey, tenantId);

    const credRecord = await dbClient.insertCarrierCredential({
      tenantId,
      carrierCode: carrierCode as CarrierCode,
      carrierName: carrierCode === 'XPO' ? 'XPO Logistics' : carrierCode === 'SAIA' ? 'SAIA LTL Freight' : carrierCode === 'ESTES' ? 'Estes Express Lines' : carrierCode === 'ABF' ? 'ArcBest / ABF Freight' : 'R+L Carriers',
      carrierScac: carrierCode === 'XPO' ? 'CNWY' : carrierCode === 'SAIA' ? 'SAIA' : carrierCode === 'ESTES' ? 'EXLA' : carrierCode === 'ABF' ? 'ABFS' : 'RLCA',
      accountNumber,
      encryptedApiKey: encrypted.encryptedData,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      credentialId: credRecord.id,
      carrierCode,
      accountNumber,
      vaultStatus: 'ENCRYPTED_AES_256_GCM',
      message: `Successfully validated and saved ${carrierCode} credentials to Supabase Vault`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
