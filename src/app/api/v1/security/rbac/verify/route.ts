import { NextRequest, NextResponse } from 'next/server';
import { RbacEngine } from '@/lib/security/rbac-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, action, callerTenantId, resourceTenantId } = body;

    if (!role || !action) {
      return NextResponse.json(
        { success: false, error: 'role and action are required' },
        { status: 400 }
      );
    }

    const permissionResult = RbacEngine.checkPermission(role, action);

    if (callerTenantId && resourceTenantId) {
      RbacEngine.enforceTenantIsolation(callerTenantId, resourceTenantId);
    }

    return NextResponse.json({
      success: true,
      permissionResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'RBAC Authorization Failed' },
      { status: 403 }
    );
  }
}
